"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTurnkey, StamperType } from "@turnkey/react-wallet-kit";
import {
  BASESCAN,
  CAIP2_BASE_SEPOLIA,
  CONFIGURED_VARIANTS,
  PROFILE_EXPIRATION_SECONDS,
  ERC20_ABI,
  MINIBANK_ABI,
  MINIBANK_ADDRESS,
  PROFILE_ENV,
  PROFILE_IDS,
  SCOPE_VARIANTS,
  USDC_ADDRESS,
  formatScope,
  identifyScope,
  variantForProfileId,
  type ScopeVariant,
} from "@/lib/config";
import {
  approveCall,
  depositCall,
  fmtUsdc,
  readBalances,
  toUsdc,
  transferCall,
  unrecognizedCall,
  withdrawCall,
  type Balances,
  type Call,
} from "@/lib/minibank";
import {
  Card,
  Checklist,
  DangerButton,
  Header,
  KeyValue,
  Notice,
  Panel,
  Pre,
  PrimaryButton,
  SecondaryButton,
  formatError,
} from "./ui";

/**
 * Sessions and keys.
 *
 * `bootstrap` is the unscoped root session that a passkey sign-up or login
 * hands back. It lives for a few seconds: long enough to upload the smart
 * contract interfaces into a new sub-organization, and to mint one scoped
 * session per configured profile. Then it is logged out. Minting from it
 * costs no prompts: a session may STAMP_LOGIN as long as its own scope
 * allows it, and an unscoped session allows everything. The scoped sessions
 * cannot mint a session, since STAMP_LOGIN is not included in the scoped sessions.
 *
 * Each scoped session is stored under `scoped:<variant>`, and the app
 * switches between them by re-storing the chosen token (see `activate`).
 * One passkey prompt total.
 */
const BOOTSTRAP_SESSION_KEY = "bootstrap";
const scopedKey = (v: ScopeVariant) => `scoped:${v}`;

/**
 * What this app asks for when it mints a scoped session. Deliberately far
 * above the profile's cap: the final expiry is the minimum of the request and
 * the profile's `expirationSeconds`, so asking for a day and receiving
 * fifteen minutes demonstrates that the profile is a ceiling the client
 * cannot raise.
 */
const REQUESTED_EXPIRATION_SECONDS = "86400";

type SessionClaims = {
  organization_id?: string;
  public_key?: string;
  session_type?: string;
  session_profile_id?: string;
  scope?: string;
  exp?: number;
};

/** Read the JWT's claims without verifying it; the display only needs them. */
function decodeClaims(token: string): SessionClaims {
  try {
    const payload = token.split(".")[1] ?? "";
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json) as SessionClaims;
  } catch {
    return {};
  }
}

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return "expired";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Ticks once a second. Kept in its own component so the clock re-renders
 * this one span, not the whole card.
 */
function Countdown({ exp }: { exp: number | undefined }) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  if (!exp) return <span>?</span>;
  const secondsLeft = exp - now;
  return (
    <span className={secondsLeft < 60 ? "text-red-700" : ""}>
      {formatCountdown(secondsLeft)}
    </span>
  );
}

/**
 * Calls the deposit-only session must refuse. Each is a real request to
 * Turnkey; the assertion is that it never gets past the scope.
 */
const DENIAL_PROBES = [
  {
    key: "withdraw",
    label: "MiniBank.withdraw(1)",
    why: "Decodes against the uploaded ABI, but the function is not the one the scope allows.",
    call: () => withdrawCall(1n),
  },
  {
    key: "transfer",
    label: "USDC.transfer(self, 1)",
    why: "Decodes fine too, and targets a contract the scope never names.",
    call: (self: `0x${string}`) => transferCall(self, 1n),
  },
  {
    key: "unrecognized",
    label: "USDC with calldata 0xdeadbeef",
    why: "Matches no function in the uploaded ABI, so function_name is empty and nothing in the scope can be true.",
    call: () => unrecognizedCall(),
  },
] as const;
type DenialKey = (typeof DENIAL_PROBES)[number]["key"];
type DenialOutcome =
  | { status: "denied"; message: string }
  | { status: "allowed"; txHash: string }
  | { status: "error"; message: string };

/**
 * A scope refusal comes back as a permissions error whose detail reads
 * "No policies evaluated to outcome: Allow". The wording talks about
 * policies even when the session scope is what said no.
 */
function isDenial(error: unknown): boolean {
  return formatError(error).includes("No policies evaluated to outcome: Allow");
}

/** The line of the error chain that carries Turnkey's own message. */
function turnkeyLine(error: unknown): string {
  const lines = formatError(error).split("\n");
  return lines.find((l) => l.startsWith("Turnkey error")) ?? lines[0] ?? "";
}

/** The two interfaces the scopes depend on, keyed by lowercase address. */
const REQUIRED_INTERFACES = [
  {
    label: "USDC (Base Sepolia)",
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    notes: "ERC-20 approve/transfer/balanceOf for the scoped deposit example.",
  },
  {
    label: "MiniBank (Base Sepolia)",
    address: MINIBANK_ADDRESS,
    abi: MINIBANK_ABI,
    notes: "deposit/withdraw for the scoped deposit example.",
  },
] as const;

export function Demo() {
  const {
    signUpWithPasskey,
    loginWithPasskey,
    logout,
    setActiveSession,
    storeSession,
    createApiKeyPair,
    allSessions,
    session,
    wallets,
    httpClient,
    ethSendTransaction,
    pollTransactionStatus,
  } = useTurnkey();

  // The active session decides everything below. It is "scoped" when its
  // profile id is one of the configured variants.
  const activeVariant = variantForProfileId(session?.sessionProfileId);
  const inScopedSession = !!session && !!activeVariant;

  const ethAccount = wallets
    .flatMap((w) => w.accounts ?? [])
    .find((a) => a.addressFormat === "ADDRESS_FORMAT_ETHEREUM");
  const depositor = ethAccount?.address as `0x${string}` | undefined;

  const [balances, setBalances] = useState<Balances | null>(null);
  const [amount, setAmount] = useState("1");
  const [withdrawAmount, setWithdrawAmount] = useState("1");
  const [lastTxs, setLastTxs] = useState<string[]>([]);
  const [denials, setDenials] = useState<
    Partial<Record<DenialKey, DenialOutcome>>
  >({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [interfaces, setInterfaces] = useState<Record<string, string> | null>(
    null,
  );

  const refreshBalances = useCallback(async () => {
    if (!depositor) return;
    setBalances(await readBalances(depositor));
  }, [depositor]);

  useEffect(() => {
    refreshBalances().catch(() => {});
  }, [refreshBalances]);

  const run = async (fn: () => Promise<void>) => {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError(formatError(e));
    } finally {
      setBusy(false);
    }
  };

  /**
   * Submit one ETH_SEND_TRANSACTION_V2 with `sponsor: true` and wait for the
   * hash. Gas Station constructs, broadcasts and pays for it; the wallet
   * never holds ETH. Stamped by the active session unless `stampWith` says
   * otherwise. Every call in this example goes out on its own, since each
   * scoped session allows exactly one function (see `approveThenDeposit`).
   */
  const sendSponsored = async (
    calls: Call[],
    stampWith?: StamperType,
  ): Promise<string> => {
    if (!depositor) throw new Error("No Ethereum account in this wallet.");
    const sendTransactionStatusId = await ethSendTransaction({
      transaction: {
        from: depositor,
        caip2: CAIP2_BASE_SEPOLIA,
        sponsor: true,
        calls,
      },
      ...(stampWith && { stampWith }),
    });
    const status = await pollTransactionStatus({ sendTransactionStatusId });
    const txHash = status.eth?.txHash;
    if (!txHash) {
      throw new Error(`No transaction hash in status ${status.txStatus}.`);
    }
    return txHash;
  };

  const parseAmount = (): bigint => {
    const units = toUsdc(amount);
    if (units <= 0n) throw new Error("Enter an amount above 0.");
    if (balances && units > balances.wallet) {
      throw new Error(
        `Wallet holds ${fmtUsdc(balances.wallet)} USDC, less than ${amount}.`,
      );
    }
    return units;
  };

  /**
   * One action, two sessions, two sponsored transactions, no prompt.
   *
   * Each scoped session allows one function: approve-only allows
   * `USDC.approve(minibank, *)`, deposit-only allows `MiniBank.deposit(*)`.
   * The client sends the approve on the first, switches session (a local
   * change of which stored key stamps), and sends the deposit on the second.
   * If the allowance already covers the amount the approve is skipped.
   * Without an approve-only session the approve falls back to a passkey
   * stamp, the one case that prompts.
   *
   * Not atomic: two transactions. A failure after the approve leaves an
   * allowance behind, which is harmless here.
   */
  const approveThenDeposit = async () => {
    const units = parseAmount();
    const txs: string[] = [];
    const current = await readBalances(depositor!);

    if (current.allowance < units) {
      if (allSessions?.[scopedKey("approve-only")]) {
        await activate("approve-only");
        try {
          txs.push(await sendSponsored([approveCall(MINIBANK_ADDRESS, units)]));
        } finally {
          await activate("deposit-only");
        }
      } else {
        txs.push(
          await sendSponsored(
            [approveCall(MINIBANK_ADDRESS, units)],
            StamperType.Passkey,
          ),
        );
      }
    }

    txs.push(await sendSponsored([depositCall(units)]));
    setLastTxs(txs);
    await refreshBalances();
    setNotice(
      txs.length === 2
        ? `Deposited ${amount} USDC: approve on the approve-only session, deposit on this one. Two sponsored transactions, no passkey prompt.`
        : `Deposited ${amount} USDC on this session; the existing allowance covered it. No passkey prompt.`,
    );
  };

  /**
   * The assertion the ticket asks for. Send each out-of-scope call on the
   * deposit-only session and record what Turnkey did. "denied" is the pass
   * condition; a transaction hash is the failure, since it would mean the
   * scope let money move. Any other error is reported as such rather than
   * counted as a pass.
   */
  const runDenialProbes = async () => {
    if (!depositor) throw new Error("No Ethereum account in this wallet.");
    if (activeVariant !== "deposit-only") await activate("deposit-only");

    const results: Partial<Record<DenialKey, DenialOutcome>> = {};
    for (const probe of DENIAL_PROBES) {
      try {
        const txHash = await sendSponsored([probe.call(depositor)]);
        results[probe.key] = { status: "allowed", txHash };
      } catch (e) {
        results[probe.key] = isDenial(e)
          ? { status: "denied", message: turnkeyLine(e) }
          : { status: "error", message: turnkeyLine(e) };
      }
      setDenials({ ...results });
    }

    const allowed = DENIAL_PROBES.filter(
      (p) => results[p.key]?.status === "allowed",
    );
    if (allowed.length > 0) {
      throw new Error(
        `The session was allowed to send: ${allowed.map((p) => p.label).join(", ")}. The scope is not doing its job.`,
      );
    }
    const errored = DENIAL_PROBES.filter(
      (p) => results[p.key]?.status === "error",
    );
    setNotice(
      errored.length === 0
        ? "All three refused by the scope. The session can deposit and nothing else."
        : `Refused, but ${errored.length} came back as something other than a clean denial; see below.`,
    );
  };

  /**
   * Withdrawing is outside every scope, so it is stamped with the passkey.
   * One prompt, and the same wallet that could only deposit a moment ago
   * moves USDC back out.
   */
  const withdrawWithPasskey = async () => {
    const units = toUsdc(withdrawAmount);
    if (units <= 0n) throw new Error("Enter an amount above 0.");
    if (balances && units > balances.bank) {
      throw new Error(
        `MiniBank holds ${fmtUsdc(balances.bank)} USDC for this wallet, less than ${withdrawAmount}.`,
      );
    }
    const txHash = await sendSponsored(
      [withdrawCall(units)],
      StamperType.Passkey,
    );
    setLastTxs([txHash]);
    await refreshBalances();
    setNotice(
      `Withdrew ${withdrawAmount} USDC. Passkey stamp used, session stamp not used.`,
    );
  };

  /**
   * Make sure the sub-organization has an interface for each contract the
   * scopes name. `function_name` and `contract_call_args` are only decoded
   * when an interface for `eth.tx.to` exists in the organization evaluating
   * the transaction; the parent's interfaces are never consulted. Without
   * them every clause of a scope is false and even a deposit is denied.
   *
   * Uploads with whatever stamper is passed: the bootstrap session at
   * sign-up, or the passkey later, since a scoped session cannot create
   * interfaces. The preceding read is never gated by a scope, so it always
   * goes out on the active session and never prompts.
   */
  const ensureInterfaces = useCallback(
    async (
      organizationId: string,
      stampWith?: StamperType,
    ): Promise<Record<string, string>> => {
      if (!httpClient) throw new Error("Client not ready.");

      const { smartContractInterfaces } =
        await httpClient.getSmartContractInterfaces({ organizationId });
      const found: Record<string, string> = {};
      for (const i of smartContractInterfaces) {
        if (i.type === "SMART_CONTRACT_INTERFACE_TYPE_ETHEREUM") {
          found[i.smartContractAddress.toLowerCase()] =
            i.smartContractInterfaceId;
        }
      }

      for (const w of REQUIRED_INTERFACES) {
        if (found[w.address]) continue;
        const res = await httpClient.createSmartContractInterface(
          {
            organizationId,
            label: w.label,
            notes: w.notes,
            type: "SMART_CONTRACT_INTERFACE_TYPE_ETHEREUM",
            smartContractAddress: w.address,
            smartContractInterface: JSON.stringify(w.abi),
          },
          stampWith,
        );
        if (!res.smartContractInterfaceId) {
          throw new Error(
            `Interface upload for ${w.label} did not complete (activity ${res.activity?.status}).`,
          );
        }
        found[w.address] = res.smartContractInterfaceId;
      }

      setInterfaces(found);
      return found;
    },
    [httpClient],
  );

  /**
   * Mint one scoped session per configured profile, stamped by the unscoped
   * `bootstrap` session. No prompts.
   *
   * Two SDK behaviours dictate the order:
   * - `storeSession` makes the stored session active, and a scoped session
   *   may not STAMP_LOGIN. So the unscoped session is re-activated before
   *   each mint.
   * - `storeSession` also deletes every key pair not referenced by a stored
   *   session. So each key is created, used, and stored before the next one
   *   is created; minting all keys up front would lose all but the first.
   */
  const mintScopedSessions = async (organizationId: string) => {
    if (!httpClient) throw new Error("Client not ready.");
    if (CONFIGURED_VARIANTS.length === 0) {
      throw new Error(
        `No session profile ids configured. Run \`pnpm create-profile\` and set ${Object.values(PROFILE_ENV).join(" and/or ")} in .env.local.`,
      );
    }

    const tokens: Partial<Record<ScopeVariant, string>> = {};
    for (const variant of CONFIGURED_VARIANTS) {
      await setActiveSession({ sessionKey: BOOTSTRAP_SESSION_KEY });
      const publicKey = await createApiKeyPair();
      const { session: token } = await httpClient.stampLogin({
        organizationId,
        publicKey,
        expirationSeconds: REQUESTED_EXPIRATION_SECONDS,
        sessionProfileId: PROFILE_IDS[variant]!,
      });
      await storeSession({
        sessionToken: token,
        sessionKey: scopedKey(variant),
      });
      tokens[variant] = token;
    }

    // The unscoped session has done its job. Logging it out also clears the
    // provider's session state, so the activation below comes after it.
    await logout({ sessionKey: BOOTSTRAP_SESSION_KEY });

    // Land on deposit-only, where the deposit action lives.
    const first = CONFIGURED_VARIANTS.includes("deposit-only")
      ? "deposit-only"
      : CONFIGURED_VARIANTS[0]!;
    await activate(first, tokens[first]!);
  };

  /**
   * Make a stored scoped session the active one and sync the provider's
   * state to it. Re-storing an existing token under its own key is the one
   * hook that reliably does both: it sets the active key, re-reads the
   * session, and refreshes user and wallets. The scoped key stays
   * referenced, so nothing is cleaned up. No prompt.
   */
  const activate = async (variant: ScopeVariant, token?: string) => {
    const sessionToken = token ?? allSessions?.[scopedKey(variant)]?.token;
    if (!sessionToken) throw new Error(`No "${variant}" session to switch to.`);
    await storeSession({ sessionToken, sessionKey: scopedKey(variant) });
    setInterfaces(null);
  };

  /**
   * New user. One passkey prompt creates the passkey and the sub-organization
   * and returns an unscoped session. That session uploads the interfaces and
   * mints the scoped sessions, then is logged out.
   */
  const signUp = async () => {
    const { sessionToken } = await signUpWithPasskey({
      sessionKey: BOOTSTRAP_SESSION_KEY,
      passkeyDisplayName: `MiniBank depositor ${new Date().toISOString().slice(0, 16)}`,
    });
    const organizationId = decodeClaims(sessionToken).organization_id;
    if (!organizationId) throw new Error("Sign-up returned no organization.");

    await ensureInterfaces(organizationId);
    await mintScopedSessions(organizationId);
    setNotice(
      `Signed up. The unscoped session uploaded the interfaces, minted ${CONFIGURED_VARIANTS.length} scoped session(s), and was logged out.`,
    );
  };

  /**
   * Returning user. One passkey prompt yields an unscoped session; Turnkey
   * finds the sub-organization from the passkey. Same minting as sign-up.
   */
  const logIn = async () => {
    const { sessionToken } = await loginWithPasskey({
      sessionKey: BOOTSTRAP_SESSION_KEY,
    });
    const organizationId = decodeClaims(sessionToken).organization_id;
    if (!organizationId) throw new Error("Login returned no organization.");

    await mintScopedSessions(organizationId);
    setNotice(
      `Logged in. Minted ${CONFIGURED_VARIANTS.length} scoped session(s) from the unscoped one, which was then logged out.`,
    );
  };

  const logOutAll = async () => {
    for (const v of CONFIGURED_VARIANTS) {
      if (allSessions?.[scopedKey(v)]) {
        await logout({ sessionKey: scopedKey(v) });
      }
    }
    setInterfaces(null);
  };

  // Once in a scoped session, check the interfaces are there. Reads are not
  // gated by the scope, so this works even though uploads would not.
  useEffect(() => {
    if (!inScopedSession || !httpClient || interfaces) return;
    const organizationId = session.organizationId;
    httpClient
      .getSmartContractInterfaces({ organizationId })
      .then(({ smartContractInterfaces }) => {
        const found: Record<string, string> = {};
        for (const i of smartContractInterfaces) {
          found[i.smartContractAddress.toLowerCase()] =
            i.smartContractInterfaceId;
        }
        setInterfaces(found);
      })
      .catch((e) => setError(formatError(e)));
  }, [inScopedSession, httpClient, interfaces, session]);

  const activeToken = session?.token;
  const claims = useMemo<SessionClaims>(
    () => (activeToken ? decodeClaims(activeToken) : {}),
    [activeToken],
  );
  const claimedVariant = claims.scope ? identifyScope(claims.scope) : undefined;

  // ---------------------------------------------------------------------------

  if (!inScopedSession) {
    return (
      <Card>
        <Header
          title="Deposit-only session"
          subtitle="Browser sessions that can approve and deposit USDC into MiniBank, and nothing else. Withdrawing needs the passkey. If a session leaks, the attacker can only put money in."
        />

        {CONFIGURED_VARIANTS.length === 0 && (
          <Notice tone="error">
            No session profile ids are configured. Run `pnpm create-profile`
            (and `--variant deposit-only`) and set{" "}
            {Object.values(PROFILE_ENV).join(" and/or ")} in .env.local.
          </Notice>
        )}

        <Panel
          title="Scopes this app can log into"
          hint="Same language as policy conditions. One passkey prompt yields an unscoped session, which mints one scoped session per profile below and is then logged out."
        >
          {(Object.keys(SCOPE_VARIANTS) as ScopeVariant[]).map((key) => (
            <div key={key} className="flex flex-col gap-1">
              <p className="text-xs font-semibold">
                {key}
                {!PROFILE_IDS[key] && (
                  <span className="ml-2 font-normal text-gray-500">
                    (not configured: {PROFILE_ENV[key]})
                  </span>
                )}
              </p>
              <Pre>{formatScope(SCOPE_VARIANTS[key].build())}</Pre>
            </div>
          ))}
        </Panel>

        {session && (
          <Notice>
            You hold a session that is not one of the scoped ones (key{" "}
            <span className="font-mono">
              {Object.entries(allSessions ?? {}).find(
                ([, s]) => s.token === session.token,
              )?.[0] ?? "?"}
            </span>
            ). Log in below to mint the scoped sessions.
          </Notice>
        )}

        <div className="flex flex-col gap-2">
          <PrimaryButton
            disabled={busy || CONFIGURED_VARIANTS.length === 0}
            onClick={() => run(signUp)}
          >
            Sign up with a passkey
          </PrimaryButton>
          <SecondaryButton
            disabled={busy || CONFIGURED_VARIANTS.length === 0}
            onClick={() => run(logIn)}
          >
            Log in with an existing passkey
          </SecondaryButton>
        </div>

        {notice && <Notice tone="success">{notice}</Notice>}
        {error && <Notice tone="error">{error}</Notice>}
      </Card>
    );
  }

  const interfaceItems = REQUIRED_INTERFACES.map((w) => ({
    label: w.label,
    done: !!interfaces?.[w.address],
    detail: interfaces?.[w.address] ?? w.address,
  }));
  const interfacesReady = interfaceItems.every((i) => i.done);

  const amountInput = (
    <input
      value={amount}
      onChange={(e) => setAmount(e.target.value)}
      inputMode="decimal"
      className="w-full rounded border border-gray-300 px-3 py-2 font-mono text-sm"
      placeholder="USDC amount"
    />
  );

  return (
    <Card>
      <Header
        title="Deposit-only session"
        subtitle="You are in a scoped session. Every activity it submits is checked against its scope before any policy is consulted."
      />

      {CONFIGURED_VARIANTS.length > 1 && (
        <Panel
          title="Active scoped session"
          hint="Both were minted from one passkey login. Switching is a local change of which stored session stamps requests; no prompt."
        >
          <div className="flex gap-2">
            {CONFIGURED_VARIANTS.map((v) => {
              const s = allSessions?.[scopedKey(v)];
              const isActive = v === activeVariant;
              return (
                <button
                  key={v}
                  type="button"
                  disabled={busy || !s || isActive}
                  onClick={() => run(() => activate(v))}
                  className={`flex-1 rounded border px-3 py-2 text-xs ${
                    isActive
                      ? "border-blue-300 bg-blue-50 font-semibold"
                      : "border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40"
                  }`}
                >
                  {v}
                  <span className="block font-mono text-gray-500">
                    {s ? <Countdown exp={s.expiry} /> : "no session"}
                  </span>
                </button>
              );
            })}
          </div>
        </Panel>
      )}

      <Panel
        title="What Turnkey issued"
        hint={`Decoded from the session JWT. To show that a profile's expiration is a ceiling, this app deliberately requested a ${REQUESTED_EXPIRATION_SECONDS}-second session. The profile allows ${PROFILE_EXPIRATION_SECONDS}, and Turnkey issues the shorter of the two.`}
      >
        <KeyValue
          rows={[
            { label: "session_type", value: claims.session_type ?? "?" },
            {
              label: "session_profile_id",
              value: claims.session_profile_id ?? "?",
            },
            { label: "organization_id", value: claims.organization_id ?? "?" },
            {
              label: "app requested",
              value: `${REQUESTED_EXPIRATION_SECONDS}s (24h)`,
            },
            {
              label: "profile allows",
              value: `${PROFILE_EXPIRATION_SECONDS}s (15 min)`,
            },
            {
              label: "issued, expires in",
              value: <Countdown exp={claims.exp} />,
            },
          ]}
        />
        <Pre>
          {claims.scope ? formatScope(claims.scope) : "(no scope claim)"}
        </Pre>
        {claimedVariant === activeVariant ? (
          <Notice tone="success">
            The scope in the JWT is the &quot;{activeVariant}&quot; scope, as
            the profile id says it should be.
          </Notice>
        ) : (
          <Notice tone="error">
            The JWT&apos;s scope does not match the &quot;{activeVariant}&quot;
            scope this app expects for profile {session.sessionProfileId}. Check
            the profile ids and contract addresses in .env.local.
          </Notice>
        )}
      </Panel>

      <Panel
        title="Smart contract interfaces in this sub-organization"
        hint="The scope compares decoded function names and arguments. Those only exist when this sub-organization has an interface for the contract; the parent's do not count. Without these uploads every clause is false and even a deposit is denied."
      >
        <Checklist items={interfaceItems} />
        {!interfacesReady && (
          <SecondaryButton
            disabled={busy}
            onClick={() =>
              run(async () => {
                await ensureInterfaces(
                  session.organizationId,
                  StamperType.Passkey,
                );
                setNotice("Interfaces uploaded with the passkey.");
              })
            }
          >
            Upload missing interfaces with the passkey
          </SecondaryButton>
        )}
      </Panel>

      <Panel
        title="1. Fund the depositor"
        hint="The sub-organization's Ethereum account. Send it Base Sepolia USDC from the Circle faucet. It never needs ETH: every write below is sponsored."
      >
        <KeyValue
          rows={[
            { label: "address", value: depositor ?? "(loading)" },
            {
              label: "faucet",
              value: (
                <a
                  className="underline"
                  href="https://faucet.circle.com"
                  target="_blank"
                  rel="noreferrer"
                >
                  faucet.circle.com
                </a>
              ),
            },
            {
              label: "wallet USDC",
              value: balances ? fmtUsdc(balances.wallet) : "…",
            },
            {
              label: "in MiniBank",
              value: balances ? fmtUsdc(balances.bank) : "…",
            },
            {
              label: "allowance to MiniBank",
              value: balances ? fmtUsdc(balances.allowance) : "…",
            },
          ]}
        />
        <SecondaryButton disabled={busy} onClick={() => run(refreshBalances)}>
          Refresh balances
        </SecondaryButton>
      </Panel>

      {activeVariant && (
        <Panel
          title="2. Deposit (no prompt)"
          hint={
            allSessions?.[scopedKey("approve-only")]
              ? "One action, two sessions: the client sends the approve on the approve-only session, switches to the deposit-only session, and sends the deposit. Two sponsored transactions, neither prompts. The approve is skipped when the allowance already covers the amount."
              : "No approve-only session is configured, so the approve falls back to the passkey (one prompt) before the deposit-only session deposits."
          }
        >
          <div className="flex gap-2">
            {amountInput}
            <PrimaryButton
              disabled={busy || !depositor}
              onClick={() => run(approveThenDeposit)}
            >
              Approve + deposit
            </PrimaryButton>
          </div>
        </Panel>
      )}

      <Panel
        title="3. Try to take money out with the session (must be denied)"
        hint="Three calls the deposit-only session should never be able to make, sent for real. A denial is the pass. If any of them returned a transaction hash, the scope would have failed and this panel would say so in red."
      >
        <ul className="flex w-full flex-col gap-2 rounded border border-gray-200 bg-gray-50 p-3">
          {DENIAL_PROBES.map((p) => {
            const r = denials[p.key];
            const mark =
              r?.status === "denied"
                ? "✓"
                : r?.status === "allowed"
                  ? "✗"
                  : r?.status === "error"
                    ? "!"
                    : "○";
            const tone =
              r?.status === "denied"
                ? "text-green-700"
                : r?.status === "allowed"
                  ? "text-red-700"
                  : r?.status === "error"
                    ? "text-amber-700"
                    : "text-gray-400";
            return (
              <li key={p.key} className="flex gap-2 text-xs">
                <span className={tone}>{mark}</span>
                <span className="min-w-0 flex-1">
                  <span className="font-mono">{p.label}</span>
                  <span className="mt-0.5 block text-gray-600">{p.why}</span>
                  {r && (
                    <span
                      className={`mt-0.5 block break-all font-mono ${tone}`}
                    >
                      {r.status === "denied" && `denied: ${r.message}`}
                      {r.status === "allowed" &&
                        `ALLOWED, tx ${r.txHash}. This must not happen.`}
                      {r.status === "error" &&
                        `not a clean denial: ${r.message}`}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
        <PrimaryButton
          disabled={busy || !depositor}
          onClick={() => run(runDenialProbes)}
        >
          Send all three with the deposit-only session
        </PrimaryButton>
      </Panel>

      <Panel
        title="4. Withdraw with the passkey (one prompt)"
        hint="Withdrawing is outside every scope, so it needs the passkey. Same wallet, same contract, different credential: this is the step a stolen session cannot take."
      >
        <div className="flex gap-2">
          <input
            value={withdrawAmount}
            onChange={(e) => setWithdrawAmount(e.target.value)}
            inputMode="decimal"
            className="w-full rounded border border-gray-300 px-3 py-2 font-mono text-sm"
            placeholder="USDC amount"
          />
          <PrimaryButton
            disabled={busy || !depositor}
            onClick={() => run(withdrawWithPasskey)}
          >
            Withdraw (passkey)
          </PrimaryButton>
        </div>
      </Panel>

      {lastTxs.length > 0 && (
        <div className="flex flex-col gap-1">
          {lastTxs.map((tx) => (
            <a
              key={tx}
              className="break-all font-mono text-xs underline"
              href={`${BASESCAN}/tx/${tx}`}
              target="_blank"
              rel="noreferrer"
            >
              {BASESCAN}/tx/{tx}
            </a>
          ))}
        </div>
      )}

      {notice && <Notice tone="success">{notice}</Notice>}
      {error && <Notice tone="error">{error}</Notice>}

      <DangerButton disabled={busy} onClick={() => run(logOutAll)}>
        Log out of all scoped sessions
      </DangerButton>
    </Card>
  );
}

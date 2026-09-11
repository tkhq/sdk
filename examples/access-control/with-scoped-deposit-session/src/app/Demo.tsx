"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTurnkey, StamperType } from "@turnkey/react-wallet-kit";
import {
  BASESCAN,
  CAIP2_BASE_SEPOLIA,
  DEPOSIT_PROFILE_EXPIRATION_SECONDS,
  ERC20_ABI,
  MINIBANK_ABI,
  MINIBANK_ADDRESS,
  SCOPE_VARIANTS,
  USDC_ADDRESS,
  formatScope,
  identifyScope,
} from "@/lib/config";
import {
  approveCall,
  depositCall,
  fmtUsdc,
  readBalances,
  toUsdc,
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
 * Two sessions, two keys.
 *
 * `bootstrap` is the unscoped root session that sign-up hands back. It exists
 * for a few seconds: long enough to upload the two smart contract interfaces
 * into the new sub-organization, which the scoped session is not allowed to
 * do. Then it is logged out.
 *
 * `deposit` is the session the rest of the app runs on. It is bound to the
 * deposit-only profile, so its scope is evaluated on every activity.
 */
const BOOTSTRAP_SESSION_KEY = "bootstrap";
export const DEPOSIT_SESSION_KEY = "deposit";

const SESSION_PROFILE_ID = process.env.NEXT_PUBLIC_SESSION_PROFILE_ID ?? "";

/**
 * What this app asks for when it logs in. Deliberately far above the
 * profile's cap: the final expiry is the minimum of the login request and the
 * profile's `expirationSeconds`, so asking for a day and receiving fifteen
 * minutes demonstrates that the profile is a ceiling the client cannot raise.
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

/** The two interfaces the scope depends on, keyed by lowercase address. */
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
    allSessions,
    session,
    wallets,
    httpClient,
    ethSendTransaction,
    pollTransactionStatus,
  } = useTurnkey();

  const depositSession = allSessions?.[DEPOSIT_SESSION_KEY];
  const inScopedSession =
    !!depositSession && depositSession.sessionProfileId === SESSION_PROFILE_ID;

  const ethAccount = wallets
    .flatMap((w) => w.accounts ?? [])
    .find((a) => a.addressFormat === "ADDRESS_FORMAT_ETHEREUM");
  const depositor = ethAccount?.address as `0x${string}` | undefined;

  const [balances, setBalances] = useState<Balances | null>(null);
  const [amount, setAmount] = useState("1");
  const [lastTx, setLastTx] = useState<string | null>(null);
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
   * hash. With more than one call Gas Station composes an EIP-7702 batch, so
   * approve + deposit land atomically in one transaction. The wallet pays no
   * gas. Stamped by the active session unless `stampWith` says otherwise.
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
   * Two-branch scope: approve(minibank, amount) + deposit(amount) as one
   * batch, stamped by the scoped session. No prompt.
   */
  const depositBatched = async () => {
    const units = parseAmount();
    const txHash = await sendSponsored([
      approveCall(MINIBANK_ADDRESS, units),
      depositCall(units),
    ]);
    setLastTx(txHash);
    await refreshBalances();
    setNotice(
      `Deposited ${amount} USDC in one sponsored transaction, stamped by the scoped session. No passkey prompt.`,
    );
  };

  /**
   * Single-branch scope, step 1: the approve is outside the scope, so it is
   * stamped with the passkey. One prompt. Done once per allowance.
   */
  const approveWithPasskey = async () => {
    const units = parseAmount();
    const txHash = await sendSponsored(
      [approveCall(MINIBANK_ADDRESS, units)],
      StamperType.Passkey,
    );
    setLastTx(txHash);
    await refreshBalances();
    setNotice(
      `Approved ${amount} USDC for MiniBank with the passkey. The session can now deposit up to that amount.`,
    );
  };

  /**
   * Single-branch scope, step 2: deposit(amount) alone, stamped by the
   * scoped session. No prompt. Needs the allowance from step 1.
   */
  const depositSingle = async () => {
    const units = parseAmount();
    if (balances && units > balances.allowance) {
      throw new Error(
        `MiniBank is allowed ${fmtUsdc(balances.allowance)} USDC, less than ${amount}. Approve first.`,
      );
    }
    const txHash = await sendSponsored([depositCall(units)]);
    setLastTx(txHash);
    await refreshBalances();
    setNotice(
      `Deposited ${amount} USDC, stamped by the scoped session. No passkey prompt.`,
    );
  };

  /**
   * Make sure the sub-organization has an interface for each contract the
   * scope names. `function_name` and `contract_call_args` are only decoded
   * when an interface for `eth.tx.to` exists in the organization evaluating
   * the transaction, and without them every clause of the scope is false.
   *
   * Uploads with whatever stamper is passed: the bootstrap session at
   * sign-up, or the passkey later, since the scoped session cannot create
   * interfaces. The read that precedes the uploads is never gated by the
   * scope, so it always goes out on the active session and never prompts.
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

  /** Passkey-stamped login into the scoped session. One prompt. */
  const scopedLogin = async (organizationId?: string) => {
    if (!SESSION_PROFILE_ID) {
      throw new Error(
        "NEXT_PUBLIC_SESSION_PROFILE_ID is not set. Run `pnpm create-profile` and add its output to .env.local.",
      );
    }
    await loginWithPasskey({
      sessionKey: DEPOSIT_SESSION_KEY,
      sessionProfileId: SESSION_PROFILE_ID,
      expirationSeconds: REQUESTED_EXPIRATION_SECONDS,
      ...(organizationId && { organizationId }),
    });
    await setActiveSession({ sessionKey: DEPOSIT_SESSION_KEY });
  };

  /**
   * New user. Creates the passkey and the sub-organization, uploads the
   * interfaces on the unscoped session sign-up returns, then swaps to the
   * scoped session. Two passkey prompts: one to create, one to log in.
   */
  const signUp = async () => {
    const { sessionToken } = await signUpWithPasskey({
      sessionKey: BOOTSTRAP_SESSION_KEY,
      passkeyDisplayName: `MiniBank depositor ${new Date().toISOString().slice(0, 16)}`,
    });
    const organizationId = decodeClaims(sessionToken).organization_id;
    if (!organizationId) throw new Error("Sign-up returned no organization.");

    await ensureInterfaces(organizationId);
    await scopedLogin(organizationId);
    await logout({ sessionKey: BOOTSTRAP_SESSION_KEY });
    setNotice(
      "Signed up. The unscoped session uploaded the two interfaces and was logged out; everything from here runs on the scoped session.",
    );
  };

  /** Returning user. Turnkey finds the sub-organization from the passkey. */
  const logIn = async () => {
    await scopedLogin();
  };

  // Once in the scoped session, check the interfaces are there. Reads are not
  // gated by the scope, so this works even though uploads would not.
  useEffect(() => {
    if (!inScopedSession || !httpClient || interfaces) return;
    const organizationId = depositSession.organizationId;
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
  }, [inScopedSession, httpClient, interfaces, depositSession]);

  const depositToken = depositSession?.token;
  const claims = useMemo<SessionClaims>(
    () => (depositToken ? decodeClaims(depositToken) : {}),
    [depositToken],
  );
  const scopeVariant = claims.scope ? identifyScope(claims.scope) : undefined;

  // ---------------------------------------------------------------------------

  if (!inScopedSession) {
    return (
      <Card>
        <Header
          title="Deposit-only session"
          subtitle="A browser session that can approve and deposit USDC into MiniBank, and nothing else. Withdrawing needs the passkey. If this session leaks, the attacker can only put money in."
        />

        {!SESSION_PROFILE_ID && (
          <Notice tone="error">
            NEXT_PUBLIC_SESSION_PROFILE_ID is not set. Run `pnpm create-profile`
            and add its output to .env.local.
          </Notice>
        )}

        <Panel
          title="Scopes this app understands"
          hint="Same language as policy conditions. Whichever one your profile carries is evaluated on every activity the session submits."
        >
          {Object.entries(SCOPE_VARIANTS).map(([key, v]) => (
            <div key={key} className="flex flex-col gap-1">
              <p className="text-xs font-semibold">{key}</p>
              <Pre>{formatScope(v.build())}</Pre>
            </div>
          ))}
        </Panel>

        {session && !inScopedSession && (
          <Notice>
            You hold an unscoped session (key{" "}
            <span className="font-mono">
              {Object.entries(allSessions ?? {}).find(
                ([, s]) => s.token === session.token,
              )?.[0] ?? "?"}
            </span>
            ). Log in below to get the scoped one.
          </Notice>
        )}

        <div className="flex flex-col gap-2">
          <PrimaryButton
            disabled={busy || !SESSION_PROFILE_ID}
            onClick={() => run(signUp)}
          >
            Sign up with a passkey
          </PrimaryButton>
          <SecondaryButton
            disabled={busy || !SESSION_PROFILE_ID}
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
        subtitle="You are in the scoped session. Every activity it submits is checked against the scope below before any policy is consulted."
      />

      <Panel
        title="What Turnkey issued"
        hint={`Decoded from the session JWT. To show that a profile's expiration is a ceiling, this app deliberately requested a ${REQUESTED_EXPIRATION_SECONDS}-second session at login. The profile allows ${DEPOSIT_PROFILE_EXPIRATION_SECONDS}, and Turnkey issues the shorter of the two.`}
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
              value: `${DEPOSIT_PROFILE_EXPIRATION_SECONDS}s (15 min)`,
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
        {scopeVariant ? (
          <Notice tone="success">
            The scope in the JWT is the &quot;{scopeVariant}&quot; scope.
          </Notice>
        ) : (
          <Notice tone="error">
            The scope in the JWT is not one this app knows. Check
            NEXT_PUBLIC_SESSION_PROFILE_ID and the contract addresses in
            .env.local.
          </Notice>
        )}
      </Panel>

      <Panel
        title="Smart contract interfaces in this sub-organization"
        hint="The scope compares decoded function names and arguments. Those only exist when the organization evaluating the transaction has an interface for the contract. Without these uploads every clause is false and even a deposit is denied."
      >
        <Checklist items={interfaceItems} />
        {!interfacesReady && (
          <SecondaryButton
            disabled={busy}
            onClick={() =>
              run(async () => {
                await ensureInterfaces(
                  depositSession.organizationId,
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

      {scopeVariant === "approve+deposit" && (
        <Panel
          title="2. Deposit with the session (no prompt)"
          hint="approve(minibank, amount) and deposit(amount) go out as one sponsored batch, stamped by the scoped session. Both calls match the scope, so it completes without a passkey."
        >
          <div className="flex gap-2">
            {amountInput}
            <PrimaryButton
              disabled={busy || !depositor}
              onClick={() => run(depositBatched)}
            >
              Approve + deposit
            </PrimaryButton>
          </div>
        </Panel>
      )}

      {scopeVariant === "deposit-only" && (
        <Panel
          title="2. Approve once with the passkey, then deposit with the session"
          hint="This scope allows deposit and nothing else, so the approve is outside it and needs the passkey. After that the session deposits on its own, up to the allowance, with no prompt."
        >
          {amountInput}
          <div className="flex gap-2">
            <SecondaryButton
              disabled={busy || !depositor}
              onClick={() => run(approveWithPasskey)}
            >
              Approve (passkey)
            </SecondaryButton>
            <PrimaryButton
              disabled={busy || !depositor}
              onClick={() => run(depositSingle)}
            >
              Deposit (session)
            </PrimaryButton>
          </div>
        </Panel>
      )}

      {lastTx && (
        <a
          className="break-all font-mono text-xs underline"
          href={`${BASESCAN}/tx/${lastTx}`}
          target="_blank"
          rel="noreferrer"
        >
          {BASESCAN}/tx/{lastTx}
        </a>
      )}

      {notice && <Notice tone="success">{notice}</Notice>}
      {error && <Notice tone="error">{error}</Notice>}

      <DangerButton
        disabled={busy}
        onClick={() => run(() => logout({ sessionKey: DEPOSIT_SESSION_KEY }))}
      >
        Log out
      </DangerButton>
    </Card>
  );
}

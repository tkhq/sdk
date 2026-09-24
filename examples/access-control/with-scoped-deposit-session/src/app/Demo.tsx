"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTurnkey, StamperType } from "@turnkey/react-wallet-kit";
import type { Hex } from "viem";
import {
  BASESCAN,
  CAIP2_BASE_SEPOLIA,
  MINIBANK_ADDRESS,
  PROFILE_ENV,
  PROFILE_EXPIRATION_SECONDS,
  PROFILE_ID,
  SELECTORS,
  buildScope,
  formatScope,
  isExpectedScope,
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
 * The only session this app ever holds is scoped. Sign-up and login both
 * take a `sessionProfileId`, so the session Turnkey hands back is already
 * limited to approve-for-MiniBank and deposit. There is no unscoped session
 * at any point: nothing to steal that could withdraw, and nothing for an XSS
 * to borrow for a few seconds. One passkey prompt, one session.
 */
const SESSION_KEY = "scoped";

/**
 * What this app asks for when it logs in. Deliberately far above the
 * profile's cap: the final expiry is the minimum of the request and the
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

/**
 * Calls the session must refuse. Each is a real request to Turnkey; the
 * assertion is that it never gets past the scope. The approve probe is the
 * one an attacker holding the session would try: right contract, right
 * selector, a spender that is not MiniBank. Only the calldata pin at
 * data[34..74] stands in the way.
 */
type Probe = {
  key: string;
  label: string;
  why: string;
  call: (self: Hex) => Call;
};
const DENIAL_PROBES: Probe[] = [
  {
    key: "withdraw",
    label: "MiniBank.withdraw(1)",
    why: `Right contract, wrong selector: ${SELECTORS.withdraw} is not ${SELECTORS.deposit}.`,
    call: () => withdrawCall(1n),
  },
  {
    key: "transfer",
    label: "USDC.transfer(self, 1)",
    why: "Right contract for the approve branch, but a selector no branch allows.",
    call: (self) => transferCall(self, 1n),
  },
  {
    key: "approve-elsewhere",
    label: "USDC.approve(self, 1)",
    why: "Right contract and right selector, but the spender bytes at data[34..74] are not MiniBank.",
    call: (self) => approveCall(self, 1n),
  },
  {
    key: "unrecognized",
    label: "USDC with calldata 0xdeadbeef",
    why: "Not a selector the scope allows, so refused. Ten characters of calldata, so the approve branch's data[34..74] reads past the end and the refusal comes back as an evaluation error (a 500) rather than a denial. Nothing moves either way.",
    call: () => unrecognizedCall(),
  },
];
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

export function Demo() {
  const {
    signUpWithPasskey,
    loginWithPasskey,
    logout,
    allSessions,
    session,
    wallets,
    ethSendTransaction,
    pollTransactionStatus,
  } = useTurnkey();

  // The active session decides everything below. It is "scoped" when its
  // profile id is the configured one.
  const inScopedSession =
    !!session && !!PROFILE_ID && session.sessionProfileId === PROFILE_ID;

  // A stored session minted under a different profile. Sessions outlive
  // `.env.local` edits and dev-server restarts, so after changing the profile
  // id a session from the previous login can still sit in storage. Using it
  // would evaluate the old scope, and the failure would look like a scope bug.
  const stale = allSessions?.[SESSION_KEY];
  const staleProfileId =
    PROFILE_ID && stale && stale.sessionProfileId !== PROFILE_ID
      ? (stale.sessionProfileId ?? "(none)")
      : undefined;

  const ethAccount = wallets
    .flatMap((w) => w.accounts ?? [])
    .find((a) => a.addressFormat === "ADDRESS_FORMAT_ETHEREUM");
  const depositor = ethAccount?.address as Hex | undefined;

  const [balances, setBalances] = useState<Balances | null>(null);
  const [amount, setAmount] = useState("1");
  const [withdrawAmount, setWithdrawAmount] = useState("1");
  const [lastTxs, setLastTxs] = useState<string[]>([]);
  const [denials, setDenials] = useState<Record<string, DenialOutcome>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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
   * never holds ETH. Stamped by the session unless `stampWith` says
   * otherwise. The scope is evaluated against every call in `calls`, so a
   * batch goes through only if each call is allowed on its own.
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
   * Name the step in any error, so a denial says which call the scope
   * refused rather than leaving the reader to work it out.
   */
  const step = async <T,>(name: string, fn: () => Promise<T>): Promise<T> => {
    try {
      return await fn();
    } catch (e) {
      throw new Error(`${name}: ${formatError(e)}`);
    }
  };

  /**
   * Approve and deposit as one ETH_SEND_TRANSACTION_V2 with two calls, so
   * the deposit cannot land without its approve. Both calls are allowed by
   * the scope, so the batch goes through. One sponsored transaction, no
   * prompt. The headline action of this example.
   */
  const approveAndDepositBatch = async () => {
    const units = parseAmount();
    const txHash = await step("approve + deposit batch", () =>
      sendSponsored([approveCall(MINIBANK_ADDRESS, units), depositCall(units)]),
    );
    setLastTxs([txHash]);
    await refreshBalances();
    setNotice(
      `Deposited ${amount} USDC with approve and deposit in one atomic sponsored transaction. No passkey prompt.`,
    );
  };

  /**
   * The same two calls as two transactions, to show that each is allowed on
   * its own. If the allowance already covers the amount the approve is
   * skipped. Not atomic: a failure after the approve leaves an allowance
   * behind, which is harmless here.
   */
  const approveThenDeposit = async () => {
    const units = parseAmount();
    const txs: string[] = [];
    const before = await readBalances(depositor!);

    if (before.allowance < units) {
      txs.push(
        await step("approve", () =>
          sendSponsored([approveCall(MINIBANK_ADDRESS, units)]),
        ),
      );
    }
    txs.push(await step("deposit", () => sendSponsored([depositCall(units)])));
    setLastTxs(txs);
    await refreshBalances();
    setNotice(
      txs.length === 2
        ? `Deposited ${amount} USDC: approve, then deposit. Two sponsored transactions, no passkey prompt.`
        : `Deposited ${amount} USDC; the existing allowance covered it. No passkey prompt.`,
    );
  };

  /**
   * The assertion the ticket asks for. Send each out-of-scope call on the
   * session and record what Turnkey did. A refusal is the pass condition,
   * whether it arrives as a denial or as an evaluation error; a transaction
   * hash is the failure, since it would mean the scope let money move.
   */
  const runDenialProbes = async () => {
    if (!depositor) throw new Error("No Ethereum account in this wallet.");

    const results: Record<string, DenialOutcome> = {};
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
        ? `All ${DENIAL_PROBES.length} refused by the scope. The session can approve MiniBank and deposit, and nothing else.`
        : `All ${DENIAL_PROBES.length} refused. ${errored.length} came back as an evaluation error rather than a denial; see below for why. Nothing moved.`,
    );
  };

  /**
   * Withdrawing is outside the scope, so it is stamped with the passkey.
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

  const requireProfile = (): string => {
    if (!PROFILE_ID) {
      throw new Error(
        `No session profile id configured. Run \`pnpm create-profile\` and set ${PROFILE_ENV} in .env.local.`,
      );
    }
    return PROFILE_ID;
  };

  /**
   * New user. The passkey creation ceremony also produces the scoped
   * session: sign-up takes a `sessionProfileId`, and the SDK's STAMP_LOGIN
   * for the new sub-organization carries it. One prompt. At no point does an
   * unscoped session exist.
   */
  const signUp = async () => {
    const sessionProfileId = requireProfile();
    await signUpWithPasskey({
      sessionKey: SESSION_KEY,
      sessionProfileId,
      expirationSeconds: REQUESTED_EXPIRATION_SECONDS,
      passkeyDisplayName: `MiniBank depositor ${new Date().toISOString().slice(0, 16)}`,
    });
    setNotice(
      "Signed up. One passkey prompt, one scoped session, no unscoped session.",
    );
  };

  /**
   * Returning user. One passkey-stamped STAMP_LOGIN carrying the profile id;
   * Turnkey finds the sub-organization from the passkey.
   */
  const logIn = async () => {
    const sessionProfileId = requireProfile();
    await loginWithPasskey({
      sessionKey: SESSION_KEY,
      sessionProfileId,
      expirationSeconds: REQUESTED_EXPIRATION_SECONDS,
    });
    setNotice(
      "Logged in. One passkey prompt, one scoped session, no unscoped session.",
    );
  };

  /** Every stored session, not only ours, so nothing lingers. */
  const logOutAll = async () => {
    for (const key of Object.keys(allSessions ?? {})) {
      await logout({ sessionKey: key });
    }
  };

  const activeToken = session?.token;
  const claims = useMemo<SessionClaims>(
    () => (activeToken ? decodeClaims(activeToken) : {}),
    [activeToken],
  );

  // ---------------------------------------------------------------------------

  if (!inScopedSession) {
    return (
      <Card>
        <Header
          title="Deposit-only session"
          subtitle="A browser session that can approve and deposit USDC into MiniBank, and nothing else. Withdrawing needs the passkey. If the session leaks, the attacker can only put money in."
        />

        {!PROFILE_ID && (
          <Notice tone="error">
            No session profile id is configured. Run `pnpm create-profile` and
            set {PROFILE_ENV} in .env.local.
          </Notice>
        )}

        {staleProfileId && (
          <Notice tone="error">
            A stored session was minted under profile {staleProfileId}, not the
            one .env.local now names. It is left over from a login before the
            profile changed. Log in below to replace it.
          </Notice>
        )}

        <Panel
          title="The scope this app logs into"
          hint="Same language as policy conditions, matched on raw calldata so nothing has to be uploaded first. Sign-up and login pass the profile id, so the session is scoped from its first request; there is never an unscoped one. One passkey prompt."
        >
          <Pre>{formatScope(buildScope())}</Pre>
        </Panel>

        {session && !staleProfileId && (
          <Notice>
            You hold a session that is not the scoped one (key{" "}
            <span className="font-mono">
              {Object.entries(allSessions ?? {}).find(
                ([, s]) => s.token === session.token,
              )?.[0] ?? "?"}
            </span>
            ). Log in below to mint the scoped session.
          </Notice>
        )}

        <div className="flex flex-col gap-2">
          <PrimaryButton
            disabled={busy || !PROFILE_ID}
            onClick={() => run(signUp)}
          >
            Sign up with a passkey
          </PrimaryButton>
          <SecondaryButton
            disabled={busy || !PROFILE_ID}
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

  return (
    <Card>
      <Header
        title="Deposit-only session"
        subtitle="You are in a scoped session. Every activity it submits is checked against its scope before any policy is consulted."
      />

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
        {claims.scope && isExpectedScope(claims.scope) ? (
          <Notice tone="success">
            The scope in the JWT is the one this app expects for the profile.
          </Notice>
        ) : (
          <Notice tone="error">
            The JWT&apos;s scope does not match the scope this app expects for
            profile {session.sessionProfileId}. Check the profile id and
            contract addresses in .env.local.
          </Notice>
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

      <Panel
        title="2. Deposit (no prompt)"
        hint="The scope allows approve(minibank, *) and deposit(*), and it is checked against every call in a transaction. The batch sends both calls in one sponsored transaction, so the deposit cannot land without its approve. The two-transaction button sends them one after the other, skipping the approve when the allowance already covers the amount. Neither prompts."
      >
        <div className="flex gap-2">
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            className="w-full rounded border border-gray-300 px-3 py-2 font-mono text-sm"
            placeholder="USDC amount"
          />
          <PrimaryButton
            disabled={busy || !depositor}
            onClick={() => run(approveAndDepositBatch)}
          >
            Approve + deposit, one atomic batch
          </PrimaryButton>
        </div>
        <SecondaryButton
          disabled={busy || !depositor}
          onClick={() => run(approveThenDeposit)}
        >
          Approve + deposit, two transactions
        </SecondaryButton>
      </Panel>

      <Panel
        title="3. Try to take money out with the session (must be refused)"
        hint="Calls the session should never be able to make, sent for real. A refusal is the pass, whether Turnkey reports it as a denial or as an evaluation error. If any of them returned a transaction hash, the scope would have failed and this panel would say so in red."
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
                        `refused with an evaluation error, not a denial: ${r.message}`}
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
          Send all {DENIAL_PROBES.length} with the session
        </PrimaryButton>
      </Panel>

      <Panel
        title="4. Withdraw with the passkey (one prompt)"
        hint="Withdrawing is outside the scope, so it needs the passkey. Same wallet, same contract, different credential: this is the step a stolen session cannot take."
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
        Log out
      </DangerButton>
    </Card>
  );
}

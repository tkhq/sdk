"use client";

import { useState, useEffect, useRef } from "react";
import { useTurnkey, AuthState } from "@turnkey/react-wallet-kit";
import { createClaimLink } from "@/server/actions/createClaimLink";
import { fundEscrow } from "@/server/actions/fundEscrow";
import { getClaim } from "@/server/actions/getClaim";

const TTL_SECONDS = 30;
const USDC_CONTRACT = process.env.NEXT_PUBLIC_USDC_CONTRACT!;

export function SendForm() {
  const { session, authState, handleLogin, logout } = useTurnkey();
  const isAuthenticated = authState === AuthState.Authenticated;

  const [amount, setAmount] = useState("1");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    claimId: string;
    url: string;
    fundTxHash: string;
  } | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [claimState, setClaimState] = useState<
    "pending" | "claimed" | "reclaimed"
  >("pending");
  const [reclaimTxHash, setReclaimTxHash] = useState<string | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!result) return;
    setCountdown(TTL_SECONDS);
    setClaimState("pending");
    setReclaimTxHash(null);

    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(countdownRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    pollRef.current = setInterval(async () => {
      const claim = await getClaim(result.claimId);
      if (!claim) return;
      if (claim.state === "claimed") {
        setClaimState("claimed");
        clearInterval(pollRef.current!);
        clearInterval(countdownRef.current!);
      } else if (claim.state === "reclaimed" && claim.reclaimTxHash) {
        setClaimState("reclaimed");
        setReclaimTxHash(claim.reclaimTxHash);
        clearInterval(pollRef.current!);
      }
    }, 3000);

    return () => {
      clearInterval(countdownRef.current!);
      clearInterval(pollRef.current!);
    };
  }, [result]);

  function reset() {
    setResult(null);
    setCountdown(null);
    setClaimState("pending");
    setReclaimTxHash(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!session) return;
    setError(null);
    setSubmitting(true);
    try {
      const amountRaw = BigInt(Math.floor(parseFloat(amount) * 1e6)).toString();
      const res = await createClaimLink({
        asset: USDC_CONTRACT,
        amountRaw,
        amountDisplay: `${amount} USDC`,
        expirationSeconds: TTL_SECONDS,
      });
      const { txHash: fundTxHash } = await fundEscrow(res.claimId);
      setResult({ claimId: res.claimId, url: res.url, fundTxHash });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (!isAuthenticated) {
    return (
      <div
        className="tk-card"
        style={{ textAlign: "center", padding: "32px 24px" }}
      >
        <p className="tk-body-muted" style={{ marginBottom: 16 }}>
          Sign in to create a claim link.
        </p>
        <button
          onClick={() => handleLogin()}
          className="tk-btn-primary"
          style={{ width: "auto", padding: "8px 28px" }}
        >
          Sign in with Turnkey
        </button>
      </div>
    );
  }

  if (result) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="tk-card tk-card-success">
          <p className="tk-section-label">Claim link ready</p>
          <p className="tk-field-label">Share this URL with the recipient</p>
          <p className="tk-url" style={{ marginTop: 4 }}>
            {result.url}
          </p>
          <p className="tk-caption" style={{ marginTop: 10 }}>
            The claim key lives in the URL fragment (after <code>#</code>) and
            is never sent to the server.
          </p>
          <div
            style={{
              marginTop: 12,
              paddingTop: 12,
              borderTop: "1px solid var(--tk-success-border)",
            }}
          >
            <p className="tk-field-label">Funding transaction</p>
            <a
              href={`https://sepolia.basescan.org/tx/${result.fundTxHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="tk-url"
              style={{
                color: "var(--tk-fg-accent)",
                textDecoration: "none",
                marginTop: 2,
                display: "block",
              }}
            >
              {result.fundTxHash} ↗
            </a>
          </div>
        </div>

        {claimState === "claimed" ? (
          <div className="tk-card tk-card-success">
            <p className="tk-section-label">Claimed by recipient</p>
            <p className="tk-caption">
              The recipient claimed the funds before the TTL expired.
            </p>
          </div>
        ) : claimState === "reclaimed" ? (
          <div className="tk-card tk-card-success">
            <p className="tk-section-label">Funds automatically reclaimed</p>
            <p className="tk-field-label">Sweep transaction</p>
            <a
              href={`https://sepolia.basescan.org/tx/${reclaimTxHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="tk-url"
              style={{
                color: "var(--tk-fg-accent)",
                textDecoration: "none",
                marginTop: 2,
                display: "block",
              }}
            >
              {reclaimTxHash} ↗
            </a>
            <p className="tk-caption" style={{ marginTop: 10 }}>
              The sweep key policy ensured funds could only return to the sender
              address.
            </p>
          </div>
        ) : (
          <div
            className="tk-card"
            style={{ display: "flex", flexDirection: "column", gap: 8 }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <p className="tk-section-label" style={{ margin: 0 }}>
                Automated reclaim
              </p>
              {countdown !== null && countdown > 0 ? (
                <span className="tk-countdown-badge">{countdown}s</span>
              ) : (
                <span className="tk-caption">sweeping...</span>
              )}
            </div>
            {countdown !== null && (
              <div className="tk-progress">
                <div
                  className="tk-progress-fill"
                  style={{
                    width: `${((TTL_SECONDS - countdown) / TTL_SECONDS) * 100}%`,
                  }}
                />
              </div>
            )}
            <p className="tk-caption">
              If unclaimed, funds sweep back automatically after {TTL_SECONDS}s
              via the sweep key policy. In production this runs as a cron job.
            </p>
          </div>
        )}

        <button onClick={reset} className="tk-link">
          Create another
        </button>
      </div>
    );
  }

  return (
    <div
      className="tk-card"
      style={{ display: "flex", flexDirection: "column", gap: 20 }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div>
          <p className="tk-section-label">Create claim link</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <p className="tk-field-label">Signed in as</p>
            <p className="tk-mono tk-field-value">{session?.organizationId}</p>
          </div>
        </div>
        <button
          onClick={() => logout()}
          style={{
            background: "none",
            border: "1px solid var(--tk-border)",
            borderRadius: "var(--tk-radius-sm)",
            padding: "4px 10px",
            fontSize: 12,
            color: "var(--tk-fg-subtle)",
            cursor: "pointer",
            fontFamily: "var(--tk-font-body)",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          Sign out
        </button>
      </div>

      <hr className="tk-divider" />

      <form
        onSubmit={onSubmit}
        style={{ display: "flex", flexDirection: "column", gap: 16 }}
      >
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span className="tk-field-label">Amount (USDC)</span>
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="tk-input"
            required
          />
        </label>

        {error && (
          <div
            className="tk-card tk-card-danger"
            style={{ padding: "12px 16px" }}
          >
            <p className="tk-body-sm">{error}</p>
          </div>
        )}

        <button type="submit" disabled={submitting} className="tk-btn-primary">
          {submitting ? "Creating..." : "Create and fund claim link"}
        </button>

        <p className="tk-caption" style={{ textAlign: "center" }}>
          Recipient just needs a wallet address. Gas is sponsored by Turnkey.
        </p>
      </form>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { executeClaim } from "@/server/actions/executeClaim";
import type { PublicClaim } from "@/server/actions/getClaim";

export function ClaimClient({ claim }: { claim: PublicClaim }) {
  const [keyFromUrl, setKeyFromUrl] = useState<string>("");
  const [recipient, setRecipient] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash) {
      const params = new URLSearchParams(
        window.location.hash.replace(/^#/, ""),
      );
      const k = params.get("key");
      if (k) {
        setKeyFromUrl(k);
        return;
      }
    }
  }, []);

  async function onClaim(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (!keyFromUrl) throw new Error("Missing claim key in URL fragment.");
      const res = await executeClaim({
        claimId: claim.id,
        claimKeyPrivateKey: keyFromUrl,
        recipientAddress: recipient,
      });
      setTxHash(res.txHash);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (claim.state === "claimed") {
    return (
      <div className="tk-card">
        <p className="tk-body-muted">This claim has already been redeemed.</p>
      </div>
    );
  }
  if (claim.state === "reclaimed" || claim.state === "expired") {
    return (
      <div className="tk-card tk-card-warning">
        <p className="tk-body-sm">
          This claim is no longer redeemable (state: {claim.state}).
        </p>
      </div>
    );
  }
  if (claim.state === "creating") {
    return (
      <div className="tk-card">
        <p className="tk-body-muted">
          The escrow wallet has not been funded yet. Check back soon.
        </p>
      </div>
    );
  }
  if (txHash) {
    return (
      <div
        className="tk-card tk-card-success"
        style={{ display: "flex", flexDirection: "column", gap: 8 }}
      >
        <p className="tk-section-label">Sent</p>
        <p className="tk-field-label">Transaction</p>
        <a
          href={`https://sepolia.basescan.org/tx/${txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="tk-url"
          style={{ color: "var(--tk-fg-accent)", textDecoration: "none" }}
        >
          {txHash} ↗
        </a>
      </div>
    );
  }

  return (
    <div
      className="tk-card"
      style={{ display: "flex", flexDirection: "column", gap: 20 }}
    >
      <p className="tk-section-label">Claim funds</p>

      <form
        onSubmit={onClaim}
        style={{ display: "flex", flexDirection: "column", gap: 16 }}
      >
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span className="tk-field-label">Your EVM address</span>
          <input
            type="text"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="0x..."
            className="tk-input"
            autoComplete="off"
            required
          />
        </label>

        {!keyFromUrl && (
          <div
            className="tk-card tk-card-warning"
            style={{ padding: "10px 14px" }}
          >
            <p className="tk-caption">
              No claim key found. Open this page from the original link (with{" "}
              <code>#key=...</code> in the URL).
            </p>
          </div>
        )}

        {error && (
          <div
            className="tk-card tk-card-danger"
            style={{ padding: "10px 14px" }}
          >
            <p className="tk-body-sm">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || !keyFromUrl}
          className="tk-btn-primary"
        >
          {submitting ? "Claiming..." : "Claim funds"}
        </button>
      </form>
    </div>
  );
}

"use client";

import { useTurnkey } from "@turnkey/react-wallet-kit";
import { TurnkeyError, TurnkeyErrorCodes } from "@turnkey/sdk-types";
import { useState, type ReactElement } from "react";

export default function SignMessage(): ReactElement {
  const { wallets, handleSignMessage } = useTurnkey();
  const [message, setMessage] = useState("Hello from Turnkey + Stellar!");
  const [signature, setSignature] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const stellarAccount = wallets
    .flatMap((w) => w.accounts)
    .find((a) => a.addressFormat === "ADDRESS_FORMAT_XLM");

  async function handleSign() {
    if (!stellarAccount) {
      setError("No Stellar account found.");
      return;
    }
    setError(null);
    setSignature(null);
    setLoading(true);
    try {
      const { r, s } = await handleSignMessage({
        message,
        walletAccount: stellarAccount,
        // ed25519 requires HASH_FUNCTION_NOT_APPLICABLE
        encoding: "PAYLOAD_ENCODING_TEXT_UTF8" as any,
        hashFunction: "HASH_FUNCTION_NOT_APPLICABLE" as any,
      });
      const rHex = r.startsWith("0x") ? r.slice(2) : r;
      const sHex = s.startsWith("0x") ? s.slice(2) : s;
      setSignature(rHex.padStart(64, "0") + sHex.padStart(64, "0"));
    } catch (err) {
      if (
        err instanceof TurnkeyError &&
        err.code === TurnkeyErrorCodes.USER_CANCELED
      ) {
        return;
      }
      setError(err instanceof Error ? err.message : "Signing failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 flex flex-col gap-4">
      <h2 className="font-semibold text-lg">Sign Message</h2>

      <div className="flex flex-col gap-2">
        <label className="text-sm text-gray-600">Message</label>
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Enter a message to sign"
        />
      </div>

      <button
        onClick={handleSign}
        disabled={loading || !stellarAccount || !message}
        className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all cursor-pointer"
      >
        {loading ? "Signing…" : "Sign Message"}
      </button>

      {!stellarAccount && (
        <p className="text-sm text-amber-600">No Stellar account found.</p>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}

      {signature && (
        <div className="flex flex-col gap-1">
          <p className="text-sm text-gray-500">Signature (ed25519, hex)</p>
          <p className="font-mono text-xs text-gray-700 break-all rounded bg-gray-50 border border-gray-100 p-2">
            {signature}
          </p>
        </div>
      )}
    </section>
  );
}

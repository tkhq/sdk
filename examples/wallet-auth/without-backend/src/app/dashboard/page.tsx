"use client";

import { useEffect, useMemo, useState } from "react";
import {
  useTurnkey,
  AuthState,
  WalletSource,
  type Wallet,
  type WalletAccount,
} from "@turnkey/react-wallet-kit";
import { useRouter } from "next/navigation";
import {
  serializeTransaction,
  parseGwei,
  type TransactionSerializableEIP1559,
} from "viem";

function safeStringify(x: unknown) {
  return JSON.stringify(
    x,
    (_k, v) => (typeof v === "bigint" ? v.toString() : v),
    2,
  );
}

export default function Dashboard() {
  const { httpClient, authState, logout, session, wallets } = useTurnkey();
  const router = useRouter();

  const turnkey = useTurnkey();

  // Guard unauthenticated users
  useEffect(() => {
    if (authState === AuthState.Unauthenticated) router.replace("/");
  }, [authState, router]);

  // --- Sign Message ---
  const [message, setMessage] = useState("Hello from Turnkey 👋");
  const [signing, setSigning] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // --- Sign Transaction ---
  const [txSigning, setTxSigning] = useState(false);
  const [signedTx, setSignedTx] = useState<string | null>(null);
  const [txErr, setTxErr] = useState<string | null>(null);

  // Get the first embedded Ethereum acccount which will be used for signing
  const embeddedWallets = useMemo(
    () =>
      ((wallets ?? []) as Wallet[]).filter(
        (w) => w.source === WalletSource.Embedded,
      ),
    [wallets],
  );

  const firstEmbeddedAccount = useMemo<WalletAccount | undefined>(() => {
    for (const w of embeddedWallets) {
      const accounts = (w as any)?.accounts as WalletAccount[] | undefined;
      const evm = accounts?.find(
        (a: any) =>
          a?.addressFormat === "ADDRESS_FORMAT_ETHEREUM" && a?.address,
      );
      if (evm) return evm;
    }
    return undefined;
  }, [embeddedWallets]);

  const firstEmbeddedEvmAddress = firstEmbeddedAccount?.address;

  const demoTxObject: TransactionSerializableEIP1559 = {
    type: "eip1559",
    chainId: 11155111, // Sepolia
    nonce: 0,
    gas: 21000n,
    maxFeePerGas: parseGwei("1"),
    maxPriorityFeePerGas: parseGwei("1"),
    to: "0x0000000000000000000000000000000000000000",
    value: 0n,
    data: "0x",
  };

  const onSignMessage = async () => {
    try {
      setErr(null);
      setSignature(null);

      if (authState !== AuthState.Authenticated)
        throw new Error("Not authenticated.");
      if (!httpClient) throw new Error("HTTP client not ready.");
      if (!session?.organizationId) throw new Error("Missing organization id.");
      if (!firstEmbeddedEvmAddress) throw new Error("No EVM account found.");
      if (!message) throw new Error("Message cannot be empty.");

      setSigning(true);

      // You could also use signMessage() https://docs.turnkey.com/generated-docs/formatted/react-wallet-kit/client-context-type-sign-message
      // But showing here how to use `httpClient` and access the advanced API requests https://docs.turnkey.com/sdks/react/advanced-api-requests
      const res = await httpClient.signRawPayload({
        organizationId: session.organizationId,
        signWith: firstEmbeddedEvmAddress,
        payload: message,
        encoding: "PAYLOAD_ENCODING_TEXT_UTF8",
        hashFunction: "HASH_FUNCTION_SHA256",
      });

      const activity = (res as any)?.activity;
      const r = activity?.result?.signRawPayloadResult?.r;
      const s = activity?.result?.signRawPayloadResult?.s;
      const v = activity?.result?.signRawPayloadResult?.v;
      const sig = r && s && v ? `0x${r}${s}${v}` : undefined;
      setSignature(sig ?? "(no signature returned)");
    } catch (e: any) {
      console.error(e);
      setErr(e?.message ?? "Failed to sign message.");
    } finally {
      setSigning(false);
    }
  };

  const onSignDemoTx = async () => {
    try {
      if (!httpClient) throw new Error("HTTP client not ready.");
      if (!session?.organizationId) throw new Error("Missing organization id.");
      if (!firstEmbeddedAccount) throw new Error("No EVM account found.");

      setTxSigning(true);

      const unsignedHex = serializeTransaction(demoTxObject);

      const res = await turnkey.signTransaction({
        organizationId: session.organizationId,
        walletAccount: firstEmbeddedAccount,
        unsignedTransaction: unsignedHex,
        transactionType: "TRANSACTION_TYPE_ETHEREUM",
      });

      const hex =
        (res as any)?.signedTransaction ??
        (typeof res === "string" ? res : "(no signed transaction)");

      setSignedTx(hex?.startsWith("0x") ? hex : `0x${hex}`);
    } catch (e: any) {
      console.error(e);
      setTxErr(e?.message ?? "Failed to sign transaction.");
    } finally {
      setTxSigning(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      window.location.replace("/");
    } catch (e) {
      console.error("Logout failed:", e);
    }
  };

  if (authState !== AuthState.Authenticated) {
    return <p className="p-6">Loading…</p>;
  }

  return (
    <main className="relative min-h-screen p-6 sm:p-8 bg-gray-50">
      <button
        onClick={handleLogout}
        className="absolute top-4 right-4 rounded bg-red-600 px-3 py-1.5 text-white text-xs sm:text-sm hover:bg-red-700"
      >
        Logout
      </button>

      <div className="mx-auto mt-10 max-w-screen-xl px-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
          {/* LEFT: Sign Message + Tx */}
          <section className="lg:col-span-5 rounded-xl border border-gray-200 bg-white p-5 sm:p-6 shadow-sm space-y-6">
            {/* Sign Message */}
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-gray-800">
                Sign Message
              </h2>
              <div className="text-xs text-gray-600">
                Sign with:&nbsp;
                <span className="font-mono">
                  {firstEmbeddedEvmAddress ??
                    "(no embedded EVM account detected)"}
                </span>
              </div>
              <label className="block text-sm font-medium text-gray-800">
                Message
                <textarea
                  className="mt-1 w-full rounded border px-3 py-2 text-sm"
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </label>

              {err && (
                <div className="rounded border border-red-300 bg-red-50 p-2 text-xs text-red-700">
                  {err}
                </div>
              )}

              <button
                onClick={onSignMessage}
                disabled={signing || !firstEmbeddedEvmAddress}
                className="rounded bg-blue-600 px-4 py-2 text-white text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {signing ? "Signing…" : "Sign Message"}
              </button>

              {signature && (
                <div className="rounded border bg-gray-50 p-3 max-h-48 overflow-auto">
                  <div className="mb-1 text-xs text-gray-500">Signature</div>
                  <pre className="overflow-x-auto text-[11px] font-mono break-all whitespace-pre-wrap">
                    {signature}
                  </pre>
                </div>
              )}
            </div>

            {/* Sign Tx */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-800">
                Sign Demo ETH Tx
              </h3>

              <div className="rounded border bg-gray-50 p-3">
                <div className="mb-1 text-xs text-gray-500">
                  Transaction Object
                </div>
                <pre className="overflow-x-auto text-[11px] font-mono leading-snug">
                  {safeStringify(demoTxObject)}
                </pre>
              </div>

              {txErr && (
                <div className="rounded border border-red-300 bg-red-50 p-2 text-xs text-red-700">
                  {txErr}
                </div>
              )}

              <button
                onClick={onSignDemoTx}
                disabled={txSigning || !firstEmbeddedAccount}
                className="rounded bg-purple-700 px-4 py-2 text-sm text-white hover:bg-purple-800 disabled:opacity-50"
              >
                {txSigning ? "Signing…" : "Sign Tx"}
              </button>

              {signedTx && (
                <div className="rounded border bg-gray-50 p-3 max-h-48 overflow-auto">
                  <div className="mb-1 text-xs text-gray-500">
                    Signed Raw Tx
                  </div>
                  <pre className="overflow-x-auto text-[11px] font-mono break-all whitespace-pre-wrap">
                    {signedTx}
                  </pre>
                </div>
              )}
            </div>
          </section>

          {/* RIGHT: Wallets + Suborg */}
          <section className="lg:col-span-7 rounded-xl border border-gray-200 bg-white p-5 sm:p-6 shadow-sm space-y-4">
            <h2 className="text-base font-semibold text-gray-800">
              Wallets (Embedded + Connected)
            </h2>

            {/* Show embedded and connected wallets */}
            <div className="p-3 rounded border bg-gray-50 text-left overflow-x-auto">
              <pre className="font-mono text-[11px] leading-snug min-w-[60ch]">
                {JSON.stringify(wallets ?? [], null, 2)}
              </pre>
            </div>

            <div className="p-3 rounded border bg-gray-50">
              <div className="text-xs text-gray-500">Sub-org ID</div>
              <div className="text-xs font-mono break-all">
                {session?.organizationId ?? "—"}
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

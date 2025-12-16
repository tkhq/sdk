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
  createPublicClient,
  http,
} from "viem";
import { sepolia } from "viem/chains";
import {
  Connection,
  SystemProgram,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
  clusterApiUrl,
} from "@solana/web3.js";
import { uint8ArrayToHexString } from "@turnkey/encoding";

/** ---------- Utils ---------- */
function safeStringify(x: unknown) {
  return JSON.stringify(
    x,
    (_k, v) => (typeof v === "bigint" ? v.toString() : v),
    2,
  );
}

// Build a Solana v0 **unsigned** tx and return HEX (Turnkey expects hex for SOL)
async function buildUnsignedSolanaTxHex(fromAddress: string, rpcUrl?: string) {
  const connection = new Connection(
    rpcUrl || clusterApiUrl("devnet"),
    "confirmed",
  );
  const from = new PublicKey(fromAddress);
  const { blockhash } = await connection.getLatestBlockhash("finalized");

  const ix = SystemProgram.transfer({
    fromPubkey: from,
    toPubkey: from, // self-transfer demo
    lamports: 0,
  });

  const msgV0 = new TransactionMessage({
    payerKey: from,
    recentBlockhash: blockhash,
    instructions: [ix],
  }).compileToV0Message();

  const unsignedTx = new VersionedTransaction(msgV0);
  const bytes = unsignedTx.serialize();
  return uint8ArrayToHexString(bytes);
}

// Build an EVM demo tx (send-to-self, 0 value) with a fresh nonce
async function buildEvmDemoTx(params: {
  address: `0x${string}`;
  rpcUrl?: string;
}): Promise<TransactionSerializableEIP1559> {
  const client = createPublicClient({
    chain: sepolia,
    transport: http(params.rpcUrl || sepolia.rpcUrls.default.http[0]),
  });

  const nonce = await client.getTransactionCount({ address: params.address });

  return {
    type: "eip1559",
    chainId: 11155111, // Sepolia
    nonce,
    gas: 21_000n,
    maxFeePerGas: parseGwei("1"),
    maxPriorityFeePerGas: parseGwei("1"),
    to: params.address,
    value: 0n,
    data: "0x",
  };
}

export default function Dashboard() {
  const {
    authState,
    logout,
    session,
    wallets,
    signMessage,
    signAndSendTransaction,
  } = useTurnkey();
  const router = useRouter();

  // Redirect unauthenticated users
  useEffect(() => {
    if (authState === AuthState.Unauthenticated) router.replace("/");
  }, [authState, router]);

  // Only embedded wallets/accounts
  const embeddedAccounts = useMemo(() => {
    return (wallets ?? [])
      .filter((w: Wallet) => w.source === WalletSource.Embedded)
      .flatMap((w) =>
        (w.accounts ?? []).map((a) => ({
          walletName: w.walletName,
          address: a.address,
          source: w.source,
          account: a,
          addressFormat: a.addressFormat as string,
        })),
      );
  }, [wallets]);

  const [selectedAccount, setSelectedAccount] = useState<WalletAccount | null>(
    null,
  );
  const selectedMeta = useMemo(() => {
    if (!selectedAccount) return null;
    return (
      embeddedAccounts.find((x) => x.address === selectedAccount.address) ??
      null
    );
  }, [embeddedAccounts, selectedAccount]);

  useEffect(() => {
    if (!selectedAccount && embeddedAccounts.length > 0) {
      setSelectedAccount(embeddedAccounts[0].account);
    }
  }, [embeddedAccounts, selectedAccount]);

  // Chain detection
  const fmt = selectedMeta?.addressFormat ?? "";
  const isEvm =
    fmt.includes("ETHEREUM") ||
    (selectedMeta?.address?.startsWith("0x") ?? false);
  const isSol =
    fmt.includes("SOLANA") ||
    (!isEvm &&
      /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(selectedMeta?.address ?? ""));

  // RPCs: required for embedded broadcasting
  const ETH_RPC = process.env.NEXT_PUBLIC_RPC_ETH;
  const SOL_RPC = process.env.NEXT_PUBLIC_RPC_SOL;

  /** ---- Live EVM nonce (for preview only) ---- */
  const [evmNonce, setEvmNonce] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    async function fetchNonce() {
      if (!isEvm || !selectedAccount?.address) {
        setEvmNonce(null);
        return;
      }
      try {
        const client = createPublicClient({
          chain: sepolia,
          transport: http(ETH_RPC || sepolia.rpcUrls.default.http[0]),
        });
        const n = await client.getTransactionCount({
          address: selectedAccount.address as `0x${string}`,
        });
        if (!cancelled) setEvmNonce(n);
      } catch (e) {
        console.error("Failed to fetch nonce", e);
        if (!cancelled) setEvmNonce(null);
      }
    }
    fetchNonce();
    return () => {
      cancelled = true;
    };
  }, [isEvm, selectedAccount?.address, ETH_RPC]);

  /** ---- Sign Message ---- */
  const [message, setMessage] = useState("Hello from Turnkey 👋");
  const [signing, setSigning] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const onSignMessage = async () => {
    try {
      setErr(null);
      setSignature(null);

      if (authState !== AuthState.Authenticated)
        throw new Error("Not authenticated.");
      if (!session?.organizationId) throw new Error("Missing organization id.");
      if (!selectedAccount) throw new Error("No account selected.");
      if (!message) throw new Error("Message cannot be empty.");

      setSigning(true);

      const res = await signMessage({
        walletAccount: selectedAccount,
        addEthereumPrefix: !!isEvm, // EIP-191 prefix for EVM
        message,
      });

      let out: string | undefined;
      if (
        res &&
        typeof res === "object" &&
        "r" in res &&
        "s" in res &&
        "v" in res
      ) {
        const { r, s, v } = res as any;
        out = r && s && v ? `0x${r}${s}${v}` : undefined;
      } else if (typeof res === "string") {
        out = res; // SOL base64
      } else if (res && typeof res === "object" && "signature" in res) {
        out = (res as any).signature; // SOL { signature }
      }

      setSignature(out ?? "(no signature returned)");
    } catch (e: any) {
      console.error(e);
      setErr(e?.message ?? "Failed to sign message.");
    } finally {
      setSigning(false);
    }
  };

  /** ---- Sign & Send Transaction (embedded) ---- */
  const [txSigning, setTxSigning] = useState(false);
  const [sentHash, setSentHash] = useState<string | null>(null);
  const [txErr, setTxErr] = useState<string | null>(null);

  // Preview objects (EVM shows live nonce)
  const evmPreview = useMemo(
    () =>
      isEvm
        ? {
            type: "eip1559",
            chainId: 11155111,
            nonce: evmNonce ?? "(loading…)",
            gas: "21000",
            maxFeePerGas: "1 gwei",
            maxPriorityFeePerGas: "1 gwei",
            to: selectedAccount?.address ?? "—",
            value: "0",
            data: "0x",
          }
        : null,
    [isEvm, selectedAccount?.address, evmNonce],
  );

  // Solana preview (unsigned hex v0 tx)
  const [solPreviewHex, setSolPreviewHex] = useState<string | null>(null);
  const [solPreviewStatus, setSolPreviewStatus] = useState<
    "idle" | "building" | "error"
  >("idle");

  useEffect(() => {
    if (!isSol || !selectedAccount?.address) {
      setSolPreviewHex(null);
      setSolPreviewStatus("idle");
      return;
    }
    setSolPreviewStatus("building");
    const solRpc = SOL_RPC || clusterApiUrl("devnet");
    buildUnsignedSolanaTxHex(selectedAccount.address, solRpc)
      .then((hex) => {
        setSolPreviewHex(hex);
        setSolPreviewStatus("idle");
      })
      .catch(() => {
        setSolPreviewHex(null);
        setSolPreviewStatus("error");
      });
  }, [isSol, selectedAccount?.address, SOL_RPC]);

  const onSignAndSendTx = async () => {
    try {
      setTxErr(null);
      setSentHash(null);

      if (!session?.organizationId) throw new Error("Missing organization id.");
      if (!selectedAccount || !selectedMeta)
        throw new Error("No account selected.");

      setTxSigning(true);

      let unsignedTransaction: string;
      let transactionType:
        | "TRANSACTION_TYPE_ETHEREUM"
        | "TRANSACTION_TYPE_SOLANA";
      let rpcUrl: string;

      if (isEvm) {
        if (!ETH_RPC)
          throw new Error("Set NEXT_PUBLIC_RPC_ETH for embedded EVM.");
        const tx = await buildEvmDemoTx({
          address: selectedAccount.address as `0x${string}`,
          rpcUrl: ETH_RPC,
        });
        const unsignedHex = serializeTransaction(tx);
        unsignedTransaction = unsignedHex.startsWith("0x")
          ? unsignedHex
          : `0x${unsignedHex}`;
        transactionType = "TRANSACTION_TYPE_ETHEREUM";
        rpcUrl = ETH_RPC;
      } else if (isSol) {
        const solRpc = SOL_RPC || clusterApiUrl("devnet");
        unsignedTransaction = await buildUnsignedSolanaTxHex(
          selectedAccount.address,
          solRpc,
        );
        transactionType = "TRANSACTION_TYPE_SOLANA";
        rpcUrl = solRpc;
      } else {
        throw new Error(
          `Unsupported address format: ${selectedMeta.addressFormat}`,
        );
      }

      const txHashOrSig = await signAndSendTransaction({
        walletAccount: selectedAccount,
        transactionType,
        unsignedTransaction,
        rpcUrl,
      });

      setSentHash(txHashOrSig ?? "(no hash/signature returned)");
    } catch (e: any) {
      console.error(e);
      setTxErr(e?.message ?? "Failed to sign & send transaction.");
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
            {/* Wallet selector */}
            <div>
              <label className="block text-sm font-medium text-gray-800">
                Select Embedded Wallet Account
              </label>
              <select
                className="mt-1 w-full rounded border px-3 py-2 text-sm"
                value={selectedAccount?.address ?? ""}
                onChange={(e) => {
                  const found = embeddedAccounts.find(
                    (a) => a.address === e.target.value,
                  );
                  if (found) setSelectedAccount(found.account);
                }}
              >
                {embeddedAccounts.length === 0 && (
                  <option value="">(No embedded accounts)</option>
                )}
                {embeddedAccounts.map((a) => (
                  <option key={a.address} value={a.address}>
                    {a.walletName} — {a.address.slice(0, 8)}…
                  </option>
                ))}
              </select>

              <p className="mt-2 text-[11px] text-gray-500">
                Embedded accounts sign via Turnkey. Broadcasting requires RPCs:
                {` `}
                <span className="font-mono">NEXT_PUBLIC_RPC_ETH</span> for EVM
                and{` `}
                <span className="font-mono">NEXT_PUBLIC_RPC_SOL</span> for
                Solana.
              </p>
            </div>

            {/* Sign Message */}
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-gray-800">
                Sign Message
              </h2>
              <div className="text-xs text-gray-600">
                Sign with:&nbsp;
                <span className="font-mono">
                  {selectedAccount?.address ?? "—"}
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
                disabled={signing || !selectedAccount}
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

            {/* Sign & Send Tx */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-800">
                {isEvm
                  ? "Sign & Send Demo Ethereum Tx"
                  : isSol
                    ? "Sign & Send Demo Solana Tx"
                    : "Sign & Send Demo Tx"}
              </h3>

              <div className="rounded border bg-gray-50 p-3">
                <div className="mb-1 text-xs text-gray-500">
                  Transaction Preview
                </div>
                <pre className="overflow-x-auto text-[11px] font-mono leading-snug">
                  {isEvm
                    ? safeStringify(evmPreview)
                    : isSol
                      ? solPreviewStatus === "building"
                        ? "(building Solana v0 tx …)"
                        : solPreviewStatus === "error"
                          ? "(failed to build Solana preview)"
                          : safeStringify({
                              payer: selectedAccount?.address ?? "—",
                              to: selectedAccount?.address ?? "—",
                              lamports: 0,
                              format: "v0 transaction (unsigned, hex)",
                              hex: solPreviewHex,
                            })
                      : "(pick an EVM or Solana account)"}
                </pre>
              </div>

              {txErr && (
                <div className="rounded border border-red-300 bg-red-50 p-2 text-xs text-red-700">
                  {txErr}
                </div>
              )}

              <button
                onClick={onSignAndSendTx}
                disabled={txSigning || !selectedAccount || (!isEvm && !isSol)}
                className="rounded bg-purple-700 px-4 py-2 text-sm text-white hover:bg-purple-800 disabled:opacity-50"
              >
                {txSigning ? "Submitting…" : "Sign & Send Tx"}
              </button>

              {sentHash && (
                <div className="rounded border bg-gray-50 p-3 max-h-48 overflow-auto">
                  <div className="mb-1 text-xs text-gray-500">
                    Tx Hash / Signature
                  </div>
                  <pre className="overflow-x-auto text-[11px] font-mono break-all whitespace-pre-wrap">
                    {sentHash}
                  </pre>
                </div>
              )}
            </div>
          </section>

          {/* RIGHT: Wallets + Suborg */}
          <section className="lg:col-span-7 rounded-xl border border-gray-200 bg-white p-5 sm:p-6 shadow-sm space-y-4">
            <h2 className="text-base font-semibold text-gray-800">
              Embedded Wallets
            </h2>

            <div className="p-3 rounded border bg-gray-50 overflow-x-auto">
              <pre className="font-mono text-[11px] leading-snug min-w-[60ch]">
                {JSON.stringify(
                  (wallets ?? []).filter(
                    (w) => w.source === WalletSource.Embedded,
                  ),
                  null,
                  2,
                )}
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

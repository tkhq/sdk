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
import { parseEther } from "viem";
import {
  PublicKey,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";

const ETH_NETWORKS = [
  { label: "Sepolia", caip2: "eip155:11155111" },
  { label: "Mainnet", caip2: "eip155:1" },
] as const;

const SOL_NETWORKS = [
  {
    label: "Devnet",
    caip2: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG",
  },
  {
    label: "Mainnet",
    caip2: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
  },
] as const;

export default function Dashboard() {
  const {
    httpClient,
    authState,
    logout,
    session,
    wallets,
    ethSendTransaction,
    solSendTransaction,
    pollTransactionStatus,
  } = useTurnkey();
  const router = useRouter();

  // Guard unauthenticated users
  useEffect(() => {
    if (authState === AuthState.Unauthenticated) router.replace("/");
  }, [authState, router]);

  // --- Sign Message account selection ---
  const [selectedSignAddress, setSelectedSignAddress] = useState<
    string | undefined
  >(undefined);
  // --- Sign Message ---
  const [message, setMessage] = useState("Hello from Turnkey 👋");
  const [signing, setSigning] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [signErr, setSignErr] = useState<string | null>(null);

  // --- ETH Send ---
  const [ethTo, setEthTo] = useState("");
  const [ethAmount, setEthAmount] = useState("0.001");
  const [ethNetwork, setEthNetwork] = useState<(typeof ETH_NETWORKS)[number]>(
    ETH_NETWORKS[0],
  );
  const [ethSending, setEthSending] = useState(false);
  const [ethStatusId, setEthStatusId] = useState<string | null>(null);
  const [ethTxHash, setEthTxHash] = useState<string | null>(null);
  const [ethErr, setEthErr] = useState<string | null>(null);

  // --- SOL Send ---
  const [solTo, setSolTo] = useState("");
  const [solAmount, setSolAmount] = useState("0.001");
  const [solNetwork, setSolNetwork] = useState<(typeof SOL_NETWORKS)[number]>(
    SOL_NETWORKS[0],
  );
  const [solSending, setSolSending] = useState(false);
  const [solStatusId, setSolStatusId] = useState<string | null>(null);
  const [solTxStatus, setSolTxStatus] = useState<string | null>(null);
  const [solErr, setSolErr] = useState<string | null>(null);

  // Embedded wallets only
  const embeddedWallets = useMemo(
    () =>
      ((wallets ?? []) as Wallet[]).filter(
        (w) => w.source === WalletSource.Embedded,
      ),
    [wallets],
  );

  const evmAddresses = useMemo<string[]>(() => {
    const addrs: string[] = [];
    for (const w of embeddedWallets) {
      const accounts = (w as any)?.accounts as WalletAccount[] | undefined;
      accounts?.forEach((a: any) => {
        if (a?.addressFormat === "ADDRESS_FORMAT_ETHEREUM" && a?.address)
          addrs.push(a.address);
      });
    }
    return addrs;
  }, [embeddedWallets]);

  const solAddresses = useMemo<string[]>(() => {
    const addrs: string[] = [];
    for (const w of embeddedWallets) {
      const accounts = (w as any)?.accounts as WalletAccount[] | undefined;
      accounts?.forEach((a: any) => {
        if (a?.addressFormat === "ADDRESS_FORMAT_SOLANA" && a?.address)
          addrs.push(a.address);
      });
    }
    return addrs;
  }, [embeddedWallets]);

  const evmAddress = evmAddresses[0];
  const solAddress = solAddresses[0];

  const allAddresses = useMemo(
    () => [...evmAddresses, ...solAddresses],
    [evmAddresses, solAddresses],
  );
  const signAddress =
    selectedSignAddress && allAddresses.includes(selectedSignAddress)
      ? selectedSignAddress
      : allAddresses[0];

  const onSignMessage = async () => {
    try {
      setSignErr(null);
      setSignature(null);

      if (authState !== AuthState.Authenticated)
        throw new Error("Not authenticated.");
      if (!httpClient) throw new Error("HTTP client not ready.");
      if (!session?.organizationId) throw new Error("Missing organization id.");
      if (!signAddress) throw new Error("No account found.");
      if (!message) throw new Error("Message cannot be empty.");

      setSigning(true);

      const isEd25519 = solAddresses.includes(signAddress);
      const res = await httpClient.signRawPayload({
        organizationId: session.organizationId,
        signWith: signAddress,
        payload: message,
        encoding: "PAYLOAD_ENCODING_TEXT_UTF8",
        hashFunction: isEd25519
          ? "HASH_FUNCTION_NOT_APPLICABLE"
          : "HASH_FUNCTION_SHA256",
      });

      const activity = (res as any)?.activity;
      const r = activity?.result?.signRawPayloadResult?.r;
      const s = activity?.result?.signRawPayloadResult?.s;
      const v = activity?.result?.signRawPayloadResult?.v;
      setSignature(r && s && v ? `0x${r}${s}${v}` : "(no signature returned)");
    } catch (e: any) {
      console.error(e);
      setSignErr(e?.message ?? "Failed to sign message.");
    } finally {
      setSigning(false);
    }
  };

  const onSendEth = async () => {
    try {
      setEthErr(null);
      setEthStatusId(null);
      setEthTxHash(null);

      if (!evmAddress) throw new Error("No EVM account found.");
      if (!ethTo) throw new Error("Destination address required.");
      if (!ethAmount || isNaN(parseFloat(ethAmount)))
        throw new Error("Invalid amount.");

      setEthSending(true);

      const statusId = await ethSendTransaction({
        transaction: {
          from: evmAddress,
          to: ethTo,
          value: parseEther(ethAmount).toString(),
          caip2: ethNetwork.caip2,
          sponsor: true,
        },
      });
      setEthStatusId(statusId);

      const result = await pollTransactionStatus({
        sendTransactionStatusId: statusId,
      });
      setEthTxHash(result.eth?.txHash ?? result.txStatus);
    } catch (e: any) {
      console.error(e);
      setEthErr(e?.message ?? String(e) ?? "Failed to send ETH.");
    } finally {
      setEthSending(false);
    }
  };

  const onSendSol = async () => {
    try {
      setSolErr(null);
      setSolStatusId(null);
      setSolTxStatus(null);

      if (!solAddress) throw new Error("No Solana account found.");
      if (!solTo) throw new Error("Destination address required.");
      if (!solAmount || isNaN(parseFloat(solAmount)))
        throw new Error("Invalid amount.");

      setSolSending(true);

      const fromPubkey = new PublicKey(solAddress);
      const toPubkey = new PublicKey(solTo);
      const lamports = Math.round(parseFloat(solAmount) * 1e9);

      // recentBlockhash is required for serialization.
      // Turnkey replaces it with a fresh one at broadcast time when sponsor=true.
      const message = new TransactionMessage({
        payerKey: fromPubkey,
        recentBlockhash: "11111111111111111111111111111111",
        instructions: [
          SystemProgram.transfer({ fromPubkey, toPubkey, lamports }),
        ],
      }).compileToV0Message();
      const bytes = new VersionedTransaction(message).serialize();
      const unsignedTransaction = Array.from(bytes, (b: number) =>
        b.toString(16).padStart(2, "0"),
      ).join("");

      const statusId = await solSendTransaction({
        transaction: {
          unsignedTransaction,
          signWith: solAddress,
          caip2: solNetwork.caip2,
          sponsor: true,
        },
      });
      setSolStatusId(statusId);

      const result = await pollTransactionStatus({
        sendTransactionStatusId: statusId,
      });
      setSolTxStatus(result.eth?.txHash ?? result.txStatus);
    } catch (e: any) {
      console.error(e);
      setSolErr(e?.message ?? String(e) ?? "Failed to send SOL.");
    } finally {
      setSolSending(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      router.replace("/");
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
          {/* LEFT: Sign + Send */}
          <section className="lg:col-span-5 rounded-xl border border-gray-200 bg-white p-5 sm:p-6 shadow-sm space-y-8">
            {/* Sign Message */}
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-gray-800">
                Sign Message
              </h2>
              <AddressSelect
                label="Sign with"
                addresses={allAddresses}
                selected={signAddress}
                onChange={setSelectedSignAddress}
              />
              <label className="block text-sm font-medium text-gray-800">
                Message
                <textarea
                  className="mt-1 w-full rounded border px-3 py-2 text-sm"
                  rows={3}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </label>

              {signErr && <ErrorBox msg={signErr} />}

              <button
                onClick={onSignMessage}
                disabled={signing || !signAddress}
                className="rounded bg-blue-600 px-4 py-2 text-white text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {signing ? "Signing…" : "Sign Message"}
              </button>

              {signature && <ResultBox label="Signature" value={signature} />}
            </div>

            <hr />

            {/* ETH Send */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-gray-800">
                  Send ETH{" "}
                  <span className="text-xs font-normal text-gray-400">
                    Gas Station sponsored
                  </span>
                </h2>
                <NetworkToggle
                  networks={ETH_NETWORKS}
                  selected={ethNetwork}
                  onChange={setEthNetwork}
                />
              </div>
              <p className="text-xs text-gray-500">
                From:{" "}
                <span className="font-mono">
                  {evmAddress ?? "(no EVM account)"}
                </span>
              </p>
              <InputField
                label="To (address)"
                value={ethTo}
                onChange={setEthTo}
                placeholder="0x…"
              />
              <InputField
                label="Amount (ETH)"
                value={ethAmount}
                onChange={setEthAmount}
                placeholder="0.001"
              />

              {ethErr && <ErrorBox msg={ethErr} />}

              <button
                onClick={onSendEth}
                disabled={ethSending || !evmAddress}
                className="rounded bg-purple-700 px-4 py-2 text-sm text-white hover:bg-purple-800 disabled:opacity-50"
              >
                {ethSending ? "Sending…" : "Send ETH"}
              </button>

              {ethStatusId && (
                <ResultBox label="Status ID" value={ethStatusId} />
              )}
              {ethStatusId && ethSending && (
                <p className="text-xs text-gray-500 animate-pulse">
                  Polling for transaction result…
                </p>
              )}
              {ethTxHash && <ResultBox label="Tx Hash" value={ethTxHash} />}
            </div>

            <hr />

            {/* SOL Send */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-gray-800">
                  Send SOL{" "}
                  <span className="text-xs font-normal text-gray-400">
                    Gas Station sponsored
                  </span>
                </h2>
                <NetworkToggle
                  networks={SOL_NETWORKS}
                  selected={solNetwork}
                  onChange={setSolNetwork}
                />
              </div>
              <p className="text-xs text-gray-500">
                From:{" "}
                <span className="font-mono">
                  {solAddress ?? "(no Solana account)"}
                </span>
              </p>
              <InputField
                label="To (address)"
                value={solTo}
                onChange={setSolTo}
                placeholder="base58 address…"
              />
              <InputField
                label="Amount (SOL)"
                value={solAmount}
                onChange={setSolAmount}
                placeholder="0.001"
              />

              {solErr && <ErrorBox msg={solErr} />}

              <button
                onClick={onSendSol}
                disabled={solSending || !solAddress}
                className="rounded bg-teal-700 px-4 py-2 text-sm text-white hover:bg-teal-800 disabled:opacity-50"
              >
                {solSending ? "Sending…" : "Send SOL"}
              </button>

              {solStatusId && (
                <ResultBox label="Status ID" value={solStatusId} />
              )}
              {solStatusId && solSending && (
                <p className="text-xs text-gray-500 animate-pulse">
                  Polling for transaction result…
                </p>
              )}
              {solTxStatus && (
                <ResultBox label="Tx Signature" value={solTxStatus} />
              )}
            </div>
          </section>

          {/* RIGHT: Embedded Wallets + Suborg */}
          <section className="lg:col-span-7 rounded-xl border border-gray-200 bg-white p-5 sm:p-6 shadow-sm space-y-4">
            <h2 className="text-base font-semibold text-gray-800">
              Embedded Wallets
            </h2>

            <div className="p-3 rounded border bg-gray-50 text-left overflow-x-auto">
              <pre className="font-mono text-[11px] leading-snug min-w-[60ch]">
                {JSON.stringify(embeddedWallets, null, 2)}
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

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div className="rounded border border-red-300 bg-red-50 p-2 text-xs text-red-700">
      {msg}
    </div>
  );
}

function ResultBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border bg-gray-50 p-3 max-h-48 overflow-auto">
      <div className="mb-1 text-xs text-gray-500">{label}</div>
      <pre className="overflow-x-auto text-[11px] font-mono break-all whitespace-pre-wrap">
        {value}
      </pre>
    </div>
  );
}

function NetworkToggle<T extends { label: string; caip2: string }>({
  networks,
  selected,
  onChange,
}: {
  networks: readonly T[];
  selected: T;
  onChange: (n: T) => void;
}) {
  return (
    <div className="flex rounded border border-gray-200 overflow-hidden text-xs font-medium">
      {networks.map((n) => (
        <button
          key={n.caip2}
          onClick={() => onChange(n)}
          className={`px-2.5 py-1 transition-colors ${
            n.caip2 === selected.caip2
              ? "bg-gray-800 text-white"
              : "bg-white text-gray-500 hover:bg-gray-100"
          }`}
        >
          {n.label}
        </button>
      ))}
    </div>
  );
}

function AddressSelect({
  label,
  addresses,
  selected,
  onChange,
}: {
  label: string;
  addresses: string[];
  selected: string | undefined;
  onChange: (addr: string) => void;
}) {
  if (addresses.length === 0) {
    return (
      <p className="text-xs text-gray-500">
        {label}: <span className="font-mono">(none)</span>
      </p>
    );
  }
  if (addresses.length === 1) {
    return (
      <p className="text-xs text-gray-500">
        {label}: <span className="font-mono">{addresses[0]}</span>
      </p>
    );
  }
  return (
    <label className="block text-sm font-medium text-gray-800">
      {label}
      <select
        className="mt-1 w-full rounded border px-3 py-1.5 text-sm font-mono"
        value={selected ?? addresses[0]}
        onChange={(e) => onChange(e.target.value)}
      >
        {addresses.map((addr) => (
          <option key={addr} value={addr}>
            {addr}
          </option>
        ))}
      </select>
    </label>
  );
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block text-sm font-medium text-gray-800">
      {label}
      <input
        className="mt-1 w-full rounded border px-3 py-1.5 text-sm font-mono"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}

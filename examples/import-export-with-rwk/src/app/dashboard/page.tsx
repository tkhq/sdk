"use client";

import { useEffect, useMemo, useState } from "react";
import {
  useTurnkey,
  AuthState,
  WalletSource,
  type Wallet,
  type WalletAccount,
} from "@turnkey/react-wallet-kit";
import type { v1AddressFormat, v1Curve } from "@turnkey/sdk-types";
import { useRouter } from "next/navigation";

type PrivateKeyAddress = {
  format: string;
  address: string;
};

type PrivateKey = {
  privateKeyId: string;
  privateKeyName?: string;
  publicKey?: string;
  curve?: string;
  addresses?: PrivateKeyAddress[];
  privateKeyTags?: string[];
  createdAt?: { seconds: string; nanos: string };
  updatedAt?: unknown;
  exported?: boolean;
  imported?: boolean;
};

export default function Dashboard() {
  const turnkey = useTurnkey();
  const { authState, logout, session, wallets } = turnkey;
  const router = useRouter();

  /** ---------- Auth redirect ---------- */

  useEffect(() => {
    if (authState === AuthState.Unauthenticated) {
      router.replace("/");
    }
  }, [authState, router]);

  if (authState !== AuthState.Authenticated) {
    return <p className="p-6">Loading…</p>;
  }

  /** ---------- Embedded wallets (Turnkey-generated) ---------- */

  const embeddedWallets = useMemo(
    () =>
      (wallets ?? []).filter((w: Wallet) => w.source === WalletSource.Embedded),
    [wallets],
  );

  const [selectedWalletId, setSelectedWalletId] = useState<string | null>(null);
  const [selectedAccountAddress, setSelectedAccountAddress] = useState<
    string | null
  >(null);

  const selectedWallet: Wallet | null = useMemo(() => {
    if (!embeddedWallets.length) return null;
    const byId = embeddedWallets.find((w) => w.walletId === selectedWalletId);
    return byId ?? embeddedWallets[0] ?? null;
  }, [embeddedWallets, selectedWalletId]);

  const selectedAccount: WalletAccount | null = useMemo(() => {
    const accounts = selectedWallet?.accounts ?? [];
    if (!accounts.length) return null;

    const byAddress = accounts.find(
      (a) => a.address === selectedAccountAddress,
    );
    return byAddress ?? accounts[0] ?? null;
  }, [selectedWallet, selectedAccountAddress]);

  // Initialize default wallet & account
  useEffect(() => {
    if (!selectedWalletId && embeddedWallets.length > 0) {
      setSelectedWalletId(embeddedWallets[0].walletId);
    }
  }, [embeddedWallets, selectedWalletId]);

  useEffect(() => {
    if (
      selectedWallet &&
      selectedWallet.accounts?.length &&
      !selectedAccountAddress
    ) {
      setSelectedAccountAddress(selectedWallet.accounts[0].address);
    }
  }, [selectedWallet, selectedAccountAddress]);

  const handleExportWallet = async () => {
    if (!selectedWallet) {
      console.error("No wallet selected for export");
      return;
    }
    try {
      await turnkey.handleExportWallet({
        walletId: selectedWallet.walletId,
      });
    } catch (e) {
      console.error("handleExportWallet failed:", e);
    }
  };

  const handleExportWalletAccount = async () => {
    if (!selectedAccount?.address) {
      console.error("No wallet account selected for export");
      return;
    }

    const isSolana =
      selectedAccount.addressFormat === "ADDRESS_FORMAT_SOLANA" ||
      selectedAccount.addressFormat?.includes("SOLANA");

    try {
      await turnkey.handleExportWalletAccount({
        address: selectedAccount.address,
        // Only override for Solana; Hex is the default.
        ...(isSolana ? { keyFormat: "Solana" as any } : {}),
      });
    } catch (e) {
      console.error("handleExportWalletAccount failed:", e);
    }
  };

  const handleImportWallet = async () => {
    try {
      const defaultWalletAccounts: v1AddressFormat[] = [
        "ADDRESS_FORMAT_ETHEREUM",
        "ADDRESS_FORMAT_SOLANA",
      ];

      await turnkey.handleImportWallet({
        defaultWalletAccounts,
        successPageDuration: 5000,
      });
    } catch (e) {
      console.error("handleImportWallet failed:", e);
    }
  };

  /** ---------- Private keys (imported) ---------- */

  const [privateKeys, setPrivateKeys] = useState<PrivateKey[]>([]);
  const [selectedPrivateKeyId, setSelectedPrivateKeyId] = useState<
    string | null
  >(null);
  const [pkLoading, setPkLoading] = useState(false);
  const [pkError, setPkError] = useState<string | null>(null);

  // Import config (user-configurable)
  const [pkCurve, setPkCurve] = useState<v1Curve>("CURVE_SECP256K1");
  const [pkAddressFormatsInput, setPkAddressFormatsInput] = useState<string>(
    "ADDRESS_FORMAT_ETHEREUM",
  );

  const selectedPrivateKey = useMemo(
    () =>
      privateKeys.find((pk) => pk.privateKeyId === selectedPrivateKeyId) ??
      null,
    [privateKeys, selectedPrivateKeyId],
  );

  // Load private keys when authenticated
  useEffect(() => {
    let cancelled = false;

    async function loadPrivateKeys() {
      if (authState !== AuthState.Authenticated) {
        setPrivateKeys([]);
        setSelectedPrivateKeyId(null);
        return;
      }

      setPkLoading(true);
      setPkError(null);
      try {
        const keys = (await turnkey.fetchPrivateKeys?.()) as
          | PrivateKey[]
          | undefined;
        if (!cancelled && keys) {
          setPrivateKeys(keys);
          const first = keys[0];
          if (first?.privateKeyId) {
            setSelectedPrivateKeyId(first.privateKeyId);
          }
        }
      } catch (e: any) {
        console.error("Failed to fetch private keys", e);
        if (!cancelled) {
          setPkError(e?.message ?? "Failed to fetch private keys.");
        }
      } finally {
        if (!cancelled) setPkLoading(false);
      }
    }

    loadPrivateKeys();

    return () => {
      cancelled = true;
    };
  }, [authState, turnkey]);

  const isSolanaPrivateKey = (pk: PrivateKey): boolean => {
    const addrs = pk.addresses ?? [];
    return addrs.some(
      (a) =>
        a.format === "ADDRESS_FORMAT_SOLANA" || a.format.includes("SOLANA"),
    );
  };

  const onExportPrivateKey = async () => {
    if (!selectedPrivateKeyId) {
      setPkError("Select a private key first.");
      return;
    }

    const pk = privateKeys.find((k) => k.privateKeyId === selectedPrivateKeyId);
    const sol = pk ? isSolanaPrivateKey(pk) : false;

    const keyFormat: "Hexadecimal" | "Solana" = sol ? "Solana" : "Hexadecimal";

    try {
      setPkError(null);
      await turnkey.handleExportPrivateKey({
        privateKeyId: selectedPrivateKeyId,
        keyFormat,
      } as any);
    } catch (e: any) {
      console.error("Failed to export private key", e);
      setPkError(e?.message ?? "Failed to export private key.");
    }
  };

  // Import private key using user-provided curve + address formats
  const onImportPrivateKey = async () => {
    try {
      setPkError(null);

      const rawFormats = pkAddressFormatsInput
        .split(",")
        .map((f) => f.trim())
        .filter(Boolean);

      if (rawFormats.length === 0) {
        setPkError("Please specify at least one address format.");
        return;
      }

      const addressFormats = rawFormats as v1AddressFormat[];
      const curve = pkCurve as v1Curve;

      const newPrivateKeyId = await turnkey.handleImportPrivateKey({
        curve,
        addressFormats,
        successPageDuration: 4000,
      } as any);

      const keys = (await turnkey.fetchPrivateKeys?.()) as
        | PrivateKey[]
        | undefined;
      if (keys) {
        setPrivateKeys(keys);
        if (newPrivateKeyId) {
          setSelectedPrivateKeyId(newPrivateKeyId);
        }
      }
    } catch (e: any) {
      console.error("Failed to import private key", e);
      setPkError(e?.message ?? "Failed to import private key.");
    }
  };

  /** ---------- Logout ---------- */

  const handleLogout = async () => {
    try {
      await logout();
      window.location.replace("/");
    } catch (e) {
      console.error("Logout failed:", e);
    }
  };

  /** ---------- Render ---------- */

  return (
    <main className="relative min-h-screen p-6 sm:p-8 bg-gray-50">
      <button
        onClick={handleLogout}
        className="absolute top-4 right-4 rounded bg-red-600 px-3 py-1.5 text-white text-xs sm:text-sm hover:bg-red-700"
      >
        Logout
      </button>

      <div className="mx-auto mt-10 max-w-screen-xl px-4 space-y-8">
        <h1 className="text-xl font-semibold">
          Import / Export: Wallets, Wallet Accounts & Private Keys
        </h1>

        {/* ===== Section 1: Embedded Wallets ===== */}
        <section className="rounded-xl border border-gray-200 bg-white p-5 sm:p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-800 mb-4">
            Wallets & Wallet Accounts
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* LEFT: Wallet IDs */}
            <div className="lg:col-span-1 space-y-2">
              <p className="text-[11px] text-gray-500">
                Select a wallet to see its accounts and export options.
              </p>

              {embeddedWallets.length === 0 ? (
                <p className="text-xs text-gray-500">
                  No embedded wallets found.
                </p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-auto">
                  {embeddedWallets.map((wallet) => {
                    const active = wallet.walletId === selectedWallet?.walletId;
                    return (
                      <button
                        key={wallet.walletId}
                        onClick={() => {
                          setSelectedWalletId(wallet.walletId);
                          const firstAccount = wallet.accounts?.[0];
                          setSelectedAccountAddress(
                            firstAccount?.address ?? null,
                          );
                        }}
                        className={`w-full text-left rounded border px-3 py-2 text-xs transition ${
                          active
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-200 bg-gray-50 hover:bg-gray-100"
                        }`}
                      >
                        <div className="font-medium text-gray-800">
                          {wallet.walletName || "Untitled Wallet"}
                        </div>
                        <div className="text-[10px] text-gray-500 break-all">
                          ID: {wallet.walletId}
                        </div>
                        <div className="mt-1 text-[10px] text-gray-500">
                          {wallet.accounts?.length ?? 0} account
                          {(wallet.accounts?.length ?? 0) === 1 ? "" : "s"}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* RIGHT: Accounts + export buttons */}
            <div className="lg:col-span-2 space-y-4">
              <div className="text-xs text-gray-600">
                <div>
                  <span className="font-semibold">Selected wallet:</span>{" "}
                  <span className="font-mono">
                    {selectedWallet?.walletName ?? "—"}
                  </span>
                </div>
                <div className="mt-1">
                  <span className="font-semibold">Sub-org ID:</span>{" "}
                  <span className="font-mono">
                    {session?.organizationId ?? "—"}
                  </span>
                </div>
              </div>

              <div className="border rounded-lg bg-gray-50 p-3 space-y-2 max-h-60 overflow-auto">
                <div className="text-[11px] font-semibold text-gray-700 mb-1">
                  Wallet Accounts
                </div>
                {!selectedWallet?.accounts?.length ? (
                  <p className="text-[11px] text-gray-500">
                    This wallet has no accounts.
                  </p>
                ) : (
                  selectedWallet.accounts.map((account) => {
                    const active = account.address === selectedAccount?.address;
                    return (
                      <button
                        key={account.address}
                        onClick={() =>
                          setSelectedAccountAddress(account.address)
                        }
                        className={`w-full text-left rounded border px-3 py-2 text-[11px] transition ${
                          active
                            ? "border-indigo-500 bg-indigo-50"
                            : "border-gray-200 bg-white hover:bg-gray-100"
                        }`}
                      >
                        <div className="font-mono break-all">
                          {account.address}
                        </div>
                        <div className="mt-1 text-[10px] text-gray-500">
                          {account.addressFormat}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleExportWallet}
                  disabled={!selectedWallet}
                  className="rounded bg-indigo-600 px-3 py-1.5 text-[11px] text-white hover:bg-indigo-700 disabled:opacity-40"
                >
                  Export Selected Wallet
                </button>
                <button
                  onClick={handleExportWalletAccount}
                  disabled={!selectedAccount}
                  className="rounded bg-indigo-600 px-3 py-1.5 text-[11px] text-white hover:bg-indigo-700 disabled:opacity-40"
                >
                  Export Selected Wallet Account
                </button>
                <button
                  onClick={handleImportWallet}
                  className="rounded bg-green-600 px-3 py-1.5 text-[11px] text-white hover:bg-green-700"
                >
                  Import Wallet Seed
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ===== Section 2: Private Keys ===== */}
        <section className="rounded-xl border border-gray-200 bg-white p-5 sm:p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-800 mb-4">
            Private Keys
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* LEFT: Private key list */}
            <div className="lg:col-span-1 space-y-2">
              <p className="text-[11px] text-gray-500">
                Select to export a raw private key or import one from external
                sources.
              </p>

              {pkLoading && (
                <p className="text-[11px] text-gray-500">Loading keys…</p>
              )}

              {pkError && (
                <div className="rounded border border-red-300 bg-red-50 p-2 text-[11px] text-red-700">
                  {pkError}
                </div>
              )}

              {privateKeys.length === 0 ? (
                <p className="text-xs text-gray-500">
                  No private keys found. Use the right-hand form to import one.
                </p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-auto">
                  {privateKeys.map((pk) => {
                    const active = pk.privateKeyId === selectedPrivateKeyId;
                    return (
                      <button
                        key={pk.privateKeyId}
                        onClick={() => setSelectedPrivateKeyId(pk.privateKeyId)}
                        className={`w-full text-left rounded border px-3 py-2 text-xs transition ${
                          active
                            ? "border-purple-600 bg-purple-50"
                            : "border-gray-200 bg-gray-50 hover:bg-gray-100"
                        }`}
                      >
                        <div className="font-medium text-gray-800 truncate">
                          {pk.privateKeyName ?? "Private key"}
                        </div>
                        <div className="text-[10px] text-gray-500 break-all">
                          ID: {pk.privateKeyId}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* RIGHT: Selected key details + import/export */}
            <div className="lg:col-span-2 space-y-4">
              {/* Selected key details */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-gray-700">
                  Selected Private Key
                </div>
                {!selectedPrivateKey ? (
                  <p className="text-[11px] text-gray-500">
                    Select a private key on the left to see details.
                  </p>
                ) : (
                  <div className="rounded border bg-gray-50 p-3 text-xs space-y-1">
                    <div>
                      <span className="font-semibold">Name:</span>{" "}
                      <span>
                        {selectedPrivateKey.privateKeyName ?? "(unnamed)"}
                      </span>
                    </div>
                    <div className="break-all">
                      <span className="font-semibold">Private Key ID:</span>{" "}
                      <span className="font-mono">
                        {selectedPrivateKey.privateKeyId}
                      </span>
                    </div>
                    {selectedPrivateKey.addresses &&
                    selectedPrivateKey.addresses.length > 0 ? (
                      <>
                        <div className="font-mono break-all">
                          <span className="font-semibold">Address Format:</span>{" "}
                          {selectedPrivateKey.addresses[0].format}
                        </div>
                        <div className="font-mono break-all">
                          <span className="font-semibold">Address:</span>{" "}
                          {selectedPrivateKey.addresses[0].address}
                        </div>
                      </>
                    ) : (
                      <div className="text-gray-500">(no address)</div>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  onClick={onExportPrivateKey}
                  disabled={!selectedPrivateKeyId}
                  className="rounded bg-purple-700 px-3 py-1.5 text-[11px] text-white hover:bg-purple-800 disabled:opacity-50"
                >
                  Export Selected Private Key
                </button>
              </div>

              {/* Import key form */}
              <div className="border-t border-gray-200 pt-4 space-y-3">
                <div className="text-xs font-semibold text-gray-700">
                  Import New Private Key
                </div>
                <p className="text-[11px] text-gray-500">
                  Configure the <code className="font-mono">curve</code> and{" "}
                  <code className="font-mono">addressFormats</code> for the new
                  key, then open the import modal.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-[11px] text-gray-600">
                      Curve
                    </label>
                    <select
                      className="w-full rounded border px-2 py-1 text-[11px]"
                      value={pkCurve}
                      onChange={(e) => setPkCurve(e.target.value as v1Curve)}
                    >
                      <option value="CURVE_SECP256K1">
                        CURVE_SECP256K1 (secp256k1)
                      </option>
                      <option value="CURVE_ED25519">
                        CURVE_ED25519 (ed25519)
                      </option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] text-gray-600">
                      Address format
                    </label>
                    <input
                      className="w-full rounded border px-2 py-1 text-[11px] font-mono"
                      value={pkAddressFormatsInput}
                      onChange={(e) => setPkAddressFormatsInput(e.target.value)}
                      placeholder="e.g. ADDRESS_FORMAT_ETHEREUM, ADDRESS_FORMAT_SOLANA"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onImportPrivateKey}
                  className="mt-2 rounded bg-indigo-600 px-3 py-1.5 text-[11px] text-white hover:bg-indigo-700"
                >
                  Import Private Key
                </button>

                <p className="mt-1 text-[10px] text-gray-500">
                  <code className="font-mono">handleImportPrivateKey</code>{" "}
                  requires both a <code className="font-mono">curve</code> (e.g.{" "}
                  <code className="font-mono">CURVE_SECP256K1</code>,{" "}
                  <code className="font-mono">CURVE_ED25519</code>) and at least
                  one <code className="font-mono">addressFormat</code> (e.g.{" "}
                  <code className="font-mono">ADDRESS_FORMAT_ETHEREUM</code>,{" "}
                  <code className="font-mono">ADDRESS_FORMAT_SOLANA</code>,{" "}
                  <code className="font-mono">
                    ADDRESS_FORMAT_BITCOIN_MAINNET_P2WPKH
                  </code>
                  ).
                  <br />
                  See{" "}
                  <a
                    href="https://docs.turnkey.com/concepts/wallets#address-formats-and-curves"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    Turnkey Wallets — Address Formats & Curves
                  </a>{" "}
                  for more details.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

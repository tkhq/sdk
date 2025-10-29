"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useTurnkey } from "@turnkey/react-wallet-kit";
import type { WalletProvider } from "@turnkey/core";
import { sendSignedRequest } from "@turnkey/core/dist/utils";
import { getSuborgsAction, createSuborgAction } from "@/server/actions/turnkey";

type CurveType = "API_KEY_CURVE_ED25519" | "API_KEY_CURVE_SECP256K1";

export default function AuthPage() {
  const router = useRouter();
  const { fetchWalletProviders, buildWalletLoginRequest, storeSession } =
    useTurnkey();

  // UI state
  const [err, setErr] = useState<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);

  // Selector state
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [providers, setProviders] = useState<WalletProvider[]>([]);
  const [selectedWalletName, setSelectedWalletName] = useState<string | null>(
    null,
  );

  // Group providers by wallet name
  const providerGroups = useMemo(() => {
    return providers.reduce(
      (acc, p) => {
        const key = p.info.name || "Unknown";
        (acc[key] ||= []).push(p);
        return acc;
      },
      {} as Record<string, WalletProvider[]>,
    );
  }, [providers]);

  const openSelector = async () => {
    setErr(null);
    setSelectedWalletName(null);
    setSelectorOpen(true);
    setLoadingProviders(true);
    try {
      const list = (await fetchWalletProviders()) ?? [];
      setProviders(list);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load wallet providers.");
    } finally {
      setLoadingProviders(false);
    }
  };

  const closeSelector = () => {
    setSelectorOpen(false);
    setSelectedWalletName(null);
  };

  const handlePickWalletName = (name: string) => {
    const variants = providerGroups[name] || [];
    if (variants.length === 1) {
      void handleProviderVariant(variants[0]);
    } else {
      setSelectedWalletName(name);
    }
  };

  const variantLabel = (p: WalletProvider) =>
    `${p.chainInfo.namespace.toUpperCase()} · ${p.interfaceType}`;

  const handleProviderVariant = async (provider: WalletProvider) => {
    setErr(null);
    setWorking(`Connecting to ${provider.info.name}…`);
    closeSelector();

    try {
      // Build wallet login request
      const { signedRequest, publicKey } = await buildWalletLoginRequest({
        walletProvider: provider,
      });
      if (!publicKey) throw new Error("Could not derive wallet public key.");

      // Curve type from chain
      const curveType: CurveType =
        provider.chainInfo.namespace === "solana"
          ? "API_KEY_CURVE_ED25519"
          : "API_KEY_CURVE_SECP256K1";

      // Find or create sub-org bound to this wallet public key
      let suborgId = (await getSuborgsAction({ publicKey }))
        ?.organizationIds?.[0];
      if (!suborgId) {
        const created = await createSuborgAction({ publicKey, curveType });
        suborgId = created.subOrganizationId;
      }

      // Send the signed request → get session
      setWorking("Finishing sign-in…");
      const resp = await sendSignedRequest(signedRequest);
      const sessionToken = resp?.activity?.result?.stampLoginResult?.session;
      if (!sessionToken)
        throw new Error("Session token not found in the response.");

      await storeSession({ sessionToken });
      router.replace("/dashboard");
    } catch (e: any) {
      console.error(e);
      setErr(e?.message || "Login failed.");
    } finally {
      setWorking(null);
    }
  };

  return (
    <main className="relative min-h-screen bg-gray-50">
      <header className="absolute top-5 left-5">
        <a href="https://www.turnkey.com" target="_blank" rel="noreferrer">
          <Image
            src="/logo.svg"
            alt="Turnkey"
            width={100}
            height={24}
            priority
            style={{ height: "24px", width: "auto" }}
          />
        </a>
      </header>

      <div className="mx-auto max-w-screen-sm px-4 pt-28">
        <section className="rounded-xl border border-gray-200 bg-white p-6 sm:p-7 shadow-sm">
          <h1 className="text-lg sm:text-xl font-semibold text-gray-900">
            Sign in or sign-up with your wallet
          </h1>
          {err && (
            <div className="mt-4 rounded border border-red-300 bg-red-50 p-2 text-xs text-red-700">
              {err}
            </div>
          )}

          <div className="mt-6 flex items-center justify-center">
            <button
              onClick={openSelector}
              disabled={!!working}
              className="rounded bg-blue-600 px-4 py-2 text-white text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {working ? "Working…" : "Continue with wallet"}
            </button>
          </div>
        </section>
      </div>

      {/* Selector overlay */}
      {selectorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-gray-900">
                {selectedWalletName
                  ? "Choose a network"
                  : "Select wallet provider"}
              </h2>
              <button
                onClick={closeSelector}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Close
              </button>
            </div>

            {loadingProviders ? (
              <div className="text-sm text-gray-600">Loading wallets…</div>
            ) : selectedWalletName ? (
              <div className="space-y-2">
                {(providerGroups[selectedWalletName] || []).map((p) => (
                  <button
                    key={`${p.info.name}-${p.chainInfo.namespace}-${p.interfaceType}`}
                    onClick={() => handleProviderVariant(p)}
                    className="w-full flex items-center gap-3 rounded border border-gray-200 p-3 hover:bg-gray-50"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.info.icon || ""}
                      alt={p.info.name}
                      className="h-6 w-6 rounded-full"
                    />
                    <div className="flex flex-col items-start">
                      <div className="text-sm font-medium text-gray-900">
                        {p.info.name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {variantLabel(p)}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Object.keys(providerGroups).map((name) => {
                  const first = providerGroups[name][0];
                  return (
                    <button
                      key={name}
                      onClick={() => handlePickWalletName(name)}
                      className="w-full flex items-center gap-3 rounded border border-gray-200 p-3 hover:bg-gray-50"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={first.info.icon || ""}
                        alt={name}
                        className="h-6 w-6 rounded-full"
                      />
                      <div className="text-sm font-medium text-gray-800">
                        {name}
                      </div>
                      {providerGroups[name].length > 1 && (
                        <span className="ml-auto text-[10px] rounded bg-gray-100 px-2 py-0.5 text-gray-600">
                          multiple
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

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
import { proxySignedRequestAction } from "@/server/actions/proxy";

export default function Dashboard() {
  const { authState, logout, session, wallets, httpClient } = useTurnkey();
  const router = useRouter();

  useEffect(() => {
    if (authState === AuthState.Unauthenticated) router.replace("/");
  }, [authState, router]);

  // Only embedded wallet accounts
  const embeddedAccounts = useMemo(() => {
    return (wallets ?? [])
      .filter((w: Wallet) => w.source === WalletSource.Embedded)
      .flatMap((w) =>
        (w.accounts ?? []).map((a) => ({
          walletName: w.walletName,
          address: a.address,
          account: a,
        })),
      );
  }, [wallets]);

  const [selectedAccount, setSelectedAccount] = useState<WalletAccount | null>(
    null,
  );

  useEffect(() => {
    if (!selectedAccount && embeddedAccounts.length > 0) {
      setSelectedAccount(embeddedAccounts[0].account);
    }
  }, [embeddedAccounts, selectedAccount]);

  /** ---- Proxy Signing ---- */
  const [payload, setPayload] = useState("Hello from Turnkey");
  const [proxying, setProxying] = useState(false);
  const [stampedRequest, setStampedRequest] = useState<{
    url: string;
    body: string;
    stampHeaderValue: string;
  } | null>(null);
  const [proxyResult, setProxyResult] = useState<string | null>(null);
  const [proxyErr, setProxyErr] = useState<string | null>(null);

  const onProxySign = async () => {
    try {
      setProxyErr(null);
      setProxyResult(null);
      setStampedRequest(null);

      if (!session?.organizationId) throw new Error("Missing organization id.");
      if (!selectedAccount) throw new Error("No account selected.");
      if (!payload.trim()) throw new Error("Payload cannot be empty.");
      if (!httpClient) throw new Error("Turnkey client not ready.");

      setProxying(true);

      // Step 1: Client stamps the request locally using the session key stored in indexedDB
      const signed = await httpClient.stampSignRawPayload({
        organizationId: session.organizationId,
        signWith: selectedAccount.address,
        payload: payload.trim(),
        encoding: "PAYLOAD_ENCODING_TEXT_UTF8",
        hashFunction: "HASH_FUNCTION_SHA256",
      });

      if (!signed) throw new Error("Stamping failed — missing stamper.");

      const { url, body, stamp } = signed;
      const stampHeaderValue =
        typeof stamp === "string" ? stamp : stamp?.stampHeaderValue;

      if (!stampHeaderValue) throw new Error("Missing X-Stamp header value.");

      // Show what was stamped before forwarding
      setStampedRequest({ url, body, stampHeaderValue });

      // Step 2: Server forwards the stamped request to Turnkey
      const result = await proxySignedRequestAction({
        url,
        body,
        stampHeaderValue,
      });

      // Extract signature from result
      const { r, s, v } = result?.activity?.result?.signRawPayloadResult ?? {};
      const sig = r && s && v ? `0x${r}${s}${v}` : null;

      setProxyResult(
        JSON.stringify(
          {
            signature: sig ?? "(not found)",
            activityId: result?.activity?.id,
            activityStatus: result?.activity?.status,
          },
          null,
          2,
        ),
      );
    } catch (e: any) {
      console.error(e);
      setProxyErr(e?.message ?? "Proxy signing failed.");
    } finally {
      setProxying(false);
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
          {/* LEFT: Proxy Signing */}
          <section className="lg:col-span-6 rounded-xl border border-gray-200 bg-white p-5 sm:p-6 shadow-sm space-y-6">
            <div>
              <h2 className="text-base font-semibold text-gray-800">
                Proxy Signed Request
              </h2>
              <p className="mt-1 text-xs text-gray-500">
                The client stamps the request with its session key, then sends{" "}
                <code className="font-mono">{"{ url, body, stamp }"}</code> to
                your server. The server forwards it to Turnkey — the user&apos;s
                private key never leaves the browser.
              </p>
            </div>

            {/* Account selector */}
            <div>
              <label className="block text-sm font-medium text-gray-800">
                Sign with
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
                    {a.walletName} — {a.address.slice(0, 10)}…
                  </option>
                ))}
              </select>
            </div>

            {/* Payload input */}
            <div>
              <label className="block text-sm font-medium text-gray-800">
                Payload
                <textarea
                  className="mt-1 w-full rounded border px-3 py-2 text-sm font-mono"
                  rows={3}
                  value={payload}
                  onChange={(e) => setPayload(e.target.value)}
                  disabled={proxying}
                />
              </label>
            </div>

            {proxyErr && (
              <div className="rounded border border-red-300 bg-red-50 p-2 text-xs text-red-700">
                {proxyErr}
              </div>
            )}

            <button
              onClick={onProxySign}
              disabled={proxying || !selectedAccount}
              className="rounded bg-blue-600 px-4 py-2 text-white text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {proxying ? "Signing…" : "Stamp & Proxy to Server"}
            </button>

            {/* Stamped request details */}
            {stampedRequest && (
              <div className="space-y-3">
                <div className="rounded border bg-gray-50 p-3">
                  <div className="mb-1 text-xs font-medium text-gray-500">
                    1. Stamped by client (sent to server action)
                  </div>
                  <pre className="overflow-x-auto text-[11px] font-mono break-all whitespace-pre-wrap text-gray-700">
                    {JSON.stringify(
                      {
                        url: stampedRequest.url,
                        "X-Stamp": stampedRequest.stampHeaderValue,
                        body: JSON.parse(stampedRequest.body),
                      },
                      null,
                      2,
                    )}
                  </pre>
                </div>

                {proxyResult && (
                  <div className="rounded border bg-gray-50 p-3">
                    <div className="mb-1 text-xs font-medium text-gray-500">
                      2. Response from Turnkey (via server proxy)
                    </div>
                    <pre className="overflow-x-auto text-[11px] font-mono break-all whitespace-pre-wrap text-gray-700">
                      {proxyResult}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* RIGHT: Wallets + Session info */}
          <section className="lg:col-span-6 rounded-xl border border-gray-200 bg-white p-5 sm:p-6 shadow-sm space-y-4">
            <h2 className="text-base font-semibold text-gray-800">
              Embedded Wallets
            </h2>

            <div className="p-3 rounded border bg-gray-50 overflow-x-auto">
              <pre className="font-mono text-[11px] leading-snug">
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

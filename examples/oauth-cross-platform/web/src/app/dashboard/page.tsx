"use client";

import { useEffect, useState } from "react";
import { useTurnkey, AuthState } from "@turnkey/react-wallet-kit";
import { useRouter } from "next/navigation";
import { verifyPlatformAction } from "@/server/actions/turnkey";

const WEB_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
const IOS_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? "";
const ANDROID_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? "";

type OauthClaims = { iss: string; sub: string };

type Platform = {
  label: string;
  clientId: string;
  verified: boolean;
};

export default function Dashboard() {
  const { authState, logout, session } = useTurnkey();
  const router = useRouter();

  const [claims, setClaims] = useState<OauthClaims | null>(null);
  const [isNewAccount, setIsNewAccount] = useState<boolean | null>(null);
  const [verifyResults, setVerifyResults] = useState<Record<string, string | null>>({});
  const [verifying, setVerifying] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (authState === AuthState.Unauthenticated) router.replace("/");
  }, [authState, router]);

  useEffect(() => {
    const stored = sessionStorage.getItem("tk_oauth_claims");
    if (stored) {
      try {
        setClaims(JSON.parse(stored));
      } catch {
        // ignore
      }
    }
    setIsNewAccount(sessionStorage.getItem("tk_is_new_account") === "true");
  }, []);

  const platforms: Platform[] = [
    { label: "Web", clientId: WEB_CLIENT_ID, verified: true },
    ...(IOS_CLIENT_ID ? [{ label: "iOS", clientId: IOS_CLIENT_ID, verified: false }] : []),
    ...(ANDROID_CLIENT_ID ? [{ label: "Android", clientId: ANDROID_CLIENT_ID, verified: false }] : []),
  ];

  const handleVerify = async (platform: Platform) => {
    if (!claims) return;
    setVerifying((v) => ({ ...v, [platform.label]: true }));
    try {
      const result = await verifyPlatformAction({
        iss: claims.iss,
        sub: claims.sub,
        aud: platform.clientId,
      });
      const orgId = result.organizationIds?.[0];
      setVerifyResults((r) => ({
        ...r,
        [platform.label]: orgId ?? "not found",
      }));
    } catch (e: unknown) {
      setVerifyResults((r) => ({
        ...r,
        [platform.label]: e instanceof Error ? e.message : "error",
      }));
    } finally {
      setVerifying((v) => ({ ...v, [platform.label]: false }));
    }
  };

  const handleLogout = async () => {
    sessionStorage.removeItem("tk_oauth_claims");
    await logout();
    router.replace("/");
  };

  if (authState !== AuthState.Authenticated) {
    return <p className="p-8 text-sm text-gray-500">Loading…</p>;
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6 sm:p-8">
      <div className="mx-auto max-w-2xl space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-900">Cross-Platform Identities</h1>
          <button
            onClick={handleLogout}
            className="rounded bg-red-600 px-3 py-1.5 text-xs text-white hover:bg-red-700"
          >
            Logout
          </button>
        </div>

        {/* Sub-org + Google subject */}
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-3">
          <Row label="Sub-org ID" value={session?.organizationId ?? "—"} mono />
          {claims && (
            <>
              <Row label="Google subject (sub)" value={claims.sub} mono />
              <Row label="Issuer (iss)" value={claims.iss} mono />
            </>
          )}
        </section>

        {/* Platform identities */}
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Registered platforms</h2>
          <div className="space-y-3">
            {platforms.map((p) => (
              <div
                key={p.label}
                className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3"
              >
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-800">{p.label}</span>
                    {p.verified ? (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                        verified
                      </span>
                    ) : (
                      <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
                        unverified claim
                      </span>
                    )}
                  </div>
                  <p className="font-mono text-xs text-gray-500 truncate">{p.clientId}</p>
                </div>

                {!p.verified && claims && (
                  <button
                    onClick={() => handleVerify(p)}
                    disabled={verifying[p.label]}
                    className="shrink-0 rounded bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {verifying[p.label] ? "Checking…" : "Verify access"}
                  </button>
                )}
              </div>
            ))}
          </div>

          {!claims && (
            <p className="mt-3 text-xs text-gray-400">
              Sign out and back in to load identity claims.
            </p>
          )}
        </section>

        {/* Verify results */}
        {Object.keys(verifyResults).length > 0 && (
          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Verification results</h2>
            <div className="space-y-2">
              {Object.entries(verifyResults).map(([platform, orgId]) => (
                <div key={platform} className="rounded-lg bg-gray-50 border border-gray-100 p-3">
                  <div className="text-xs font-medium text-gray-600 mb-1">{platform}</div>
                  {orgId && orgId !== "not found" ? (
                    <>
                      <p className="text-xs text-green-700 font-medium mb-1">
                        Found — same sub-org
                      </p>
                      <p className="font-mono text-xs text-gray-500 break-all">{orgId}</p>
                    </>
                  ) : (
                    <p className="text-xs text-red-600">{orgId ?? "not found"}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Existing account warning */}
        {isNewAccount === false && platforms.length > 1 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <span className="font-semibold">Existing account detected.</span> Secondary platform
            identities are registered at sign-up time. To test cross-platform verification,
            sign up with another account. Alternatively, if you are using a test organization you can delete this sub-org and sign up again.
          </div>
        )}

        {/* No secondary platforms configured */}
        {platforms.length === 1 && (
          <div className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-500 text-center">
            Add <code className="bg-gray-100 px-1 rounded text-xs">NEXT_PUBLIC_GOOGLE_IOS_CLIENT_ID</code> and/or{" "}
            <code className="bg-gray-100 px-1 rounded text-xs">NEXT_PUBLIC_GOOGLE_ANDROID_CLIENT_ID</code> to{" "}
            <code className="bg-gray-100 px-1 rounded text-xs">.env.local</code> to see cross-platform identities.
          </div>
        )}
      </div>
    </main>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className={`text-xs break-all ${mono ? "font-mono text-gray-700" : "text-gray-800"}`}>
        {value}
      </p>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useTurnkey, AuthState } from "@turnkey/react-wallet-kit";
import { useRouter } from "next/navigation";
import { verifyPlatformAction } from "@/server/actions/turnkey";
import { Header } from "@/components/Header";
import { OidcCard } from "@/components/OidcCard";
import { SubOrgCard } from "@/components/SubOrgCard";
import { ExistingAccountWarning } from "@/components/ExistingAccountWarning";
import { PlatformsCard } from "@/components/PlatformsCard";
import { VerificationModal } from "@/components/VerificationModal";

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
  const { authState, session, wallets } = useTurnkey();
  const router = useRouter();

  const [claims, setClaims] = useState<OauthClaims | null>(null);
  const [isNewAccount, setIsNewAccount] = useState<boolean | null>(null);
  const [modalResult, setModalResult] = useState<{ platform: string; orgId: string | null } | null>(null);
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
      setModalResult({ platform: platform.label, orgId: orgId ?? "not found" });
    } catch (e: unknown) {
      setModalResult({ platform: platform.label, orgId: e instanceof Error ? e.message : "error" });
    } finally {
      setVerifying((v) => ({ ...v, [platform.label]: false }));
    }
  };


  return (
    <>
      {modalResult && (
        <VerificationModal
          platform={modalResult.platform}
          orgId={modalResult.orgId}
          onClose={() => setModalResult(null)}
        />
      )}
      <main className="min-h-screen bg-gray-50 p-6 sm:p-8">
        <div className="mx-auto max-w-2xl space-y-6">

          <Header />

          <SubOrgCard subOrgId={session?.organizationId ?? "—"} userId={session?.userId ?? "—"} wallets={wallets ?? []} />
          <OidcCard aud={WEB_CLIENT_ID} claims={claims} />

          <PlatformsCard
            platforms={platforms}
            hasClaims={!!claims}
            verifying={verifying}
            onVerify={handleVerify}
          />


          {isNewAccount === false && platforms.length > 1 && <ExistingAccountWarning />}

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
    </>
  );
}

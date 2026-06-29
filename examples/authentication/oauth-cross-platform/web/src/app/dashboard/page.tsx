"use client";

import { useEffect, useState } from "react";
import { useTurnkey, AuthState, ClientState } from "@turnkey/react-wallet-kit";
import { useRouter } from "next/navigation";
import { Header } from "@/components/Header";
import { OidcCard } from "@/components/OidcCard";
import { SubOrgCard } from "@/components/SubOrgCard";
import { LinkedPlatformsCard } from "@/components/LinkedPlatformsCard";
import { Loading } from "@/components/Loading";

const WEB_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
const IOS_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? "";
const ANDROID_CLIENT_ID =
  process.env.NEXT_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? "";

type OauthClaims = { iss: string; sub: string };

type Platform = {
  label: string;
  clientId: string;
  verified: boolean;
};

export default function Dashboard() {
  const { authState, clientState, session, wallets } = useTurnkey();
  const router = useRouter();

  const [dataReady, setDataReady] = useState(false);
  const [claims, setClaims] = useState<OauthClaims | null>(null);
  const [isNewAccount, setIsNewAccount] = useState<boolean | null>(null);

  useEffect(() => {
    if (
      clientState === ClientState.Ready &&
      authState === AuthState.Unauthenticated
    ) {
      router.replace("/");
    }
  }, [authState, clientState, router]);

  useEffect(() => {
    if (
      clientState === ClientState.Ready &&
      authState === AuthState.Authenticated &&
      wallets.length > 0
    ) {
      setDataReady(true);
    }
  }, [clientState, authState, wallets]);

  useEffect(() => {
    const stored = sessionStorage.getItem("tk_oauth_claims");
    if (stored) {
      setClaims(JSON.parse(stored));
    }
    setIsNewAccount(sessionStorage.getItem("tk_is_new_account") === "true");
  }, []);

  const platforms: Platform[] = [
    { label: "Web", clientId: WEB_CLIENT_ID, verified: true },
    ...(IOS_CLIENT_ID
      ? [{ label: "iOS", clientId: IOS_CLIENT_ID, verified: false }]
      : []),
    ...(ANDROID_CLIENT_ID
      ? [{ label: "Android", clientId: ANDROID_CLIENT_ID, verified: false }]
      : []),
  ];

  return (
    <>
      {!dataReady ? (
        <Loading />
      ) : (
        <main className="min-h-screen bg-gray-50 p-6 sm:p-8">
          <div className="mx-auto max-w-2xl space-y-6">
            <Header />

            <SubOrgCard
              subOrgId={session?.organizationId ?? "—"}
              userId={session?.userId ?? "—"}
              wallets={wallets ?? []}
            />
            <OidcCard aud={WEB_CLIENT_ID} claims={claims} />

            <LinkedPlatformsCard
              platforms={platforms}
              claims={claims}
              currentSubOrgId={session?.organizationId}
              isNewAccount={isNewAccount}
            />

            {/* No secondary platforms configured */}
            {platforms.length === 1 && (
              <div className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-500 text-center">
                Add{" "}
                <code className="bg-gray-100 px-1 rounded text-xs">
                  NEXT_PUBLIC_GOOGLE_IOS_CLIENT_ID
                </code>{" "}
                and/or{" "}
                <code className="bg-gray-100 px-1 rounded text-xs">
                  NEXT_PUBLIC_GOOGLE_ANDROID_CLIENT_ID
                </code>{" "}
                to{" "}
                <code className="bg-gray-100 px-1 rounded text-xs">
                  .env.local
                </code>{" "}
                to see cross-platform identities.
              </div>
            )}
          </div>
        </main>
      )}
    </>
  );
}

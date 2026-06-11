// app/providers.tsx
"use client";
import { useRouter } from "next/navigation";
import {
  TurnkeyProvider,
  type TurnkeyProviderConfig,
} from "@turnkey/react-wallet-kit";

export function Providers({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const config: TurnkeyProviderConfig = {
    organizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
    auth: { autoRefreshSession: true },
  };

  return (
    <TurnkeyProvider
      config={config}
      callbacks={{
        onAuthenticationSuccess: () => router.push("/dashboard"),
        onError: (e) => console.error(e),
      }}
    >
      {children}
    </TurnkeyProvider>
  );
}

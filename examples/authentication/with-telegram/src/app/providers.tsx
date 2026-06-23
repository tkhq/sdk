"use client";
import {
  TurnkeyProvider,
  type TurnkeyProviderConfig,
} from "@turnkey/react-wallet-kit";

export function Providers({ children }: { children: React.ReactNode }) {
  const config: TurnkeyProviderConfig = {
    apiBaseUrl: process.env.NEXT_PUBLIC_BASE_URL ?? "https://api.turnkey.com",
    organizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
    auth: { autoRefreshSession: true },
  };

  return (
    <TurnkeyProvider
      config={config}
      callbacks={{
        onError: (e) => console.error(e),
      }}
    >
      {children}
    </TurnkeyProvider>
  );
}

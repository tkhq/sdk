"use client";

import {
  TurnkeyProvider,
  type TurnkeyProviderConfig,
} from "@turnkey/react-wallet-kit";
import "@turnkey/react-wallet-kit/styles.css";

export function Providers({ children }: { children: React.ReactNode }) {
  const config: TurnkeyProviderConfig = {
    organizationId: process.env.NEXT_PUBLIC_TURNKEY_ORG_ID!,
    authProxyConfigId: process.env.NEXT_PUBLIC_AUTH_PROXY_CONFIG_ID!,
    auth: {
      oauthConfig: {
        google: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
          ? { primaryClientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID }
          : undefined,
      },
    },
    ui: {
      darkMode: true,
    },
  };

  return <TurnkeyProvider config={config}>{children}</TurnkeyProvider>;
}

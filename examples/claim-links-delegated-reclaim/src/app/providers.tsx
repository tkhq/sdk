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
      methods: {
        emailOtpAuthEnabled: true,
        googleOauthEnabled: !!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
        passkeyAuthEnabled: false,
        walletAuthEnabled: false,
      },
      oauthConfig: {
        googleClientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
      },
      autoRefreshSession: true,
    },
    ui: {
      darkMode: true,
    },
  };

  return <TurnkeyProvider config={config}>{children}</TurnkeyProvider>;
}

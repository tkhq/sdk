"use client";

import { useMemo } from "react";
import {
  TurnkeyProvider,
  type TurnkeyProviderConfig,
  type CreateSubOrgParams,
} from "@turnkey/react-wallet-kit";

export function Providers({ children }: { children: React.ReactNode }) {
  // Every sign-up creates a sub-organization with the passkey as its root
  // user and one Ethereum account. That account is the depositor.
  const suborgParams = useMemo<CreateSubOrgParams>(
    () => ({
      userName: `depositor-${Date.now()}`,
      customWallet: {
        walletName: "MiniBank wallet",
        walletAccounts: [
          {
            curve: "CURVE_SECP256K1",
            pathFormat: "PATH_FORMAT_BIP32",
            path: "m/44'/60'/0'/0/0",
            addressFormat: "ADDRESS_FORMAT_ETHEREUM",
          },
        ],
      },
    }),
    [],
  );

  const turnkeyConfig: TurnkeyProviderConfig = {
    organizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
    authProxyConfigId: process.env.NEXT_PUBLIC_AUTH_PROXY_CONFIG_ID!,
    authProxyUrl: process.env.NEXT_PUBLIC_AUTH_PROXY_BASE_URL,
    apiBaseUrl: process.env.NEXT_PUBLIC_BASE_URL,
    auth: {
      createSuborgParams: {
        passkeyAuth: suborgParams,
      },
    },
  };

  return (
    <TurnkeyProvider
      config={turnkeyConfig}
      callbacks={{
        onError: (error) => console.error("Turnkey error:", error),
      }}
    >
      {children}
    </TurnkeyProvider>
  );
}

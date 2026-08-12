"use client";

import { useMemo } from "react";
import {
  TurnkeyProvider,
  type TurnkeyProviderConfig,
  type CreateSubOrgParams,
} from "@turnkey/react-wallet-kit";
import "@turnkey/react-wallet-kit/styles.css";

export function Providers({ children }: { children: React.ReactNode }) {
  const suborgParams = useMemo<CreateSubOrgParams>(() => {
    const ts = Date.now();
    return {
      userName: `User-${ts}`,
      customWallet: {
        walletName: `Default Wallet`,
        walletAccounts: [
          {
            curve: "CURVE_SECP256K1",
            pathFormat: "PATH_FORMAT_BIP32",
            path: `m/44'/60'/0'/0/0`,
            addressFormat: "ADDRESS_FORMAT_ETHEREUM",
          },
          {
            curve: "CURVE_ED25519",
            pathFormat: "PATH_FORMAT_BIP32",
            path: `m/44'/501'/0'/0'`,
            addressFormat: "ADDRESS_FORMAT_SOLANA",
          },
        ],
      },
    };
  }, []);

  const turnkeyConfig: TurnkeyProviderConfig = {
    organizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
    authProxyConfigId: process.env.NEXT_PUBLIC_AUTH_PROXY_CONFIG_ID!,
    authProxyUrl: process.env.NEXT_PUBLIC_AUTH_PROXY_BASE_URL,
    apiBaseUrl: process.env.NEXT_PUBLIC_BASE_URL,
    auth: {
      createSuborgParams: {
        emailOtpAuth: suborgParams,
      },
    },
  };

  return (
    <TurnkeyProvider
      config={turnkeyConfig}
      callbacks={{
        onError: (error) => {
          console.error("Turnkey error:", error);
        },
      }}
    >
      {children}
    </TurnkeyProvider>
  );
}

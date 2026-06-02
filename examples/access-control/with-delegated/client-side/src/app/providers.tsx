"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  TurnkeyProvider,
  type TurnkeyProviderConfig,
  type CreateSubOrgParams,
} from "@turnkey/react-wallet-kit";
import "@turnkey/react-wallet-kit/styles.css";

export function Providers({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  const suborgParams = useMemo<CreateSubOrgParams>(() => {
    const ts = Date.now();
    return {
      userName: `User-${ts}`,
      customWallet: {
        walletName: `Wallet-${ts}`,
        walletAccounts: [
          {
            curve: "CURVE_SECP256K1",
            pathFormat: "PATH_FORMAT_BIP32",
            path: "m/44'/60'/0'/0/0",
            addressFormat: "ADDRESS_FORMAT_ETHEREUM",
          },
        ],
      },
    };
  }, []);

  const turnkeyConfig: TurnkeyProviderConfig = {
    organizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
    authProxyConfigId: process.env.NEXT_PUBLIC_AUTH_PROXY_CONFIG_ID!,
    auth: {
      createSuborgParams: {
        emailOtpAuth: suborgParams,
        smsOtpAuth: suborgParams,
        walletAuth: suborgParams,
        oauth: suborgParams,
        passkeyAuth: {
          ...suborgParams,
          passkeyName: "My Passkey",
        },
      },
    },
  };

  return (
    <TurnkeyProvider
      config={turnkeyConfig}
      callbacks={{
        onAuthenticationSuccess: ({ session }) => {
          console.log("Authenticated:", session);
          router.push("/dashboard");
        },
        onError: (error) => {
          console.error("Turnkey error:", error);
        },
      }}
    >
      {children}
    </TurnkeyProvider>
  );
}

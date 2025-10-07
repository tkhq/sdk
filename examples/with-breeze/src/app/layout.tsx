"use client";

import "@turnkey/react-wallet-kit/styles.css";
import "./global.css";
import { CreateSubOrgParams, TurnkeyProvider } from "@turnkey/react-wallet-kit";

interface RootLayoutProps {
  children: React.ReactNode;
}

export const createSuborgParams: CreateSubOrgParams = {
  customWallet: {
    walletName: "Wallet 1",
    walletAccounts: [
      {
        addressFormat: "ADDRESS_FORMAT_SOLANA",
        curve: "CURVE_ED25519",
        pathFormat: "PATH_FORMAT_BIP32",
        path: "m/44'/501'/0'/0/0",
      },
    ],
  },
};

function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>Turnkey X Breeze example</title>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </head>
      <body>
        <TurnkeyProvider
          config={{
            organizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
            authProxyConfigId: process.env.NEXT_PUBLIC_AUTH_PROXY_ID!,
            auth: {
              createSuborgParams: {
                passkeyAuth: createSuborgParams,
              },
              methods: {
                smsOtpAuthEnabled: false,
                googleOauthEnabled: false,
                xOauthEnabled: false,
                discordOauthEnabled: false,
                appleOauthEnabled: false,
                facebookOauthEnabled: false,
                passkeyAuthEnabled: true,
                emailOtpAuthEnabled: false,
                walletAuthEnabled: false,
              },
              autoRefreshSession: true,
            },
          }}
        >
          {children}
        </TurnkeyProvider>
      </body>
    </html>
  );
}

export default RootLayout;

"use client";

import "@turnkey/react-wallet-kit/styles.css";
import "./global.css";
import { TurnkeyProvider } from "@turnkey/react-wallet-kit";

interface RootLayoutProps {
  children: React.ReactNode;
}

function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>A monumental leap</title>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </head>
      <body>
        <TurnkeyProvider
          config={{
            apiBaseUrl: process.env.NEXT_PUBLIC_BASE_URL!,
            organizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
            authProxyConfigId: process.env.NEXT_PUBLIC_AUTH_PROXY_ID!,
            authProxyUrl: process.env.NEXT_PUBLIC_AUTH_PROXY_URL!,
            auth: {
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

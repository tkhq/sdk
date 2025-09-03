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
            authProxyUrl: process.env.NEXT_PUBLIC_AUTH_PROXY_URL!,
            importIframeUrl: process.env.NEXT_PUBLIC_IMPORT_IFRAME_URL!,
            exportIframeUrl: process.env.NEXT_PUBLIC_EXPORT_IFRAME_URL!,
            authProxyConfigId: process.env.NEXT_PUBLIC_AUTH_PROXY_ID!,
            organizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
            auth: {
              oauthConfig: {
                googleClientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
                appleClientId: process.env.NEXT_PUBLIC_APPLE_CLIENT_ID,
                facebookClientId: process.env.NEXT_PUBLIC_FACEBOOK_CLIENT_ID,
                oauthRedirectUri: process.env.NEXT_PUBLIC_OAUTH_REDIRECT_URI,
                xClientId: process.env.NEXT_PUBLIC_X_CLIENT_ID,
                openOauthInPage: true,
              },
              methods: {
                smsOtpAuthEnabled: true,
              },
              autoRefreshSession: true,
            },
            ui: {
              darkMode: false,
            },
            walletConfig: {
              features: {
                auth: true,
                connecting: true,
              },
              chains: {
                ethereum: {
                  native: true,
                  walletConnectNamespaces: ["eip155:1"],
                },
                solana: {
                  native: true,
                  walletConnectNamespaces: [
                    "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
                  ],
                },
              },
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

"use client";

import "@turnkey/react-wallet-kit/styles.css";
import "./globals.css";
import { StamperType, TurnkeyProvider } from "@turnkey/react-wallet-kit";

interface RootLayoutProps {
  children: React.ReactNode;
}

function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>Export and Sign</title>
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
              methods: {
                passkeyAuthEnabled: true,
                emailOtpAuthEnabled: true,
                walletAuthEnabled: true,
              },
              autoRefreshSession: true,
            },
            ui: {
              darkMode: true,
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
              walletConnect: {
                projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!,
                appMetadata: {
                  name: "Turnkey Wallet",
                  description: "A wallet for Turnkey",
                  url: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_URL!,
                  icons: ["/favicon.svg"],
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

"use client";

import "@turnkey/react-wallet-kit/dist/styles.css";
import "./global.css";
import { TurnkeyConfigProvider } from "@/providers/ConfigProvider";

interface RootLayoutProps {
  children: React.ReactNode;
}

function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>Turnkey Demo EWK</title>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </head>
      <body className="bg-red-400 ">
        <TurnkeyConfigProvider
          initialConfig={{
            apiBaseUrl: process.env.NEXT_PUBLIC_BASE_URL!,
            authProxyUrl: process.env.NEXT_PUBLIC_AUTH_PROXY_URL!,
            authProxyId: process.env.NEXT_PUBLIC_AUTH_PROXY_ID!,
            organizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
            importIframeUrl: process.env.NEXT_PUBLIC_IMPORT_IFRAME_URL!,
            exportIframeUrl: process.env.NEXT_PUBLIC_EXPORT_IFRAME_URL!,
            auth: {
              oAuthConfig: {
                googleClientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
                appleClientId: process.env.NEXT_PUBLIC_APPLE_CLIENT_ID,
                facebookClientId: process.env.NEXT_PUBLIC_FACEBOOK_CLIENT_ID,
                oAuthRedirectUri: process.env.NEXT_PUBLIC_OAUTH_REDIRECT_URI,
              },
              methods: {
                smsOtpAuthEnabled: true,
              },
              autoRefreshSession: true,
            },
            ui: {
              darkMode: false,
              renderModalInProvider: true, // This is needed for the config panel to push the modal over
            },
            walletConfig: {
              ethereum: true,
              solana: true,
            },
          }}
          callbacks={{
            onError: (error) => {
              console.log("Turnkey error:", error.code);
            },
          }}
        >
          {children}
        </TurnkeyConfigProvider>
      </body>
    </html>
  );
}

export default RootLayout;

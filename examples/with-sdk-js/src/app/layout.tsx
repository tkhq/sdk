"use client";

import { TurnkeyProvider } from "@turnkey/react-wallet-kit";
import "@turnkey/react-wallet-kit/dist/styles.css";
import "./global.css";

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
            authProxyId: process.env.NEXT_PUBLIC_AUTH_PROXY_ID!,
            organizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
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
            },
          }}
          callbacks={{
            onError: (error) => {
              console.log("Turnkey error:", error.code);
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

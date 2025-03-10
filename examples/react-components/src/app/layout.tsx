"use client";

import "@turnkey/sdk-react/styles";
import { TurnkeyProvider, TurnkeyThemeProvider } from "@turnkey/sdk-react";
import { EthereumWallet } from "@turnkey/wallet-stamper";
const wallet = new EthereumWallet();
const turnkeyConfig = {
  apiBaseUrl: process.env.NEXT_PUBLIC_BASE_URL!,
  defaultOrganizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
  rpId: process.env.NEXT_PUBLIC_RPID!,
  iframeUrl:
    process.env.NEXT_PUBLIC_AUTH_IFRAME_URL ?? "https://auth.turnkey.com",
  wallet,
};

interface RootLayoutProps {
  children: React.ReactNode;
}

function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>Turnkey Auth Demo</title>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </head>
      <TurnkeyThemeProvider>
        <body>
          <TurnkeyProvider config={turnkeyConfig}>{children}</TurnkeyProvider>
        </body>
      </TurnkeyThemeProvider>
    </html>
  );
}

export default RootLayout;

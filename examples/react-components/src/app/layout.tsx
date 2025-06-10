"use client";

import "@turnkey/sdk-react/styles";
import { TurnkeyProvider, TurnkeyThemeProvider } from "@turnkey/sdk-react";
import { EthereumWallet } from "@turnkey/wallet-stamper";
import { SessionExpiryProvider } from "./context/SessionExpiryContext";
const wallet = new EthereumWallet();
const turnkeyConfig = {
  apiBaseUrl: process.env.NEXT_PUBLIC_BASE_URL!,
  defaultOrganizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
  rpId: process.env.NEXT_PUBLIC_RPID!,
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
          <TurnkeyProvider config={turnkeyConfig}>
            <SessionExpiryProvider warningBeforeSec={30}>
              {children}
            </SessionExpiryProvider>
          </TurnkeyProvider>
        </body>
      </TurnkeyThemeProvider>
    </html>
  );
}

export default RootLayout;

"use client";

import "@turnkey/sdk-react/styles";
import { TurnkeyProvider } from "@turnkey/sdk-react";

const turnkeyConfig = {
  apiBaseUrl: process.env.NEXT_PUBLIC_BASE_URL!,
  defaultOrganizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
  rpId: process.env.NEXT_PUBLIC_RPID!,
  iframeUrl:
    process.env.NEXT_PUBLIC_AUTH_IFRAME_URL ?? "https://auth.turnkey.com",
};

interface RootLayoutProps {
  children: React.ReactNode;
}

function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <TurnkeyProvider config={turnkeyConfig}>{children}</TurnkeyProvider>
      </body>
    </html>
  );
}

export default RootLayout;

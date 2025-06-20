"use client";

import { TurnkeyProvider } from "@turnkey/sdk-react";

const turnkeyConfig = {
  apiBaseUrl: process.env.NEXT_PUBLIC_BASE_URL!,
  authProxyUrl: process.env.NEXT_PUBLIC_AUTH_PROXY_URL!,
  authProxyId: process.env.NEXT_PUBLIC_AUTH_PROXY_ID!,
  defaultOrganizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
  rpId: process.env.NEXT_PUBLIC_RPID!,
};

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
      <body>{children}</body>
    </html>
  );
}

export default RootLayout;

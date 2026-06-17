"use client";

import "@turnkey/react-wallet-kit/styles.css";
import "./global.css";
import { TurnkeyProvider } from "@turnkey/react-wallet-kit";
import { initialConfig } from "@/constants";
import { type ReactElement } from "react";

interface RootLayoutProps {
  children: React.ReactNode;
}

function RootLayout({ children }: RootLayoutProps): ReactElement {
  return (
    <html lang="en">
      <head>
        <title>Turnkey + Stellar</title>
      </head>
      <body className="bg-gray-50 text-gray-900 min-h-screen">
        <TurnkeyProvider config={initialConfig}>{children}</TurnkeyProvider>
      </body>
    </html>
  );
}

export default RootLayout;

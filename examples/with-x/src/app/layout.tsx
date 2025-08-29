"use client";

import { TurnkeyProvider } from "@turnkey/sdk-react";
import "./globals.css";

const turnkeyConfig = {
  apiBaseUrl: process.env.NEXT_PUBLIC_BASE_URL!,
  defaultOrganizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
};

interface RootLayoutProps {
  children: React.ReactNode;
}

function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" className={`antialiased`}>
      <body className="font-sans">
        <div className="bg-yellow-100 border-b border-yellow-200 px-4 py-2 text-center">
          <p className="text-sm text-yellow-800 font-medium">
            🚧 - This is a demo application
          </p>
        </div>
        <TurnkeyProvider config={turnkeyConfig}>{children}</TurnkeyProvider>
      </body>
    </html>
  );
}

export default RootLayout;

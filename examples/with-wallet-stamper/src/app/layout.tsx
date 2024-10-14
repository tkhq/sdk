"use client";

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

import { TurnkeyProvider as TurnkeyReactProvider } from "@turnkey/sdk-react";

const inter = Inter({ subsets: ["latin"] });

interface RootLayoutProps {
  children: React.ReactNode;
}

const metadata: Metadata = {
  title: "Turnkey Wallet Stamper Demo",
  description: "Demonstrates the usage of the @turnkey/wallet-stamper package",
};

const turnkeyConfig = {
  apiBaseUrl: process.env.NEXT_PUBLIC_BASE_URL!,
  defaultOrganizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <TurnkeyReactProvider config={turnkeyConfig}>
        <body className={inter.className}>
          <Providers>{children}</Providers>
        </body>
      </TurnkeyReactProvider>
    </html>
  );
}

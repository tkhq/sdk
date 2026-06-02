"use client";

import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { CreateSubOrgParams, TurnkeyProvider } from "@turnkey/react-wallet-kit";
import "@turnkey/react-wallet-kit/styles.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const createSubOrgParams: CreateSubOrgParams = {
  customWallet: {
    walletName: "ETH Wallet",
    walletAccounts: [
      {
        addressFormat: "ADDRESS_FORMAT_ETHEREUM",
        curve: "CURVE_SECP256K1",
        pathFormat: "PATH_FORMAT_BIP32",
        path: "m/44'/60'/0'/0/0",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <title>Turnkey x402</title>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <TurnkeyProvider
          config={{
            organizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
            authProxyConfigId: process.env.NEXT_PUBLIC_AUTH_PROXY_ID!,
            auth: {
              createSuborgParams: {
                emailOtpAuth: createSubOrgParams,
                smsOtpAuth: createSubOrgParams,
                walletAuth: createSubOrgParams,
                passkeyAuth: createSubOrgParams,
                oauth: createSubOrgParams,
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

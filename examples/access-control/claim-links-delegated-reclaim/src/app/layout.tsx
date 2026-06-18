import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Claim Links with Automated Reclaim — Turnkey Demo",
  description:
    "Send USDC via a one-click claim link. Powered by Turnkey sub-orgs and native gas sponsorship.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

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
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

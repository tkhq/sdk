import "@turnkey/react-wallet-kit/styles.css";
import "./globals.css";
import { Providers } from "./providers";

export const metadata = {
  title: "Scoped deposit session",
  description:
    "A Turnkey session that can deposit into MiniBank and nothing else.",
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

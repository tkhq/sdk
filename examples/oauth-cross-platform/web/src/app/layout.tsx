import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Turnkey Oauth Cross-Platform Demo",
  description: "A demonstration of cross-platform OAuth users.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className=""
      >
        {children}
      </body>
    </html>
  );
}

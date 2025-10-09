import "@turnkey/react-wallet-kit/styles.css";
import "./globals.css";
import { Providers } from "./providers";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <title>Turnkey x LiFi Swap demo</title>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </head>
      <body>
        <div className="bg-yellow-100 border-b border-yellow-200 px-4 py-2 text-center">
          <p className="text-sm text-yellow-800 font-medium">
            🚧 - This is a demo application
          </p>
        </div>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

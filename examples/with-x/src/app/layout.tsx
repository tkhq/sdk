import { Providers } from "../components/Providers";
import "./globals.css";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen flex flex-col">
        <div className="flex flex-col flex-1 min-h-0">
          <Providers>{children}</Providers>
        </div>
      </body>
    </html>
  );
}

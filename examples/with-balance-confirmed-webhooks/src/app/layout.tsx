import "./globals.css";

export const metadata = {
  title: "Turnkey Balance Confirmed Webhooks",
  description:
    "Example app for fetching balances and receiving BALANCE_CONFIRMED_UPDATES webhook events.",
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

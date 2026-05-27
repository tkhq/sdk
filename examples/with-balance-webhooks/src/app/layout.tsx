import "./globals.css";

export const metadata = {
  title: "Turnkey Balance Lifecycle Webhooks",
  description:
    "Example app for fetching balances and receiving BALANCE_CONFIRMED_UPDATES and BALANCE_FINALIZED_UPDATES webhook events.",
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

import { SendForm } from "./SendForm";

export default function HomePage() {
  return (
    <main className="tk-page">
      <header style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="tk-wordmark-row">
          <div className="tk-wordmark" aria-label="Turnkey" />
          <span className="tk-wordmark-sep">/</span>
          <span className="tk-wordmark-label">Demo</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <h1 className="tk-heading">Claim links with automated reclaim</h1>
          <p className="tk-subheading">
            Send USDC on Base Sepolia via a one-click link. The recipient just
            needs to input a wallet address. Gas is sponsored by the parent org.
          </p>
        </div>
      </header>
      <SendForm />
    </main>
  );
}

import { Suspense } from "react";
import { ClaimClient } from "./ClaimClient";
import { getClaim } from "@/server/actions/getClaim";

interface PageProps {
  params: Promise<{ txId: string }>;
}

export default async function ClaimPage({ params }: PageProps) {
  const { txId } = await params;
  const claim = await getClaim(txId);

  if (!claim) {
    return (
      <main className="tk-page">
        <h1 className="tk-heading">Claim not found</h1>
        <p className="tk-subheading">The link you opened does not exist.</p>
      </main>
    );
  }

  return (
    <main className="tk-page">
      <header style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="tk-wordmark-row">
          <div className="tk-wordmark" aria-label="Turnkey" />
          <span className="tk-wordmark-sep">/</span>
          <span className="tk-wordmark-label">Demo</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <h1 className="tk-heading">Claim {claim.amountDisplay}</h1>
          <p className="tk-subheading">on Base Sepolia</p>
        </div>
      </header>
      <Suspense fallback={<p className="tk-body-muted">Loading...</p>}>
        <ClaimClient claim={claim} />
      </Suspense>
    </main>
  );
}

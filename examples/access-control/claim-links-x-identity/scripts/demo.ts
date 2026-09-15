async function main() {
  const dryRun = process.argv.includes("--dry-run");
  if (dryRun) {
    console.log("DRY RUN: claim-links-x-identity");
    console.log("1. Resolve immutable numeric X IDs (manual or X API live lookup).");
    console.log("2. Pre-create backend-rooted sub-org + Solana wallet + latent backend deny.");
    console.log("3. At /claim/<subOrgId>, verify Turnkey OIDC sub against claim:x:<id>.");
    console.log("4. Create claimant, attach X provider, add claimant allow, rotate root to claimant.");
    console.log("5. oauth_login creates claimant session; backend SIGN_RAW_PAYLOAD must be denied.");
    return;
  }
  if (process.argv.slice(2).filter((arg) => arg !== "--").length === 0) {
    throw new Error("usage: pnpm demo -- handle:numeric_id [...]");
  }
  await import("./preassociate");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

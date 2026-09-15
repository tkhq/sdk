const dryRun = process.argv.includes("--dry-run");
if (dryRun) {
  console.log("DRY RUN: x-claim-links");
  console.log("1. Resolve immutable numeric X IDs (manual or X API live lookup).");
  console.log("2. Pre-create backend-rooted sub-org + Solana wallet + latent backend deny.");
  console.log("3. At /claim/<subOrgId>, verify Turnkey OIDC sub against claim:x:<id>.");
  console.log("4. Create claimant, attach X provider, add claimant allow, rotate root to claimant.");
  console.log("5. oauth_login creates claimant session; backend SIGN_RAW_PAYLOAD must be denied.");
  process.exit(0);
}
console.log("Run preassociate, open the printed claim URL, then run demo:verify and attack.");

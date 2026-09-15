process.env.DOTENV_CONFIG_PATH ??= ".env.local";
await import("dotenv/config");
import { expectedXIdFromAllocationName } from "../src/lib/claim-gate";
import { getAllocation } from "../src/lib/turnkey-server";

async function main() {
  const subOrgId = process.argv[2];
  if (!subOrgId) throw new Error("usage: pnpm demo:verify -- <subOrgId>");
  const org = await getAllocation(subOrgId);
  const expected = expectedXIdFromAllocationName(org.name ?? "");
  const claimant = org.users?.find((user) =>
    user.oauthProviders.some((provider) => provider.subject === `x:${expected}`),
  );
  if (!claimant) throw new Error("verified X claimant is not attached");
  if (org.rootQuorum?.threshold !== 1 || org.rootQuorum.userIds.length !== 1 ||
      org.rootQuorum.userIds[0] !== claimant.userId) {
    throw new Error("root quorum has not handed off exclusively to claimant");
  }
  const backendDeny = org.policies?.some((policy) =>
    policy.policyName === "Deny allocation backend signing after handoff");
  const claimantAllow = org.policies?.some((policy) =>
    policy.policyName === "Allow the bound X claimant to sign");
  if (!backendDeny || !claimantAllow) throw new Error("required signing policies are missing");
  console.log(`VERIFIED CLAIM: ${subOrgId} -> X ${expected} -> ${claimant.userId}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

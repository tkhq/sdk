import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { expectedXIdFromAllocationName } from "../src/lib/claim-gate";
import { getAllocation } from "../src/lib/turnkey-server";
import { scriptArgs } from "./args";

async function main() {
  const subOrgId = scriptArgs()[0];
  if (!subOrgId) throw new Error("usage: pnpm demo:verify -- <subOrgId>");
  const org = await getAllocation(subOrgId);
  const expected = expectedXIdFromAllocationName(org.name ?? "");
  let claimantId: string | undefined;
  for (const user of org.users ?? []) {
    for (const provider of user.oauthProviders) {
      // Turnkey stores the bare numeric X ID as the provider subject; tolerate the
      // prefixed form too, exactly as the claim gate does.
      if (provider.subject === expected || provider.subject === `x:${expected}`) {
        claimantId = user.userId;
      }
    }
  }
  if (!claimantId) throw new Error("verified X claimant is not attached");
  if (org.rootQuorum?.threshold !== 1 || org.rootQuorum.userIds.length !== 1 ||
      org.rootQuorum.userIds[0] !== claimantId) {
    throw new Error("root quorum has not handed off exclusively to claimant");
  }
  let backendDeny = false;
  let claimantAllow = false;
  let backendLogin = false;
  for (const policy of org.policies ?? []) {
    if (policy.policyName === "Deny allocation backend signing after handoff") backendDeny = true;
    if (policy.policyName === "Allow the bound X claimant to sign") claimantAllow = true;
    if (policy.policyName === "Allow allocation backend to mint claimant sessions") backendLogin = true;
  }
  if (!backendDeny || !claimantAllow) throw new Error("required signing policies are missing");
  if (!backendLogin) {
    console.warn("note: no oauth_login allow for the backend; repeat logins through this app will be denied");
  }
  console.log(`VERIFIED CLAIM: ${subOrgId} -> X ${expected} -> ${claimantId}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

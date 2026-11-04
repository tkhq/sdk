import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { getAllocation, turnkeyClient } from "../src/lib/turnkey-server";
import { scriptArgs } from "./args";

async function main() {
  const args = scriptArgs();
  const subOrgId = args[0];
  if (!subOrgId)
    throw new Error("usage: pnpm attack -- <subOrgId> [solanaAddress]");
  const organization = await getAllocation(subOrgId);
  // get_organization returns wallets without their accounts, so resolve the
  // address through list_wallet_accounts unless one was passed explicitly.
  let signWith = args[1];
  if (!signWith) {
    const walletId = organization.wallets?.[0]?.walletId;
    if (!walletId) throw new Error("allocation has no wallet");
    const { accounts } = await turnkeyClient(subOrgId).getWalletAccounts({
      organizationId: subOrgId,
      walletId,
    });
    signWith = accounts?.[0]?.address;
  }
  if (!signWith) throw new Error("allocation has no wallet account");
  try {
    await turnkeyClient(subOrgId).signRawPayload({
      signWith,
      payload: "proof that the allocation backend cannot sign",
      encoding: "PAYLOAD_ENCODING_TEXT_UTF8",
      // Solana accounts are ed25519; Turnkey rejects a hash function here with a
      // validation error that fires before policy evaluation.
      hashFunction: "HASH_FUNCTION_NOT_APPLICABLE",
    });
    console.error("SECURITY FAILURE: backend SIGN_RAW_PAYLOAD succeeded");
    process.exit(1);
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : String(error);
    // Turnkey reports a policy denial as a PolicyEnginePermissionError whose details
    // list each policy's outcome. Match on that structure, not on prose that may change.
    if (!/PolicyEnginePermissionError/.test(reason)) {
      throw new Error(
        `SIGN_RAW_PAYLOAD failed for a non-policy reason: ${reason}`,
      );
    }
    const explicit = /OUTCOME_DENY_EXPLICIT/.test(reason);
    console.log(
      `DENIED AS EXPECTED (${explicit ? "explicit deny policy fired" : "implicit deny only"}): ` +
        reason.split(" (Details:")[0],
    );
    if (!explicit) {
      console.warn(
        "note: the backend deny policy did not evaluate to an explicit deny; check it is installed",
      );
    }
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

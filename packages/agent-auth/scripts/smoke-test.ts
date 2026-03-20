/**
 * Smoke test for @turnkey/agent-auth against a real Turnkey instance.
 *
 * Usage:
 *   TURNKEY_API_BASE_URL=http://localhost:8081 \
 *   TURNKEY_API_PUBLIC_KEY=<your-public-key> \
 *   TURNKEY_API_PRIVATE_KEY=<your-private-key> \
 *   TURNKEY_ORG_ID=<your-org-id> \
 *   npx tsx scripts/smoke-test.ts
 */

import { TurnkeyServerSDK } from "@turnkey/sdk-server";
import { createAgentSession, deleteAgentSession, presets } from "../src/index";

const API_BASE_URL = process.env.TURNKEY_API_BASE_URL ?? "http://localhost:8081";
const API_PUBLIC_KEY = process.env.TURNKEY_API_PUBLIC_KEY;
const API_PRIVATE_KEY = process.env.TURNKEY_API_PRIVATE_KEY;
const ORG_ID = process.env.TURNKEY_ORG_ID;

if (!API_PUBLIC_KEY || !API_PRIVATE_KEY || !ORG_ID) {
  console.error(
    "Required env vars: TURNKEY_API_PUBLIC_KEY, TURNKEY_API_PRIVATE_KEY, TURNKEY_ORG_ID"
  );
  process.exit(1);
}

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  PASS: ${name}`);
    passed++;
  } else {
    console.log(`  FAIL: ${name}${detail ? ` (${detail})` : ""}`);
    failed++;
  }
}

async function main() {
  console.log(`\nSmoke test against ${API_BASE_URL}\n`);

  // Step 1: Create parent org client
  const parentSdk = new TurnkeyServerSDK({
    apiBaseUrl: API_BASE_URL,
    apiPublicKey: API_PUBLIC_KEY!,
    apiPrivateKey: API_PRIVATE_KEY!,
    defaultOrganizationId: ORG_ID!,
  });
  const parentClient = parentSdk.apiClient();

  // Step 2: Provision agent session
  console.log("1. Creating agent session...");
  let session;
  try {
    session = await createAgentSession(
      parentClient,
      {
        organizationId: ORG_ID!,
        agentName: `smoke-test-${Date.now()}`,
        expirationSeconds: 300,
        accounts: [
          presets.jwtSigning(),
          presets.gitSigning({ exportKey: true }),
        ],
      },
      { apiBaseUrl: API_BASE_URL }
    );

    check("Session created", true);
    check("Has sub-org ID", !!session.subOrganizationId);
    check("Has agent user ID", !!session.agentUserId);
    check("Has API key pair", !!session.apiKey.publicKey && !!session.apiKey.privateKey);
    check("Has 2 accounts", session.accounts.length === 2);
    check("JWT signing account", session.accounts[0]?.label === "jwt-signing");
    check("Git signing account", session.accounts[1]?.label === "git-signing");
    check("Has policy IDs", session.policyIds.length > 0);
    check("Has expiry", !!session.expiresAt);

    console.log(`\n  Sub-org: ${session.subOrganizationId}`);
    console.log(`  Agent user: ${session.agentUserId}`);
    console.log(`  Accounts: ${session.accounts.map((a) => a.label).join(", ")}`);
    console.log(`  Policies: ${session.policyIds.length}`);
    console.log(`  Expires: ${session.expiresAt}`);
  } catch (err) {
    console.log(`  FAIL: Session creation failed: ${err}`);
    failed++;
    process.exit(1);
  }

  // Step 3: Test agent credential
  console.log("\n2. Testing agent credential...");
  const agentSdk = new TurnkeyServerSDK({
    apiBaseUrl: API_BASE_URL,
    apiPublicKey: session.apiKey.publicKey,
    apiPrivateKey: session.apiKey.privateKey,
    defaultOrganizationId: session.subOrganizationId,
  });
  const agentClient = agentSdk.apiClient();

  // Step 4: Agent should be able to sign (if wallet exists)
  if (session.accounts.length > 0 && session.accounts[0].publicKey) {
    console.log("\n3. Testing sign_raw_payload (should SUCCEED)...");
    try {
      await agentClient.signRawPayload({
        organizationId: session.subOrganizationId,
        signWith: session.accounts[0].publicKey,
        payload: "48656c6c6f", // "Hello" in hex
        encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
        hashFunction: "HASH_FUNCTION_NO_OP",
      });
      check("sign_raw_payload succeeded", true);
    } catch (err: any) {
      check("sign_raw_payload succeeded", false, err.message);
    }
  }

  // Step 5: Agent should NOT be able to create users (implicit deny)
  console.log("\n4. Testing createUsers (should FAIL, implicit deny)...");
  try {
    await agentClient.createUsers({
      organizationId: session.subOrganizationId,
      users: [
        {
          userName: "unauthorized-user",
          apiKeys: [],
          authenticators: [],
          oauthProviders: [],
        },
      ],
    });
    check("createUsers blocked by policy", false, "should have been denied");
  } catch {
    check("createUsers blocked by policy", true);
  }

  // Step 6: Delete agent session
  console.log("\n5. Deleting agent session...");
  try {
    await deleteAgentSession(parentClient, {
      organizationId: ORG_ID!,
      subOrganizationId: session.subOrganizationId,
    });
    check("Session deleted", true);
  } catch (err: any) {
    check("Session deleted", false, err.message);
  }

  // Step 7: Agent key should no longer work
  console.log("\n6. Verifying agent key is revoked...");
  try {
    await agentClient.getWhoami({
      organizationId: session.subOrganizationId,
    });
    check("Agent key revoked after delete", false, "key still works");
  } catch {
    check("Agent key revoked after delete", true);
  }

  // Summary
  console.log(`\n${"=".repeat(40)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`${"=".repeat(40)}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Smoke test crashed:", err);
  process.exit(1);
});

/**
 * Smoke test for @turnkey/agent-auth against a real Turnkey instance.
 *
 * Usage:
 *   TURNKEY_API_BASE_URL=<your-api-url> \
 *   TURNKEY_API_PUBLIC_KEY=<your-public-key> \
 *   TURNKEY_API_PRIVATE_KEY=<your-private-key> \
 *   TURNKEY_ORG_ID=<your-org-id> \
 *   npx tsx scripts/smoke-test.ts
 */

import { Turnkey } from "@turnkey/sdk-server";
const TurnkeyServerSDK = Turnkey;
import {
  createAgentSession,
  deleteAgentSession,
  presets,
  signJwt,
  signSshCommit,
  signMessage,
} from "../src/index";

const API_BASE_URL = process.env.TURNKEY_API_BASE_URL;
const API_PUBLIC_KEY = process.env.TURNKEY_API_PUBLIC_KEY;
const API_PRIVATE_KEY = process.env.TURNKEY_API_PRIVATE_KEY;
const ORG_ID = process.env.TURNKEY_ORG_ID;

if (!API_BASE_URL || !API_PUBLIC_KEY || !API_PRIVATE_KEY || !ORG_ID) {
  console.error(
    "Required env vars: TURNKEY_API_BASE_URL, TURNKEY_API_PUBLIC_KEY, TURNKEY_API_PRIVATE_KEY, TURNKEY_ORG_ID",
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
      { apiBaseUrl: API_BASE_URL },
    );

    check("Session created", true);
    check("Has sub-org ID", !!session.subOrganizationId);
    check("Has agent user ID", !!session.agentUserId);
    check(
      "Has API key pair",
      !!session.apiKey.publicKey && !!session.apiKey.privateKey,
    );
    check("Has 2 accounts", session.accounts.length === 2);
    check("JWT signing account", session.accounts[0]?.label === "jwt-signing");
    check("Git signing account", session.accounts[1]?.label === "git-signing");
    check("Has policy IDs", session.policyIds.length > 0);
    check("Has expiry", !!session.expiresAt);
    check(
      "Git signing account has exportBundle",
      !!session.accounts[1]?.exportBundle,
    );

    console.log(`\n  Sub-org: ${session.subOrganizationId}`);
    console.log(`  Agent user: ${session.agentUserId}`);
    console.log(
      `  Accounts: ${session.accounts.map((a) => a.label).join(", ")}`,
    );
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
        payload:
          "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855", // SHA-256 of empty string (32 bytes)
        encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
        hashFunction: "HASH_FUNCTION_NO_OP",
      });
      check("sign_raw_payload succeeded", true);
    } catch (err: any) {
      check("sign_raw_payload succeeded", false, err.message);
    }
  }

  // Step 4b: Test Ed25519 signing (git-signing account)
  if (session.accounts.length > 1 && session.accounts[1].publicKey) {
    console.log("\n3b. Testing sign_raw_payload with Ed25519 (git-signing)...");
    try {
      await agentClient.signRawPayload({
        organizationId: session.subOrganizationId,
        signWith: session.accounts[1].publicKey,
        payload: "48656c6c6f20576f726c64",
        encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
        hashFunction: "HASH_FUNCTION_NOT_APPLICABLE",
      });
      check("Ed25519 sign_raw_payload succeeded", true);
    } catch (err: any) {
      check("Ed25519 sign_raw_payload succeeded", false, err.message);
    }
  }

  // Step 4c: Test signJwt helper
  if (session.accounts.length > 0 && session.accounts[0].publicKey) {
    console.log("\n3c. Testing signJwt helper...");
    try {
      const jwt = await signJwt(agentClient, {
        organizationId: session.subOrganizationId,
        signingKey: session.accounts[0].publicKey,
        payload: {
          iss: session.subOrganizationId,
          sub: session.agentUserId,
          aud: "smoke-test",
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 300,
        },
      });
      const parts = jwt.split(".");
      check("signJwt produces 3-part JWT", parts.length === 3);
      // Decode and verify header
      const header = JSON.parse(
        atob(parts[0]!.replace(/-/g, "+").replace(/_/g, "/")),
      );
      check("signJwt header has ES256", header.alg === "ES256");
    } catch (err: any) {
      check("signJwt produces 3-part JWT", false, err.message);
    }
  }

  // Step 4d: Test signSshCommit helper
  if (session.accounts.length > 1 && session.accounts[1].publicKey) {
    console.log("\n3d. Testing signSshCommit helper...");
    try {
      const sig = await signSshCommit(agentClient, {
        organizationId: session.subOrganizationId,
        signingKey: session.accounts[1].publicKey,
        commitBuffer: "48656c6c6f20576f726c64", // "Hello World" hex
        publicKey: session.accounts[1].publicKey,
      });
      check(
        "signSshCommit produces armored signature",
        sig.startsWith("-----BEGIN SSH SIGNATURE-----"),
      );
      check(
        "signSshCommit has end marker",
        sig.endsWith("-----END SSH SIGNATURE-----\n"),
      );
    } catch (err: any) {
      check("signSshCommit produces armored signature", false, err.message);
    }
  }

  // Step 4e: Test signMessage helper
  if (session.accounts.length > 0 && session.accounts[0].publicKey) {
    console.log("\n3e. Testing signMessage helper...");
    try {
      const sig = await signMessage(agentClient, {
        organizationId: session.subOrganizationId,
        signingKey: session.accounts[0].publicKey,
        message:
          "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      });
      check(
        "signMessage returns r",
        typeof sig.r === "string" && sig.r.length === 64,
      );
      check(
        "signMessage returns s",
        typeof sig.s === "string" && sig.s.length === 64,
      );
    } catch (err: any) {
      check("signMessage returns r", false, err.message);
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
    await deleteAgentSession(
      {
        subOrganizationId: session.subOrganizationId,
        adminApiKey: session.adminApiKey,
      },
      { apiBaseUrl: API_BASE_URL },
    );
    check("Session deleted", true);
  } catch (err: any) {
    check("Session deleted", false, err.message);
  }

  // Step 6b: Double-delete should fail gracefully
  console.log("\n5b. Testing double-delete (should fail gracefully)...");
  try {
    await deleteAgentSession(
      {
        subOrganizationId: session.subOrganizationId,
        adminApiKey: session.adminApiKey,
      },
      { apiBaseUrl: API_BASE_URL },
    );
    check("Double-delete failed gracefully", false, "should have thrown");
  } catch {
    check("Double-delete failed gracefully", true);
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

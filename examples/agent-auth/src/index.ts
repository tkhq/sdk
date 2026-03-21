/**
 * Full lifecycle example for @turnkey/agent-auth
 *
 * Demonstrates:
 * - Creating an agent session with JWT + git signing accounts
 * - Custom policies beyond the default
 * - Signing with both P256 (JWT) and Ed25519 (git) keys
 * - HPKE export bundle for injecting keys into sandboxes
 * - Clean session teardown
 *
 * Usage:
 *   cp .env.local.example .env.local
 *   # Fill in your Turnkey credentials
 *   pnpm start
 */

import * as dotenv from "dotenv";
import * as path from "path";
import { Turnkey } from "@turnkey/sdk-server";
import {
  createAgentSession,
  deleteAgentSession,
  presets,
  policies,
} from "@turnkey/agent-auth";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  const organizationId = process.env.ORGANIZATION_ID!;

  // 1. Create the parent org client (orchestrator)
  const turnkey = new Turnkey({
    apiBaseUrl: process.env.BASE_URL!,
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    defaultOrganizationId: organizationId,
  });
  const parentClient = turnkey.apiClient();

  // 2. Provision an agent session
  //    - Two wallet accounts: P256 for JWT signing, Ed25519 for git signing
  //    - Git signing key exported via HPKE (for injection into a sandbox)
  //    - Default policy: allow sign_raw_payload
  //    - Custom policy: also allow sign_transaction
  console.log("Creating agent session...");
  const session = await createAgentSession(
    parentClient,
    {
      organizationId,
      agentName: `example-agent-${Date.now()}`,
      expirationSeconds: 3600,
      accounts: [presets.jwtSigning(), presets.gitSigning({ exportKey: true })],
      policies: [
        {
          policyName: "allow-sign-transaction",
          effect: "EFFECT_ALLOW",
          condition: "activity.type == 'ACTIVITY_TYPE_SIGN_TRANSACTION_V2'",
          consensus: "approvers.any(user, user.id == '<AGENT_USER_ID>')",
        },
      ],
    },
    { apiBaseUrl: process.env.BASE_URL! },
  );

  console.log("Session created:");
  console.log(`  Sub-org:    ${session.subOrganizationId}`);
  console.log(`  Agent user: ${session.agentUserId}`);
  console.log(`  Expires:    ${session.expiresAt}`);
  console.log(
    `  Accounts:   ${session.accounts.map((a) => a.label).join(", ")}`,
  );
  console.log(`  Policies:   ${session.policyIds.length}`);

  // The agent receives session.apiKey (expiring session key)
  // The orchestrator keeps session.adminApiKey (for deletion)
  // The agent NEVER gets the admin key
  console.log(`\n  Agent API key (give to agent): ${session.apiKey.publicKey}`);
  console.log(
    `  Admin API key (keep secret):   ${session.adminApiKey.publicKey}`,
  );

  // HPKE export bundle for the git signing key
  if (session.accounts[1]?.exportBundle) {
    console.log(
      `  Git key export bundle:         ${session.accounts[1].exportBundle.substring(0, 40)}...`,
    );
  }

  // 3. Use the agent's credential to sign
  //    In production, this would happen inside the agent's sandbox
  const agentTurnkey = new Turnkey({
    apiBaseUrl: process.env.BASE_URL!,
    apiPublicKey: session.apiKey.publicKey,
    apiPrivateKey: session.apiKey.privateKey,
    defaultOrganizationId: session.subOrganizationId,
  });
  const agentClient = agentTurnkey.apiClient();

  // Sign with P256 (JWT use case)
  console.log("\nSigning with P256 (JWT)...");
  const p256Result = await agentClient.signRawPayload({
    organizationId: session.subOrganizationId,
    signWith: session.accounts[0]!.publicKey,
    payload: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
    hashFunction: "HASH_FUNCTION_NO_OP",
  });
  console.log(
    `  Signature: ${JSON.stringify(p256Result.r?.substring(0, 20))}...`,
  );

  // Sign with Ed25519 (git commit signing use case)
  console.log("Signing with Ed25519 (git)...");
  const ed25519Result = await agentClient.signRawPayload({
    organizationId: session.subOrganizationId,
    signWith: session.accounts[1]!.publicKey,
    payload: "48656c6c6f20576f726c64",
    encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
    hashFunction: "HASH_FUNCTION_NOT_APPLICABLE",
  });
  console.log(
    `  Signature: ${JSON.stringify(ed25519Result.r?.substring(0, 20))}...`,
  );

  // 4. Verify policy enforcement: agent cannot create users
  console.log("\nVerifying policy enforcement...");
  try {
    await agentClient.createUsers({
      organizationId: session.subOrganizationId,
      users: [
        {
          userName: "unauthorized",
          userTags: [],
          apiKeys: [],
          authenticators: [],
          oauthProviders: [],
        },
      ],
    });
    console.log("  UNEXPECTED: createUsers should have been denied");
  } catch {
    console.log("  createUsers correctly blocked by implicit deny");
  }

  // 5. Clean up
  console.log("\nDeleting agent session...");
  await deleteAgentSession(
    {
      subOrganizationId: session.subOrganizationId,
      adminApiKey: session.adminApiKey,
    },
    { apiBaseUrl: process.env.BASE_URL! },
  );
  console.log("  Session deleted successfully");
}

main().catch(console.error);

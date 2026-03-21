/**
 * Minimal example: simplest possible agent session
 *
 * Demonstrates the minimum setup needed to provision and use an agent identity.
 * No wallet accounts, no custom policies, just the default sign_raw_payload permission.
 *
 * Usage:
 *   cp .env.local.example .env.local
 *   # Fill in your Turnkey credentials
 *   pnpm run minimal
 */

import * as dotenv from "dotenv";
import * as path from "path";
import { Turnkey } from "@turnkey/sdk-server";
import { createAgentSession, deleteAgentSession } from "@turnkey/agent-auth";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  const organizationId = process.env.ORGANIZATION_ID!;
  const apiBaseUrl = process.env.BASE_URL!;

  const turnkey = new Turnkey({
    apiBaseUrl,
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    defaultOrganizationId: organizationId,
  });

  // Create a minimal agent session (no wallets, default policy only)
  const session = await createAgentSession(
    turnkey.apiClient(),
    {
      organizationId,
      agentName: `minimal-agent-${Date.now()}`,
      expirationSeconds: 600, // 10 minutes
    },
    { apiBaseUrl },
  );

  console.log("Agent provisioned:");
  console.log(`  Sub-org: ${session.subOrganizationId}`);
  console.log(`  User:    ${session.agentUserId}`);
  console.log(`  Expires: ${session.expiresAt}`);

  // Hand session.apiKey to the agent, keep session.adminApiKey for cleanup

  // Clean up
  await deleteAgentSession(
    {
      subOrganizationId: session.subOrganizationId,
      adminApiKey: session.adminApiKey,
    },
    { apiBaseUrl },
  );
  console.log("Agent session deleted.");
}

main().catch(console.error);

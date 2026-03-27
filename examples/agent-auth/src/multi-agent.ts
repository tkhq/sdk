/**
 * Multi-agent example: provision a swarm of agents with different permissions
 *
 * Demonstrates:
 * - Creating multiple isolated agent sessions from the same parent org
 * - Different account configurations per agent
 * - Agent isolation (one agent cannot access another's sub-org)
 * - Batch cleanup
 *
 * Usage:
 *   cp .env.local.example .env.local
 *   # Fill in your Turnkey credentials
 *   pnpm run multi-agent
 */

import * as dotenv from "dotenv";
import * as path from "path";
import { Turnkey } from "@turnkey/sdk-server";
import {
  createAgentSession,
  deleteAgentSession,
  presets,
  type CreateAgentSessionResult,
} from "@turnkey/agent-auth";

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
  const parentClient = turnkey.apiClient();

  const sessions: CreateAgentSessionResult[] = [];

  try {
    // Agent 1: JWT signer (can mint JWTs for API authentication)
    console.log("Provisioning Agent 1 (JWT signer)...");
    const agent1 = await createAgentSession(
      parentClient,
      {
        organizationId,
        agentName: `jwt-signer-${Date.now()}`,
        expirationSeconds: 1800,
        accounts: [presets.jwtSigning()],
      },
      { apiBaseUrl },
    );
    sessions.push(agent1);
    console.log(`  Sub-org: ${agent1.subOrganizationId}`);

    // Agent 2: Git signer (can sign commits with Ed25519)
    console.log("Provisioning Agent 2 (Git signer)...");
    const agent2 = await createAgentSession(
      parentClient,
      {
        organizationId,
        agentName: `git-signer-${Date.now()}`,
        expirationSeconds: 1800,
        accounts: [presets.gitSigning({ exportKey: true })],
      },
      { apiBaseUrl },
    );
    sessions.push(agent2);
    console.log(`  Sub-org: ${agent2.subOrganizationId}`);

    // Agent 3: ETH signer (can sign Ethereum transactions)
    console.log("Provisioning Agent 3 (ETH signer)...");
    const agent3 = await createAgentSession(
      parentClient,
      {
        organizationId,
        agentName: `eth-signer-${Date.now()}`,
        expirationSeconds: 1800,
        accounts: [presets.ethSigning()],
      },
      { apiBaseUrl },
    );
    sessions.push(agent3);
    console.log(`  Sub-org: ${agent3.subOrganizationId}`);

    console.log(`\n${sessions.length} agents provisioned.`);

    // Verify isolation: Agent 1 cannot access Agent 2's sub-org
    console.log("\nVerifying agent isolation...");
    const agent1Client = new Turnkey({
      apiBaseUrl,
      apiPublicKey: agent1.apiKey.publicKey,
      apiPrivateKey: agent1.apiKey.privateKey,
      defaultOrganizationId: agent1.subOrganizationId,
    }).apiClient();

    try {
      // Agent 1 tries to sign with Agent 2's key (different sub-org)
      await agent1Client.signRawPayload({
        organizationId: agent2.subOrganizationId, // wrong sub-org
        signWith: agent2.accounts[0]!.publicKey,
        payload:
          "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
        hashFunction: "HASH_FUNCTION_NO_OP",
      });
      console.log("  UNEXPECTED: cross-agent access should be denied");
    } catch {
      console.log(
        "  Agent 1 correctly cannot access Agent 2's sub-org (isolation verified)",
      );
    }
  } finally {
    // Clean up all sessions
    console.log(`\nCleaning up ${sessions.length} agent sessions...`);
    for (const session of sessions) {
      try {
        await deleteAgentSession(
          {
            subOrganizationId: session.subOrganizationId,
            adminApiKey: session.adminApiKey,
          },
          { apiBaseUrl },
        );
        console.log(`  Deleted: ${session.subOrganizationId}`);
      } catch (err) {
        console.error(
          `  Failed to delete ${session.subOrganizationId}: ${err}`,
        );
      }
    }
    console.log("Done.");
  }
}

main().catch(console.error);

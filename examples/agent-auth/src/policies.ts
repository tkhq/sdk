/**
 * Policy templates example for @turnkey/agent-auth
 *
 * Demonstrates:
 * - Using composable policy templates instead of raw condition strings
 * - ETH transaction restrictions (chain, value, addresses)
 * - ERC-20 transfer policies
 * - Combining multiple policies for fine-grained access control
 *
 * Usage:
 *   cp .env.local.example .env.local
 *   # Fill in your Turnkey credentials
 *   pnpm run policies
 */

import * as dotenv from "dotenv";
import * as path from "path";
import { Turnkey } from "@turnkey/sdk-server";
import {
  createAgentSession,
  deleteAgentSession,
  presets,
  policyTemplates,
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

  // Provision an agent with fine-grained ETH policies
  console.log("Provisioning agent with policy templates...\n");
  const session = await createAgentSession(
    turnkey.apiClient(),
    {
      organizationId,
      agentName: `policy-example-${Date.now()}`,
      expirationSeconds: 600,
      accounts: [presets.ethSigning()],
      policies: [
        // Allow all signing operations (replaces default sign_raw_payload policy)
        policyTemplates.allowAllSigning(),

        // Allow ETH transactions on mainnet and Polygon, max 1 ETH
        policyTemplates.allowEthTransaction({
          chainIds: [1, 137],
          maxValue: "1000000000000000000",
        }),

        // Allow USDC transfers only
        policyTemplates.allowErc20Transfer({
          tokenAddress: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
        }),

        // Allow EIP-712 signing for Uniswap only
        policyTemplates.allowEip712Signing({
          domainName: "Uniswap",
        }),
      ],
    },
    { apiBaseUrl },
  );

  console.log("Agent provisioned with policy templates:");
  console.log(`  Sub-org: ${session.subOrganizationId}`);
  console.log(`  Policies created: ${session.policyIds.length}`);

  // Show what each policy allows
  console.log("\nPolicy breakdown:");
  console.log(
    "  1. allowAllSigning: sign_raw_payload + sign_transaction + sign_raw_payloads",
  );
  console.log(
    "  2. allowEthTransaction: ETH transfers on chains 1,137 up to 1 ETH",
  );
  console.log("  3. allowErc20Transfer: USDC transfers only");
  console.log("  4. allowEip712Signing: Uniswap typed data signing only");
  console.log("\nEverything else is blocked by implicit deny.");

  // Clean up
  console.log("\nCleaning up...");
  await deleteAgentSession(
    {
      subOrganizationId: session.subOrganizationId,
      adminApiKey: session.adminApiKey,
    },
    { apiBaseUrl },
  );
  console.log("Done.");
}

main().catch(console.error);

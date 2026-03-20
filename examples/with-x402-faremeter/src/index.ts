/**
 * Agentic Wallet Payments Demo
 *
 * This example shows how an AI agent can automatically pay for x402-protected
 * resources using Turnkey for secure wallet management.
 *
 * The key insight: once you have `x402Fetch`, you use it exactly like regular
 * `fetch()`. Payments happen automatically when a server returns HTTP 402.
 */

import * as dotenv from "dotenv";
import * as path from "path";
import { createX402Client } from "./x402-client.js";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

// ============================================================================
// AGENT DEMO
// ============================================================================

async function main() {
  console.log("🤖 Initializing Turnkey Agent...\n");

  // -------------------------------------------------------------------------
  // STEP 1: Validate configuration
  // -------------------------------------------------------------------------
  const apiPublicKey = process.env.API_PUBLIC_KEY;
  const apiPrivateKey = process.env.API_PRIVATE_KEY;
  const organizationId = process.env.ORGANIZATION_ID;

  if (!apiPublicKey || !apiPrivateKey || !organizationId) {
    console.error("❌ Missing required environment variables.");
    console.error("Please set the following in your .env.local file:");
    console.error("  - API_PUBLIC_KEY");
    console.error("  - API_PRIVATE_KEY");
    console.error("  - ORGANIZATION_ID");
    process.exit(1);
  }

  // -------------------------------------------------------------------------
  // STEP 2: Create the x402 payment client
  //
  // This is all the setup you need. The client handles:
  // - Turnkey authentication
  // - Wallet creation/retrieval
  // - Transaction signing
  // - Payment protocol negotiation
  // -------------------------------------------------------------------------
  const { x402Fetch, walletAddress, getBalances, network } =
    await createX402Client({
      apiPublicKey,
      apiPrivateKey,
      organizationId,
      rpcUrl: process.env.SOLANA_RPC_URL,
      baseUrl: process.env.BASE_URL,
    });

  console.log("✅ Turnkey client initialized");
  console.log(`✅ Agent wallet: ${walletAddress}`);

  // Check balances
  const { sol, usdc } = await getBalances();
  console.log(`💰 SOL Balance: ${sol} SOL`);
  console.log(`💵 USDC Balance: ${usdc.toFixed(2)} USDC\n`);

  if (sol < 0.01) {
    console.log("⚠️  Low SOL balance! Request an airdrop on devnet:");
    console.log(`   solana airdrop 1 ${walletAddress} --url devnet\n`);
  }

  if (usdc < 0.01) {
    console.log("⚠️  Low USDC balance! Get test USDC on devnet:");
    console.log(
      "   Visit: https://faucet.circle.com/ (select Solana Devnet)\n",
    );
  }

  console.log("✅ Faremeter x402 client ready\n");

  // -------------------------------------------------------------------------
  // STEP 3: Use x402Fetch in your agent
  //
  // THIS IS THE AGENT INTEGRATION POINT
  //
  // In a real agent, you would expose x402Fetch as a tool that the LLM can
  // call. For example:
  //
  //   const tools = [{
  //     name: "fetch_paid_resource",
  //     description: "Fetch data from a URL, automatically paying if required",
  //     execute: (url) => x402Fetch(url).then(r => r.text())
  //   }];
  //
  // The agent doesn't need to know about payments - they just happen.
  // -------------------------------------------------------------------------
  const testUrl = process.env.TEST_PAYWALL_URL;

  if (testUrl) {
    console.log(`📡 Fetching paywalled resource: ${testUrl}\n`);

    const initialBalances = { sol, usdc };

    try {
      // This is it! Use x402Fetch exactly like regular fetch.
      // If the server returns 402, payment is handled automatically.
      const response = await x402Fetch(testUrl);

      if (response.ok) {
        const content = await response.text();
        console.log("✅ Content received!");
        console.log("─".repeat(50));
        console.log(
          content.substring(0, 500) + (content.length > 500 ? "..." : ""),
        );
        console.log("─".repeat(50));
      } else if (response.status === 402) {
        const body = await response.text();
        console.log("❌ Payment failed (402). Server response:");
        try {
          console.log(JSON.stringify(JSON.parse(body), null, 2));
        } catch {
          console.log(body);
        }
        console.log("\n💡 Possible issues:");
        console.log("   - Insufficient USDC balance in wallet");
        console.log("   - Network mismatch (devnet vs mainnet)");
        console.log("   - Transaction verification failed on server");
      } else {
        console.log(
          `❌ Request failed: ${response.status} ${response.statusText}`,
        );
        console.log(await response.text());
      }
    } catch (error) {
      console.error("❌ Payment flow error:", error);
    }

    // Show what was spent
    const finalBalances = await getBalances();
    console.log(`\n💰 Final SOL balance: ${finalBalances.sol} SOL`);
    console.log(`💵 Final USDC balance: ${finalBalances.usdc.toFixed(2)} USDC`);
    console.log(
      `📊 SOL spent: ${(initialBalances.sol - finalBalances.sol).toFixed(6)} SOL`,
    );
    console.log(
      `📊 USDC spent: ${(initialBalances.usdc - finalBalances.usdc).toFixed(6)} USDC`,
    );
  } else {
    console.log("ℹ️  No TEST_PAYWALL_URL configured.");
    console.log("   Set this env var to test the x402 payment flow.\n");

    console.log("─".repeat(50));
    console.log("Agent Summary:");
    console.log(`  Wallet Address: ${walletAddress}`);
    console.log(`  SOL Balance: ${sol} SOL`);
    console.log(`  USDC Balance: ${usdc.toFixed(2)} USDC`);
    console.log(`  Network: ${network}`);
    console.log(`  Faremeter Client: ready`);
    console.log("─".repeat(50));
    console.log("\n✅ Agent ready for x402 payments!");
  }

  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

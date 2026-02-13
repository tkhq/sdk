import * as dotenv from "dotenv";
import * as path from "path";
import { Connection, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { Turnkey } from "@turnkey/sdk-server";
import { TurnkeySigner } from "@turnkey/solana";
import { wrapFetch } from "@faremeter/fetch";
import { getOrCreateSolanaWallet } from "./utils";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

/**
 * Agentic Wallet Payments Demo
 *
 * This example demonstrates how AI agents can use Turnkey wallets to:
 * 1. Authenticate with API keys (no browser/WebAuthn needed)
 * 2. Create or retrieve a Solana wallet
 * 3. Automatically pay for x402-protected resources using Faremeter
 *
 * The agent can autonomously pay for resources using the Faremeter x402 protocol.
 * See: https://github.com/faremeter/faremeter
 */
async function main() {
  console.log("🤖 Initializing Turnkey Agent...\n");

  const organizationId = process.env.ORGANIZATION_ID!;
  const apiPublicKey = process.env.API_PUBLIC_KEY!;
  const apiPrivateKey = process.env.API_PRIVATE_KEY!;

  if (!apiPublicKey || !apiPrivateKey || !organizationId) {
    console.error("❌ Missing required environment variables.");
    console.error("Please set the following in your .env.local file:");
    console.error("  - API_PUBLIC_KEY");
    console.error("  - API_PRIVATE_KEY");
    console.error("  - ORGANIZATION_ID");
    process.exit(1);
  }

  // 1. Initialize Turnkey client with API keys (headless auth)
  const turnkey = new Turnkey({
    apiBaseUrl: process.env.BASE_URL || "https://api.turnkey.com",
    apiPublicKey,
    apiPrivateKey,
    defaultOrganizationId: organizationId,
  });

  console.log("✅ Turnkey client initialized");

  // 2. Create Solana signer (used by Faremeter to sign payment transactions)
  const signer = new TurnkeySigner({
    organizationId,
    client: turnkey.apiClient(),
  });

  // 3. Get or create a Solana wallet
  const solanaAddress = await getOrCreateSolanaWallet(turnkey.apiClient());
  console.log(`✅ Agent wallet: ${solanaAddress}`);

  // 4. Check wallet balance
  const rpcUrl =
    process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
  const connection = new Connection(rpcUrl, "confirmed");
  const balance = await connection.getBalance(new PublicKey(solanaAddress));

  console.log(`💰 Balance: ${balance / LAMPORTS_PER_SOL} SOL\n`);

  if (balance < 0.01 * LAMPORTS_PER_SOL) {
    console.log("⚠️  Low balance! Request an airdrop on devnet:");
    console.log(`   solana airdrop 1 ${solanaAddress} --url devnet`);
    console.log(`   Or use: https://faucet.solana.com/\n`);
  }

  // 5. Create a Faremeter-wrapped fetch that handles x402 payment flows.
  //
  // When a request returns HTTP 402, Faremeter will:
  //   a) Parse the payment requirements from the response
  //   b) Build a Solana payment transaction
  //   c) Call our signer to sign it via Turnkey
  //   d) Submit payment proof and retry the original request
  const x402Fetch = wrapFetch(fetch, {
    paymentSigner: async (transaction) => {
      return await signer.signTransaction(transaction, solanaAddress);
    },
    network: "solana:devnet",
    facilitatorUrl: process.env.FAREMETER_FACILITATOR_URL,
  });

  console.log("✅ Faremeter x402 client ready\n");

  // 6. Attempt to fetch a paywalled resource
  const testUrl = process.env.TEST_PAYWALL_URL;

  if (testUrl) {
    console.log(`📡 Fetching paywalled resource: ${testUrl}\n`);

    try {
      // x402Fetch handles the full payment lifecycle automatically:
      // - If the server returns 200, the response is passed through as-is
      // - If the server returns 402, Faremeter negotiates payment and retries
      const response = await x402Fetch(testUrl);

      if (response.ok) {
        const content = await response.text();
        console.log("✅ Content received!");
        console.log("─".repeat(50));
        console.log(
          content.substring(0, 500) + (content.length > 500 ? "..." : ""),
        );
        console.log("─".repeat(50));
      } else {
        console.log(
          `❌ Request failed: ${response.status} ${response.statusText}`,
        );
      }
    } catch (error) {
      console.error("❌ Payment flow error:", error);
    }

    // Final balance check to show what was spent
    const finalBalance = await connection.getBalance(
      new PublicKey(solanaAddress),
    );
    console.log(`\n💰 Final balance: ${finalBalance / LAMPORTS_PER_SOL} SOL`);
    console.log(
      `📊 Spent: ${(balance - finalBalance) / LAMPORTS_PER_SOL} SOL`,
    );
  } else {
    console.log("ℹ️  No TEST_PAYWALL_URL configured.");
    console.log("   Set this env var to test the x402 payment flow.\n");

    // Summary
    console.log("─".repeat(50));
    console.log("Agent Summary:");
    console.log(`  Wallet Address: ${solanaAddress}`);
    console.log(`  Balance: ${balance / LAMPORTS_PER_SOL} SOL`);
    console.log(
      `  Network: ${rpcUrl.includes("devnet") ? "devnet" : "mainnet"}`,
    );
    console.log(`  x402 Client: ready`);
    console.log("─".repeat(50));
    console.log("\n✅ Agent ready for x402 payments!");
  }

  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

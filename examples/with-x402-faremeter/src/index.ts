import * as dotenv from "dotenv";
import * as path from "path";
import {
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  VersionedTransaction,
  TransactionMessage,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  getAccount,
  createTransferCheckedInstruction,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { ComputeBudgetProgram } from "@solana/web3.js";
import { Turnkey } from "@turnkey/sdk-server";
import { TurnkeySigner } from "@turnkey/solana";
import { wrap as wrapFetch } from "@faremeter/fetch";
import type { PaymentHandler, PaymentExecer } from "@faremeter/types/client";
import { getOrCreateSolanaWallet } from "./utils.js";

// USDC has 6 decimal places
const USDC_DECIMALS = 6;

/**
 * Wallet interface for signing transactions.
 */
interface GaslessWallet {
  publicKey: PublicKey;
  signTransaction: (tx: VersionedTransaction) => Promise<VersionedTransaction>;
}

interface PaymentContext {
  accepted: {
    scheme: string;
    network: string;
    amount: string;
    asset: string;
    payTo: string;
    maxTimeoutSeconds: number;
    extra?: Record<string, unknown>;
  };
}

// Track per-payment context by transaction payload to avoid cross-request state leaks.
const pendingPaymentContexts = new Map<string, PaymentContext>();

/**
 * Create a gasless payment handler for x402 servers that provide their own fee payer.
 *
 * Unlike faremeter's standard `exact` handler which makes the client pay transaction fees,
 * this handler builds transactions using the server's fee payer (from `extra.feePayer`).
 * The client only signs for the USDC transfer; the server/facilitator adds the fee payer signature.
 *
 * This enables gasless payments where:
 * - Server pays SOL transaction fees
 * - Client only needs USDC for the actual payment
 */
function createGaslessPaymentHandler(
  wallet: GaslessWallet,
  usdcMint: PublicKey,
  connection: Connection,
): PaymentHandler {
  return async (_ctx, accepts) => {
    const execers: PaymentExecer[] = [];

    for (const req of accepts) {
      // Check if this is a Solana requirement with a fee payer
      const extra = req.extra as Record<string, unknown> | undefined;
      const feePayer = extra?.feePayer as string | undefined;

      if (!feePayer) {
        // No fee payer provided - skip this requirement
        continue;
      }

      // Check network compatibility (support both canonical and CAIP-2 formats)
      const network = req.network.toLowerCase();
      const isSolana = network.includes("solana") || network.startsWith("solana:");

      if (!isSolana) {
        continue;
      }

      // Check asset matches our USDC mint
      if (req.asset.toLowerCase() !== usdcMint.toBase58().toLowerCase()) {
        continue;
      }

      execers.push({
        requirements: req,
        exec: async () => {
          const feePayerPubkey = new PublicKey(feePayer);
          const payToPubkey = new PublicKey(req.payTo);
          const amount = BigInt(req.maxAmountRequired);

          // Get or derive token accounts
          // payTo is a wallet address - we need to derive the ATA for the USDC mint
          const sourceAta = await getAssociatedTokenAddress(usdcMint, wallet.publicKey);
          const destAta = await getAssociatedTokenAddress(usdcMint, payToPubkey);

          // The x402 protocol requires exactly 3 instructions in this order:
          // 1. setComputeUnitLimit
          // 2. setComputeUnitPrice
          // 3. createTransferCheckedInstruction
          const computeUnitLimitIx = ComputeBudgetProgram.setComputeUnitLimit({
            units: 50000,
          });

          const computeUnitPriceIx = ComputeBudgetProgram.setComputeUnitPrice({
            microLamports: 1,
          });

          const transferIx = createTransferCheckedInstruction(
            sourceAta,
            usdcMint,
            destAta,
            wallet.publicKey, // owner/authority is our wallet
            amount,
            USDC_DECIMALS, // decimals
            [],
            TOKEN_PROGRAM_ID,
          );

          // Get recent blockhash (or use one from extra if provided)
          const extraBlockhash = extra?.recentBlockhash as string | undefined;
          const { blockhash } = extraBlockhash
            ? { blockhash: extraBlockhash }
            : await connection.getLatestBlockhash("confirmed");

          // Build transaction with SERVER's fee payer (not our wallet)
          // Instructions must be in exact order: computeUnitLimit, computeUnitPrice, transfer
          const message = new TransactionMessage({
            payerKey: feePayerPubkey, // Server pays fees
            recentBlockhash: blockhash,
            instructions: [computeUnitLimitIx, computeUnitPriceIx, transferIx],
          }).compileToV0Message();

          const tx = new VersionedTransaction(message);

          // Partially sign with our wallet only (server will add fee payer signature)
          const signedTx = await wallet.signTransaction(tx);

          // Serialize the partially-signed transaction
          const serialized = Buffer.from(signedTx.serialize()).toString("base64");

          // Preserve per-payment requirement context for v2 header adaptation.
          const originalNetwork =
            typeof (req as Record<string, unknown>).originalNetwork === "string"
              ? ((req as Record<string, unknown>).originalNetwork as string)
              : req.network;
          if (originalNetwork.includes(":")) {
            pendingPaymentContexts.set(serialized, {
              accepted: {
                scheme: req.scheme,
                network: originalNetwork,
                amount: req.maxAmountRequired,
                asset: req.asset,
                payTo: req.payTo,
                maxTimeoutSeconds: req.maxTimeoutSeconds,
                ...(req.extra
                  ? { extra: req.extra as Record<string, unknown> }
                  : {}),
              },
            });
          }

          return {
            payload: {
              transaction: serialized,
            },
          };
        },
      });
    }

    return execers;
  };
}

/**
 * Normalize an x402 v2 payment requirement to v1 format.
 *
 * The x402 Echo server returns v2 format with:
 *   - `amount` instead of `maxAmountRequired`
 *   - `description`, `mimeType`, `resource` nested inside `extra`
 *   - CAIP-2 network IDs like `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1`
 *
 * Faremeter expects v1 format with these fields at top-level and
 * canonical network names like `solana-devnet`.
 */
function normalizeRequirement(req: Record<string, unknown>): Record<string, unknown> {
  const normalized = { ...req };

  // amount → maxAmountRequired
  if (normalized.amount && !normalized.maxAmountRequired) {
    normalized.maxAmountRequired = normalized.amount;
  }

  // CAIP-2 network → canonical network name
  if (typeof normalized.network === "string" && normalized.network.startsWith("solana:")) {
    const genesisHash = normalized.network.split(":")[1];
    const networkMap: Record<string, string> = {
      "EtWTRABZaYq6iMfeYKouRu166VU2xqa1": "solana-devnet",
      "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp": "solana-mainnet-beta",
    };
    // Keep the original network in extra for the payment header
    normalized.originalNetwork = normalized.network;
    normalized.network = networkMap[genesisHash] ?? normalized.network;
  }

  // Promote extra fields to top-level (v2 → v1)
  const extra = normalized.extra as Record<string, unknown> | undefined;
  if (extra) {
    if (!normalized.description && extra.description) {
      normalized.description = extra.description;
    }
    if (normalized.mimeType === undefined && extra.mimeType !== undefined) {
      normalized.mimeType = extra.mimeType || "application/octet-stream";
    }
    if (!normalized.resource && extra.resource) {
      normalized.resource = extra.resource;
    }
  }

  // Ensure required string fields have defaults
  if (!normalized.description) normalized.description = "";
  if (!normalized.mimeType) normalized.mimeType = "application/octet-stream";
  if (!normalized.resource) normalized.resource = "";

  return normalized;
}

/**
 * Create a fetch wrapper that normalizes v2 402 responses to v1 format.
 */
function createV2NormalizingFetch(baseFetch: typeof fetch): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const response = await baseFetch(input, init);

    if (response.status !== 402) {
      return response;
    }

    const body = await response.json();

    // Normalize accepts array for faremeter
    if (body.accepts && Array.isArray(body.accepts)) {
      body.accepts = body.accepts.map(normalizeRequirement);
    }

    return new Response(JSON.stringify(body), {
      status: 402,
      statusText: response.statusText,
      headers: response.headers,
    });
  };
}

/**
 * Create a fetch wrapper that adapts payment headers for different server types.
 * - v1 servers (x402test, faremeter): Use X-PAYMENT with canonical network
 * - v2 servers (Echo): Use PAYMENT-SIGNATURE with CAIP-2 network and `accepted` field
 */
function createAdaptivePaymentFetch(baseFetch: typeof fetch): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const headers = new Headers(init?.headers);

    const xPayment = headers.get("X-PAYMENT");
    if (xPayment) {
      try {
        const payloadJson = atob(xPayment);
        const payload = JSON.parse(payloadJson) as Record<string, unknown>;
        const tx = (payload.payload as Record<string, unknown> | undefined)
          ?.transaction;

        if (typeof tx === "string") {
          const context = pendingPaymentContexts.get(tx);
          if (context) {
            const v2Payload = {
              x402Version: 2,
              scheme: context.accepted.scheme,
              network: context.accepted.network,
              accepted: context.accepted,
              payload: payload.payload,
              extensions: {},
            };

            // v2 servers use PAYMENT-SIGNATURE header
            const fixedPayment = btoa(JSON.stringify(v2Payload));
            headers.set("X-PAYMENT", fixedPayment);
            headers.set("PAYMENT-SIGNATURE", fixedPayment);
            pendingPaymentContexts.delete(tx);
          }
        }
        // For v1 servers, leave the payment as-is (canonical network, X-PAYMENT only)
      } catch {
        // If decoding fails, leave headers unchanged
      }
    }

    return baseFetch(input, { ...init, headers });
  };
}

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
 *
 * COMPATIBLE TEST SERVERS:
 *
 * 1. x402 Echo Server (recommended for devnet testing):
 *    - Set TEST_PAYWALL_URL=https://x402.payai.network/api/solana-devnet/paid-content
 *    - Uses gasless transactions (server pays SOL fees, you pay USDC)
 *    - Requires devnet USDC: https://faucet.circle.com/
 *
 * 2. Helius via Corbits (mainnet, requires real USDC):
 *    - Set TEST_PAYWALL_URL=https://helius.api.corbits.dev
 *    - Switch network to mainnet-beta
 *    - Costs ~$0.01 USDC per request
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

  // 4. Check wallet balances (SOL and USDC)
  const rpcUrl =
    process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
  const connection = new Connection(rpcUrl, "confirmed");
  const walletPubkey = new PublicKey(solanaAddress);
  const balance = await connection.getBalance(walletPubkey);

  // Determine network and USDC mint
  const network = rpcUrl.includes("devnet") ? "devnet" : "mainnet-beta";
  const usdcMint =
    network === "devnet"
      ? new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU") // USDC devnet
      : new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"); // USDC mainnet

  // Check USDC balance
  let usdcBalance = 0;
  try {
    const usdcAta = await getAssociatedTokenAddress(usdcMint, walletPubkey);
    const tokenAccount = await getAccount(connection, usdcAta);
    usdcBalance = Number(tokenAccount.amount) / Math.pow(10, USDC_DECIMALS);
  } catch {
    // Token account doesn't exist yet - balance is 0
  }

  console.log(`💰 SOL Balance: ${balance / LAMPORTS_PER_SOL} SOL`);
  console.log(`💵 USDC Balance: ${usdcBalance.toFixed(2)} USDC\n`);

  if (balance < 0.01 * LAMPORTS_PER_SOL) {
    console.log("⚠️  Low SOL balance! Request an airdrop on devnet:");
    console.log(`   solana airdrop 1 ${solanaAddress} --url devnet`);
    console.log(`   Or use: https://faucet.solana.com/\n`);
  }

  if (usdcBalance < 0.01) {
    console.log("⚠️  Low USDC balance! Get test USDC on devnet:");
    console.log(`   Visit: https://faucet.circle.com/ (select Solana Devnet)\n`);
  }

  // 5. Create a Turnkey wallet adapter for signing transactions
  const turnkeyWallet: GaslessWallet = {
    publicKey: walletPubkey,
    signTransaction: async (tx: VersionedTransaction) => {
      const signedTx = await signer.signTransaction(tx, solanaAddress);
      return signedTx as VersionedTransaction;
    },
  };

  // 6. Create the gasless payment handler
  //
  // This handler builds transactions using the server's fee payer (from extra.feePayer),
  // allowing gasless payments where the server covers SOL transaction fees.
  // The handler:
  //   a) Parses payment requirements from the 402 response
  //   b) Builds a USDC transfer with the server's fee payer
  //   c) Partially signs with Turnkey (server adds fee payer signature)
  //   d) Returns the transaction for faremeter to send in X-PAYMENT header
  const gaslessHandler = createGaslessPaymentHandler(turnkeyWallet, usdcMint, connection);

  // Create fetch wrappers for protocol compatibility:
  // - normalizingFetch: Converts v2 402 responses to v1 format for faremeter
  // - adaptiveFetch: Adjusts payment headers based on server's protocol version
  const normalizingFetch = createV2NormalizingFetch(fetch);
  const adaptiveFetch = createAdaptivePaymentFetch(fetch);

  const x402Fetch = wrapFetch(adaptiveFetch, {
    handlers: [gaslessHandler],
    // Use normalizing fetch for initial request to handle v2 servers
    phase1Fetch: normalizingFetch,
    // Retry up to 3 times if payment fails
    retryCount: 3,
    // Return the 402 response instead of throwing if payment fails
    returnPaymentFailure: true,
  });

  console.log("✅ Faremeter x402 client ready\n");

  // 7. Attempt to fetch a paywalled resource
  const testUrl = process.env.TEST_PAYWALL_URL;

  if (testUrl) {
    console.log(`📡 Fetching paywalled resource: ${testUrl}\n`);

    try {
      // x402Fetch handles the full payment lifecycle automatically:
      // - If the server returns 200, the response is passed through as-is
      // - If the server returns 402, faremeter builds a payment transaction,
      //   signs it via Turnkey, and retries with the X-PAYMENT header
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
        // Payment failed - log the server's response for debugging
        const body = await response.text();
        console.log(`❌ Payment failed (402). Server response:`);
        try {
          const parsed = JSON.parse(body);
          console.log(JSON.stringify(parsed, null, 2));

          console.log("\n💡 Possible issues:");
          console.log("   - Insufficient USDC balance in wallet");
          console.log("   - Network mismatch (devnet vs mainnet)");
          console.log("   - Transaction verification failed on server");
          if (parsed.error) {
            console.log(`   - Server error: ${parsed.error}`);
          }
        } catch {
          console.log(body);
        }
      } else {
        console.log(
          `❌ Request failed: ${response.status} ${response.statusText}`,
        );
        const body = await response.text();
        console.log(body);
      }
    } catch (error) {
      console.error("❌ Payment flow error:", error);
    }

    // Final balance check to show what was spent
    const finalSolBalance = await connection.getBalance(walletPubkey);
    let finalUsdcBalance = 0;
    try {
      const usdcAta = await getAssociatedTokenAddress(usdcMint, walletPubkey);
      const tokenAccount = await getAccount(connection, usdcAta);
      finalUsdcBalance = Number(tokenAccount.amount) / Math.pow(10, USDC_DECIMALS);
    } catch {
      // Token account doesn't exist
    }

    console.log(`\n💰 Final SOL balance: ${finalSolBalance / LAMPORTS_PER_SOL} SOL`);
    console.log(`💵 Final USDC balance: ${finalUsdcBalance.toFixed(2)} USDC`);
    console.log(`📊 SOL spent: ${(balance - finalSolBalance) / LAMPORTS_PER_SOL} SOL`);
    console.log(`📊 USDC spent: ${(usdcBalance - finalUsdcBalance).toFixed(6)} USDC`);
  } else {
    console.log("ℹ️  No TEST_PAYWALL_URL configured.");
    console.log("   Set this env var to test the x402 payment flow.\n");

    // Summary
    console.log("─".repeat(50));
    console.log("Agent Summary:");
    console.log(`  Wallet Address: ${solanaAddress}`);
    console.log(`  SOL Balance: ${balance / LAMPORTS_PER_SOL} SOL`);
    console.log(`  USDC Balance: ${usdcBalance.toFixed(2)} USDC`);
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

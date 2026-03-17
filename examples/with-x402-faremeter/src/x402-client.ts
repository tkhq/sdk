import {
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  VersionedTransaction,
} from "@solana/web3.js";
import { getAssociatedTokenAddress, getAccount } from "@solana/spl-token";
import { Turnkey } from "@turnkey/sdk-server";
import { TurnkeySigner } from "@turnkey/solana";
import { wrap as wrapFetch } from "@faremeter/fetch";
import { createPaymentHandler } from "@faremeter/payment-solana/exact";
import { getOrCreateSolanaWallet } from "./utils.js";

// ============================================================================
// CONSTANTS
// ============================================================================

const USDC_DECIMALS = 6;

const USDC_MINTS = {
  devnet: new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"),
  "mainnet-beta": new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"),
};

// ============================================================================
// TYPES
// ============================================================================

export interface X402ClientConfig {
  apiPublicKey: string;
  apiPrivateKey: string;
  organizationId: string;
  rpcUrl?: string;
  baseUrl?: string;
}

export interface X402Client {
  /** Payment-enabled fetch - use this like regular fetch, payments are automatic */
  x402Fetch: typeof fetch;
  /** The Solana wallet address used for payments */
  walletAddress: string;
  /** Get current SOL and USDC balances */
  getBalances: () => Promise<{ sol: number; usdc: number }>;
  /** The detected network (devnet or mainnet-beta) */
  network: "devnet" | "mainnet-beta";
}

/**
 * Wallet interface compatible with faremeter's payment handler.
 * See: https://docs.corbits.dev/api/reference/payment-solana/overview
 */
interface TurnkeyWallet {
  network: string;
  publicKey: PublicKey;
  updateTransaction: (
    tx: VersionedTransaction,
  ) => Promise<VersionedTransaction>;
  partiallySignTransaction: (
    tx: VersionedTransaction,
  ) => Promise<VersionedTransaction>;
}

// ============================================================================
// MAIN FACTORY FUNCTION
// ============================================================================

/**
 * Create an x402 payment client.
 *
 * This sets up all the infrastructure needed for an agent to make
 * automatic payments to x402-protected endpoints.
 *
 * @example
 * ```typescript
 * const { x402Fetch, walletAddress, getBalances } = await createX402Client({
 *   apiPublicKey: process.env.API_PUBLIC_KEY!,
 *   apiPrivateKey: process.env.API_PRIVATE_KEY!,
 *   organizationId: process.env.ORGANIZATION_ID!,
 * });
 *
 * // Use x402Fetch like regular fetch - payments are automatic
 * const response = await x402Fetch("https://paid-api.example.com/data");
 * ```
 */
export async function createX402Client(
  config: X402ClientConfig,
): Promise<X402Client> {
  const { apiPublicKey, apiPrivateKey, organizationId } = config;
  const rpcUrl = config.rpcUrl ?? "https://api.devnet.solana.com";
  const baseUrl = config.baseUrl ?? "https://api.turnkey.com";

  // Initialize Turnkey client
  const turnkey = new Turnkey({
    apiBaseUrl: baseUrl,
    apiPublicKey,
    apiPrivateKey,
    defaultOrganizationId: organizationId,
  });

  // Create Solana signer
  const signer = new TurnkeySigner({
    organizationId,
    client: turnkey.apiClient(),
  });

  // Get or create wallet
  const walletAddress = await getOrCreateSolanaWallet(turnkey.apiClient());
  const walletPubkey = new PublicKey(walletAddress);

  // Set up connection and detect network
  const connection = new Connection(rpcUrl, "confirmed");
  const network = rpcUrl.includes("devnet") ? "devnet" : "mainnet-beta";
  const usdcMint = USDC_MINTS[network];

  // Create Turnkey wallet adapter compatible with faremeter's interface.
  // Both `updateTransaction` and `partiallySignTransaction` delegate to
  // Turnkey's signer — the distinction is for faremeter's internal flow.
  // See: https://docs.corbits.dev/api/reference/payment-solana/overview
  const signWithTurnkey = async (
    tx: VersionedTransaction,
  ): Promise<VersionedTransaction> => {
    const signedTx = await signer.signTransaction(tx, walletAddress);
    return signedTx as VersionedTransaction;
  };

  const wallet: TurnkeyWallet = {
    network,
    publicKey: walletPubkey,
    updateTransaction: signWithTurnkey,
    partiallySignTransaction: signWithTurnkey,
  };

  // Create payment handler using faremeter's exact payment implementation.
  // This handles gasless transactions (fee payer in extra.feePayer) automatically.
  const paymentHandler = createPaymentHandler(wallet, usdcMint, connection);

  // Create the payment-enabled fetch.
  // As of faremeter v0.17.0, protocol normalization (lenient 402 responses,
  // CAIP-2 network identifiers) and x402 v2 headers are handled internally.
  const x402Fetch = wrapFetch(fetch, {
    handlers: [paymentHandler],
    retryCount: 3,
    returnPaymentFailure: true,
  });

  // Balance helper
  const getBalances = async (): Promise<{ sol: number; usdc: number }> => {
    const solBalance = await connection.getBalance(walletPubkey);
    let usdcBalance = 0;
    try {
      const usdcAta = await getAssociatedTokenAddress(usdcMint, walletPubkey);
      const tokenAccount = await getAccount(connection, usdcAta);
      usdcBalance = Number(tokenAccount.amount) / Math.pow(10, USDC_DECIMALS);
    } catch {
      // Token account doesn't exist yet
    }
    return {
      sol: solBalance / LAMPORTS_PER_SOL,
      usdc: usdcBalance,
    };
  };

  return {
    x402Fetch,
    walletAddress,
    getBalances,
    network,
  };
}

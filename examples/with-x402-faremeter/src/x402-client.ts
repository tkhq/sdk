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

// Genesis hashes are fixed per Solana cluster and are the authoritative
// way to identify which network an RPC endpoint is serving.
const GENESIS_HASHES: Record<string, "devnet" | "mainnet-beta"> = {
  EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG: "devnet",
  "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d": "mainnet-beta",
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
  /**
   * Override the detected Solana network. If unset, the network is
   * detected by calling `getGenesisHash()` on the RPC endpoint.
   */
  network?: "devnet" | "mainnet-beta";
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

  // Set up connection and resolve network via genesis hash (or explicit override)
  const connection = new Connection(rpcUrl, "confirmed");
  let network: "devnet" | "mainnet-beta";
  if (config.network) {
    network = config.network;
  } else {
    const genesisHash = await connection.getGenesisHash();
    const detected = GENESIS_HASHES[genesisHash];
    if (!detected) {
      throw new Error(
        `Unknown Solana cluster (genesis hash: ${genesisHash}). ` +
          `Only devnet and mainnet-beta are supported. ` +
          `Pass an explicit 'network' in X402ClientConfig to override.`,
      );
    }
    network = detected;
  }
  const usdcMint = USDC_MINTS[network];

  // Faremeter assembles the payment transaction (fee payer from
  // requirements.extra.feePayer, blockhash, SPL transfer instructions) and
  // then calls partiallySignTransaction to have the payer wallet add its
  // signature. Turnkey signs without exposing the private key.
  // See: https://docs.corbits.dev/api/reference/payment-solana/overview
  const wallet: TurnkeyWallet = {
    network,
    publicKey: walletPubkey,
    partiallySignTransaction: async (tx) =>
      (await signer.signTransaction(tx, walletAddress)) as VersionedTransaction,
  };

  // Create payment handler using faremeter's exact payment implementation.
  // This handles gasless transactions (fee payer in extra.feePayer) automatically.
  const paymentHandler = createPaymentHandler(wallet, usdcMint, connection);

  // Some x402 servers send a PAYMENT-REQUIRED header (v2) but omit the
  // required `resource` object. This minimal phase1Fetch patches that so
  // faremeter's v2 validation passes. Once servers fully implement v2,
  // this can be removed and plain `fetch` used for both.
  const patchV2Fetch: typeof fetch = async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const response = await fetch(input, init);
    if (response.status !== 402) return response;

    const v2Header = response.headers.get("PAYMENT-REQUIRED");
    if (!v2Header) return response;

    try {
      const decoded = JSON.parse(atob(v2Header));
      if (!decoded.resource) {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;
        decoded.resource = { url };
        const headers = new Headers(response.headers);
        headers.set("PAYMENT-REQUIRED", btoa(JSON.stringify(decoded)));
        return new Response(response.body, {
          status: 402,
          statusText: response.statusText,
          headers,
        });
      }
    } catch {
      // If decoding fails, let faremeter handle the error
    }
    return response;
  };

  // Create the payment-enabled fetch.
  // As of faremeter v0.17.0, protocol normalization (lenient v1 responses,
  // CAIP-2 network identifiers) and x402 v2 headers are handled internally.
  const x402Fetch = wrapFetch(fetch, {
    handlers: [paymentHandler],
    phase1Fetch: patchV2Fetch,
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

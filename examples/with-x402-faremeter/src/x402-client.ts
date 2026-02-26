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
const SOLANA_DEVNET_CAIP2 = "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1";
const SOLANA_MAINNET_CAIP2 = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";

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
  // The `updateTransaction` hook is called by faremeter to sign the payment transaction.
  // See: https://docs.corbits.dev/api/reference/payment-solana/overview
  const wallet: TurnkeyWallet = {
    network,
    publicKey: walletPubkey,
    updateTransaction: async (tx: VersionedTransaction) => {
      const signedTx = await signer.signTransaction(tx, walletAddress);
      return signedTx as VersionedTransaction;
    },
  };

  // Create payment handler using faremeter's exact payment implementation.
  // This handles gasless transactions (fee payer in extra.feePayer) automatically.
  const paymentHandler = createPaymentHandler(wallet, usdcMint, connection);

  // Track payment context for v2 header formatting
  const pendingPaymentContexts = new Map<string, PaymentContext>();

  // Create normalizing fetch to handle servers that don't include all required fields.
  // This adds missing fields (description, mimeType, resource) and converts
  // `amount` to `maxAmountRequired` for protocol compatibility.
  const normalizingFetch = createNormalizingFetch(fetch, pendingPaymentContexts);

  // Create adaptive fetch that adds PAYMENT-SIGNATURE header with v2 format
  const adaptiveFetch = createAdaptivePaymentFetch(fetch, pendingPaymentContexts);

  // Create the payment-enabled fetch
  const x402Fetch = wrapFetch(adaptiveFetch, {
    handlers: [paymentHandler],
    phase1Fetch: normalizingFetch,
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

// ============================================================================
// INTERNAL: Protocol normalization
// ============================================================================

/**
 * Normalize a payment requirement to include all fields faremeter expects.
 * Some x402 servers omit optional fields or use `amount` instead of `maxAmountRequired`.
 */
function normalizeRequirement(
  req: Record<string, unknown>,
): Record<string, unknown> {
  const normalized = { ...req };

  // Convert `amount` to `maxAmountRequired` (protocol variation)
  if (normalized.amount && !normalized.maxAmountRequired) {
    normalized.maxAmountRequired = normalized.amount;
  }

  // Convert CAIP-2 network identifiers to faremeter's expected format
  if (
    typeof normalized.network === "string" &&
    normalized.network.startsWith("solana:")
  ) {
    const genesisHash = normalized.network.split(":")[1];
    const networkMap: Record<string, string> = {
      [SOLANA_DEVNET_CAIP2.split(":")[1]]: "solana-devnet",
      [SOLANA_MAINNET_CAIP2.split(":")[1]]: "solana-mainnet-beta",
    };
    normalized.originalNetwork = normalized.network;
    normalized.network = networkMap[genesisHash] ?? normalized.network;
  }

  // Extract fields from `extra` if not present at top level
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

  // Provide defaults for required fields that faremeter validates
  if (!normalized.description) normalized.description = "";
  if (!normalized.mimeType) normalized.mimeType = "application/octet-stream";
  if (!normalized.resource) normalized.resource = "";

  return normalized;
}

/**
 * Wrap fetch to normalize 402 responses before faremeter parses them.
 * This handles servers that don't include all fields faremeter requires.
 * Also stores original payment context for v2 header formatting.
 */
function createNormalizingFetch(
  baseFetch: typeof fetch,
  pendingPaymentContexts: Map<string, PaymentContext>,
): typeof fetch {
  return async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const response = await baseFetch(input, init);

    if (response.status !== 402) {
      return response;
    }

    const bodyText = await response.text();
    const headers = new Headers(response.headers);
    const contentType = headers.get("content-type")?.toLowerCase() ?? "";
    const isJsonResponse =
      contentType.includes("application/json") ||
      contentType.includes("+json") ||
      bodyText.trim().startsWith("{") ||
      bodyText.trim().startsWith("[");

    if (!isJsonResponse) {
      return new Response(bodyText, {
        status: 402,
        statusText: response.statusText,
        headers,
      });
    }

    let body: unknown;
    try {
      body = JSON.parse(bodyText);
    } catch {
      return new Response(bodyText, {
        status: 402,
        statusText: response.statusText,
        headers,
      });
    }

    if (!body || typeof body !== "object") {
      return new Response(bodyText, {
        status: 402,
        statusText: response.statusText,
        headers,
      });
    }

    const normalizedBody = body as Record<string, unknown>;

    if (Array.isArray(normalizedBody.accepts)) {
      normalizedBody.accepts = normalizedBody.accepts.map((accept) => {
        if (!accept || typeof accept !== "object") {
          return accept;
        }
        return normalizeRequirement(accept as Record<string, unknown>);
      });
    }

    // Store payment context for each requirement (for v2 header formatting later)
    if (Array.isArray(normalizedBody.accepts)) {
      for (const accept of normalizedBody.accepts) {
        if (accept && typeof accept === "object") {
          const req = accept as Record<string, unknown>;
          const originalNetwork = req.originalNetwork as string | undefined;
          if (originalNetwork) {
            // Key by payTo+amount+asset to match later
            const key = `${req.payTo}:${req.maxAmountRequired}:${req.asset}`;
            pendingPaymentContexts.set(key, {
              accepted: {
                scheme: (req.scheme as string) || "exact",
                network: originalNetwork,
                amount: req.maxAmountRequired as string,
                asset: req.asset as string,
                payTo: req.payTo as string,
                maxTimeoutSeconds: (req.maxTimeoutSeconds as number) || 60,
                ...(req.extra
                  ? { extra: req.extra as Record<string, unknown> }
                  : {}),
              },
            });
          }
        }
      }
    }

    return new Response(JSON.stringify(normalizedBody), {
      status: 402,
      statusText: response.statusText,
      headers,
    });
  };
}

/**
 * Wrap fetch to add PAYMENT-SIGNATURE header with v2 format.
 * This is required by servers expecting x402 v2 protocol.
 */
function createAdaptivePaymentFetch(
  baseFetch: typeof fetch,
  pendingPaymentContexts: Map<string, PaymentContext>,
): typeof fetch {
  return async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const headers = new Headers(init?.headers);

    const xPayment = headers.get("X-PAYMENT");
    if (xPayment) {
      try {
        const payloadJson = atob(xPayment);
        const payload = JSON.parse(payloadJson) as Record<string, unknown>;

        // Find matching context by looking at all stored contexts
        // and use the first one (since we typically have one payment at a time)
        const contexts = Array.from(pendingPaymentContexts.entries());
        if (contexts.length > 0) {
          const [key, context] = contexts[0];

          const v2Payload = {
            x402Version: 2,
            scheme: context.accepted.scheme,
            network: context.accepted.network,
            accepted: context.accepted,
            payload: payload.payload ?? payload,
            extensions: {},
          };

          const fixedPayment = btoa(JSON.stringify(v2Payload));
          headers.set("X-PAYMENT", fixedPayment);
          headers.set("PAYMENT-SIGNATURE", fixedPayment);
          pendingPaymentContexts.delete(key);
        } else {
          // No stored context, just copy X-PAYMENT to PAYMENT-SIGNATURE
          headers.set("PAYMENT-SIGNATURE", xPayment);
        }
      } catch {
        // If decoding fails, just copy the header
        headers.set("PAYMENT-SIGNATURE", xPayment);
      }
    }

    return baseFetch(input, { ...init, headers });
  };
}

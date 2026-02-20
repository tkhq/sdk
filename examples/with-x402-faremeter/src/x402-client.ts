import {
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  VersionedTransaction,
  TransactionMessage,
  ComputeBudgetProgram,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  getAccount,
  createTransferCheckedInstruction,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Turnkey } from "@turnkey/sdk-server";
import { TurnkeySigner } from "@turnkey/solana";
import { wrap as wrapFetch } from "@faremeter/fetch";
import type { PaymentHandler, PaymentExecer } from "@faremeter/types/client";
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
  const expectedNetworks = getExpectedRequirementNetworks(network);

  // Create wallet adapter for signing
  const wallet: GaslessWallet = {
    publicKey: walletPubkey,
    signTransaction: async (tx: VersionedTransaction) => {
      const signedTx = await signer.signTransaction(tx, walletAddress);
      return signedTx as VersionedTransaction;
    },
  };

  // Track per-payment context (module-private state)
  const pendingPaymentContexts = new Map<string, PaymentContext>();

  // Create the payment handler
  const gaslessHandler = createGaslessPaymentHandler(
    wallet,
    usdcMint,
    connection,
    expectedNetworks,
    network,
    pendingPaymentContexts,
  );

  // Create fetch wrappers for protocol compatibility
  const normalizingFetch = createV2NormalizingFetch(fetch);
  const adaptiveFetch = createAdaptivePaymentFetch(fetch, pendingPaymentContexts);

  // Create the payment-enabled fetch
  const x402Fetch = wrapFetch(adaptiveFetch, {
    handlers: [gaslessHandler],
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
// INTERNAL: Protocol helpers (not exported)
// ============================================================================

function getExpectedRequirementNetworks(
  network: "devnet" | "mainnet-beta",
): Set<string> {
  if (network === "devnet") {
    return new Set(["solana-devnet", SOLANA_DEVNET_CAIP2.toLowerCase()]);
  }
  return new Set([
    "solana-mainnet-beta",
    "solana",
    SOLANA_MAINNET_CAIP2.toLowerCase(),
  ]);
}

function createGaslessPaymentHandler(
  wallet: GaslessWallet,
  usdcMint: PublicKey,
  connection: Connection,
  expectedNetworks: ReadonlySet<string>,
  configuredNetworkLabel: string,
  pendingPaymentContexts: Map<string, PaymentContext>,
): PaymentHandler {
  return async (_ctx, accepts) => {
    const execers: PaymentExecer[] = [];
    const incompatibilityReasons: string[] = [];
    let sawSolanaRequirement = false;

    for (const req of accepts) {
      const requirementNetwork = req.network.toLowerCase();
      const isSolana =
        requirementNetwork.includes("solana") ||
        requirementNetwork.startsWith("solana:");

      if (!isSolana) continue;
      sawSolanaRequirement = true;

      if (!expectedNetworks.has(requirementNetwork)) {
        incompatibilityReasons.push(
          `network '${req.network}' does not match configured RPC network '${configuredNetworkLabel}'`,
        );
        continue;
      }

      const extra = req.extra as Record<string, unknown> | undefined;
      const feePayer = extra?.feePayer as string | undefined;
      if (!feePayer) {
        incompatibilityReasons.push(
          `requirement for network '${req.network}' is missing extra.feePayer`,
        );
        continue;
      }

      if (req.asset.toLowerCase() !== usdcMint.toBase58().toLowerCase()) {
        incompatibilityReasons.push(
          `asset mismatch for network '${req.network}': got ${req.asset}, expected ${usdcMint.toBase58()}`,
        );
        continue;
      }

      execers.push({
        requirements: req,
        exec: async () => {
          const feePayerPubkey = new PublicKey(feePayer);
          const payToPubkey = new PublicKey(req.payTo);
          const amount = BigInt(req.maxAmountRequired);

          const sourceAta = await getAssociatedTokenAddress(
            usdcMint,
            wallet.publicKey,
          );
          const destAta = await getAssociatedTokenAddress(usdcMint, payToPubkey);

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
            wallet.publicKey,
            amount,
            USDC_DECIMALS,
            [],
            TOKEN_PROGRAM_ID,
          );

          const extraBlockhash = extra?.recentBlockhash as string | undefined;
          const { blockhash } = extraBlockhash
            ? { blockhash: extraBlockhash }
            : await connection.getLatestBlockhash("confirmed");

          const message = new TransactionMessage({
            payerKey: feePayerPubkey,
            recentBlockhash: blockhash,
            instructions: [computeUnitLimitIx, computeUnitPriceIx, transferIx],
          }).compileToV0Message();

          const tx = new VersionedTransaction(message);
          const signedTx = await wallet.signTransaction(tx);
          const serialized = Buffer.from(signedTx.serialize()).toString("base64");

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

          return { payload: { transaction: serialized } };
        },
      });
    }

    if (
      execers.length === 0 &&
      sawSolanaRequirement &&
      incompatibilityReasons.length > 0
    ) {
      const hint = `Expected one of: ${Array.from(expectedNetworks).join(", ")}`;
      throw new Error(
        `No compatible Solana payment requirements found. ${hint}. Reasons: ${incompatibilityReasons.join("; ")}`,
      );
    }

    return execers;
  };
}

function normalizeRequirement(
  req: Record<string, unknown>,
): Record<string, unknown> {
  const normalized = { ...req };

  if (normalized.amount && !normalized.maxAmountRequired) {
    normalized.maxAmountRequired = normalized.amount;
  }

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

  if (!normalized.description) normalized.description = "";
  if (!normalized.mimeType) normalized.mimeType = "application/octet-stream";
  if (!normalized.resource) normalized.resource = "";

  return normalized;
}

function createV2NormalizingFetch(baseFetch: typeof fetch): typeof fetch {
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

    return new Response(JSON.stringify(normalizedBody), {
      status: 402,
      statusText: response.statusText,
      headers,
    });
  };
}

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

            const fixedPayment = btoa(JSON.stringify(v2Payload));
            headers.set("X-PAYMENT", fixedPayment);
            headers.set("PAYMENT-SIGNATURE", fixedPayment);
            pendingPaymentContexts.delete(tx);
          }
        }
      } catch {
        // If decoding fails, leave headers unchanged
      }
    }

    return baseFetch(input, { ...init, headers });
  };
}

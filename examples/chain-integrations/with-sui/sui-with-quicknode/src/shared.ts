import * as dotenv from "dotenv";
import * as path from "path";
import { SuiGrpcClient } from "@mysten/sui/grpc";
import { Ed25519PublicKey } from "@mysten/sui/keypairs/ed25519";
import { normalizeStructTag } from "@mysten/sui/utils";
import { Turnkey } from "@turnkey/sdk-server";

// Load .env.local from the example's working directory.
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

/**
 * Public Sui gRPC fullnode URLs, used as fallbacks when `QUICKNODE_SUI_URL`
 * is not set. Sourced from the `@mysten/sui/grpc` docs; production
 * deployments should point at a dedicated QuickNode Sui endpoint.
 */
const PUBLIC_SUI_GRPC_URLS: Record<"testnet" | "mainnet", string> = {
  testnet: "https://fullnode.testnet.sui.io:443",
  mainnet: "https://fullnode.mainnet.sui.io:443",
};

/**
 * Serialize a raw Ed25519 signature (r||s) into Sui's flagged, base64
 * signature format: [0x00 scheme flag || 64B r||s || 32B pubkey].
 */
export function toSerializedSignature({
  signature,
  pubKey,
}: {
  signature: Uint8Array;
  pubKey: Ed25519PublicKey;
}): string {
  const scheme = new Uint8Array([0x00]); // ED25519 flag
  const pubKeyBytes = pubKey.toRawBytes();
  const serialized = new Uint8Array(
    scheme.length + signature.length + pubKeyBytes.length,
  );
  serialized.set(scheme, 0);
  serialized.set(signature, scheme.length);
  serialized.set(pubKeyBytes, scheme.length + signature.length);
  return Buffer.from(serialized).toString("base64");
}

/**
 * Build a Turnkey server SDK client from environment variables.
 * Turnkey is used exclusively for signing; RPC/broadcast/read traffic goes
 * through the node provider configured in {@link getSuiClient}.
 */
export function getTurnkeyClient(): Turnkey {
  const { ORGANIZATION_ID, API_PRIVATE_KEY, API_PUBLIC_KEY, BASE_URL } =
    process.env;

  if (!ORGANIZATION_ID || !API_PRIVATE_KEY || !API_PUBLIC_KEY) {
    throw new Error(
      "ORGANIZATION_ID, API_PRIVATE_KEY, and API_PUBLIC_KEY must be set in .env.local",
    );
  }

  return new Turnkey({
    apiBaseUrl: BASE_URL || "https://api.turnkey.com",
    apiPrivateKey: API_PRIVATE_KEY,
    apiPublicKey: API_PUBLIC_KEY,
    defaultOrganizationId: ORGANIZATION_ID,
  });
}

// Guard so the public-fullnode fallback warning fires at most once per
// process, regardless of how many `getSuiClient()` callers there are.
let publicFallbackWarned = false;

/**
 * Build a {@link SuiGrpcClient} pointed at the configured node provider.
 *
 * Precedence:
 *   1. `QUICKNODE_SUI_URL` (recommended for production and demos — QuickNode
 *      is the node provider used in this example, and supports Sui gRPC on
 *      both mainnet and testnet).
 *   2. The public testnet gRPC fullnode so the example runs out-of-the-box
 *      without a QuickNode key. Emits a one-shot `console.warn` on fallback
 *      so callers don't conflate public-node latency with QuickNode perf.
 *
 * The example defaults to testnet. Set `SUI_NETWORK=mainnet` alongside a
 * mainnet `QUICKNODE_SUI_URL` to point the client at mainnet.
 *
 * Turnkey handles signing only. Broadcast, balance reads, and transaction
 * history all flow through this client over gRPC (QuickNode has announced
 * deprecation of the Sui JSON-RPC API for July 2026).
 */
export function getSuiClient(): SuiGrpcClient {
  const network =
    (process.env.SUI_NETWORK as "testnet" | "mainnet") || "testnet";
  const quickNodeUrl = process.env.QUICKNODE_SUI_URL;
  const baseUrl =
    quickNodeUrl ||
    PUBLIC_SUI_GRPC_URLS[network] ||
    PUBLIC_SUI_GRPC_URLS.testnet;

  if (!quickNodeUrl && !publicFallbackWarned) {
    publicFallbackWarned = true;
    console.warn(
      "[with-sui-quicknode] QUICKNODE_SUI_URL not set — using public Sui fullnode. Performance is NOT representative of QuickNode. Set QUICKNODE_SUI_URL to benchmark QuickNode.",
    );
  }

  return new SuiGrpcClient({ network, baseUrl });
}

/**
 * Fully-qualified normalized coin type for native SUI, as returned by gRPC
 * (`normalizeStructTag("0x2::sui::SUI")` pads the package address to 32
 * bytes). Use this everywhere we compare coin types.
 */
export const NORMALIZED_SUI_COIN_TYPE = normalizeStructTag("0x2::sui::SUI");

/**
 * Known-coin fallback metadata (symbol + decimals) for common Sui coins.
 * Used when `getCoinMetadata` is unavailable or returns null. Keys are
 * normalized (fully-qualified) struct tags. Add entries here as needed.
 */
const KNOWN_COIN_META: Record<string, { symbol: string; decimals: number }> = {
  [normalizeStructTag("0x2::sui::SUI")]: { symbol: "SUI", decimals: 9 },
  // Native USDC on Sui mainnet
  [normalizeStructTag(
    "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC",
  )]: { symbol: "USDC", decimals: 6 },
  // Bridged/native USDT on Sui mainnet (Wormhole)
  [normalizeStructTag(
    "0xc060006111016b8a020ad5b33834984a437aaa7d3c74c18e09a95d48aceab08c::coin::COIN",
  )]: { symbol: "USDT", decimals: 6 },
};

/**
 * Format a raw amount (base units) as a decimal string using `decimals`.
 * Preserves sign for signed input (used for balance deltas in history).
 */
export function formatUnits(amount: bigint, decimals: number): string {
  if (decimals <= 0) return amount.toString();
  const negative = amount < 0n;
  const abs = negative ? -amount : amount;
  const divisor = 10n ** BigInt(decimals);
  const whole = abs / divisor;
  const fraction = abs % divisor;
  const fractionStr = fraction
    .toString()
    .padStart(decimals, "0")
    .replace(/0+$/, "");
  const body = fractionStr.length > 0 ? `${whole}.${fractionStr}` : `${whole}`;
  return negative ? `-${body}` : body;
}

/**
 * Cached lookup for `{ symbol, decimals }` per normalized coinType.
 * Falls back to a static table for common coins, then to raw base units
 * (decimals = 0) with a truncated coinType symbol so output is never
 * misleadingly labeled.
 *
 * Cache is keyed by normalized coin type so callers can pass either the
 * short `0x2::sui::SUI` form or the fully-qualified form.
 */
export function createCoinMetaResolver(
  provider: SuiGrpcClient,
): (coinType: string) => Promise<{ symbol: string; decimals: number }> {
  const cache = new Map<string, { symbol: string; decimals: number }>();
  return async (rawCoinType: string) => {
    const coinType = normalizeStructTag(rawCoinType);
    const cached = cache.get(coinType);
    if (cached) return cached;

    const known = KNOWN_COIN_META[coinType];
    if (known) {
      cache.set(coinType, known);
      return known;
    }

    try {
      const { coinMetadata } = await provider.getCoinMetadata({ coinType });
      if (coinMetadata) {
        const resolved = {
          symbol: coinMetadata.symbol || shortCoinType(coinType),
          decimals: coinMetadata.decimals,
        };
        cache.set(coinType, resolved);
        return resolved;
      }
    } catch {
      // Metadata lookup can fail on fullnodes that don't index the coin
      // registry entry — fall through to a raw-units fallback below.
    }

    const fallback = { symbol: shortCoinType(coinType), decimals: 0 };
    cache.set(coinType, fallback);
    return fallback;
  };
}

/**
 * Shorten a fully-qualified coin type for display (`0x…abcd::mod::Sym`).
 */
export function shortCoinType(coinType: string): string {
  const parts = coinType.split("::");
  if (parts.length !== 3) return coinType;
  const address = parts[0] as string;
  const mod = parts[1] as string;
  const sym = parts[2] as string;
  const shortAddr =
    address.length > 12
      ? `${address.slice(0, 6)}…${address.slice(-4)}`
      : address;
  return `${shortAddr}::${mod}::${sym}`;
}

/**
 * Resolve the target Sui address from an explicit CLI arg, `SUI_ADDRESS`
 * env var, or throw with a clear error message.
 */
export function resolveAddress(cliArg?: string): string {
  const address = cliArg || process.env.SUI_ADDRESS;
  if (!address) {
    throw new Error(
      "No address provided. Pass one as a CLI argument or set SUI_ADDRESS in .env.local",
    );
  }
  return address;
}

/**
 * Load the Turnkey signer's Ed25519 public key from env and verify it maps
 * to `SUI_ADDRESS`. Only needed for signing flows (send).
 */
export function loadSignerPublicKey(): {
  address: string;
  publicKey: Ed25519PublicKey;
} {
  const { SUI_ADDRESS, SUI_PUBLIC_KEY } = process.env;

  if (!SUI_ADDRESS || !SUI_PUBLIC_KEY) {
    throw new Error("SUI_ADDRESS or SUI_PUBLIC_KEY not set in .env.local");
  }

  const publicKey = new Ed25519PublicKey(Buffer.from(SUI_PUBLIC_KEY, "hex"));
  if (publicKey.toSuiAddress() !== SUI_ADDRESS) {
    throw new Error("SUI_PUBLIC_KEY does not match SUI_ADDRESS");
  }

  return { address: SUI_ADDRESS, publicKey };
}

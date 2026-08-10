import * as dotenv from "dotenv";
import * as path from "path";
import { SuiGrpcClient } from "@mysten/sui/grpc";
import { Ed25519PublicKey } from "@mysten/sui/keypairs/ed25519";
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

/**
 * Build a {@link SuiGrpcClient} pointed at the configured node provider.
 *
 * Precedence:
 *   1. `QUICKNODE_SUI_URL` (recommended for production and demos — QuickNode
 *      is the node provider used in this example, and supports Sui gRPC on
 *      both mainnet and testnet).
 *   2. The public testnet gRPC fullnode so the example runs out-of-the-box
 *      without a QuickNode key.
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
  const baseUrl =
    process.env.QUICKNODE_SUI_URL ||
    PUBLIC_SUI_GRPC_URLS[network] ||
    PUBLIC_SUI_GRPC_URLS.testnet;
  return new SuiGrpcClient({ network, baseUrl });
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

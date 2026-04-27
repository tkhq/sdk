/**
 * Shared initialization for Spark examples.
 *
 * Creates a Turnkey client, TurnkeySparkSigner, and optionally
 * initializes a SparkWallet or IssuerSparkWallet.
 */

import * as path from "path";
import * as dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { SparkWallet } from "@buildonspark/spark-sdk";
import { IssuerSparkWallet } from "@buildonspark/issuer-sdk";
import { Turnkey as TurnkeyServerSDK } from "@turnkey/sdk-server";
import { TurnkeySparkSigner } from "./turnkeySigner";
import { turnkeyClaim } from "./turnkeyClaim";
import { installTurnkeySwapService } from "./turnkeySwap";

type SparkNetwork = "MAINNET" | "REGTEST";

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env var: ${name}`);
  return val;
}

function env(name: string, fallback: string): string {
  return process.env[name] || fallback;
}

export interface TurnkeySparkConfig {
  apiBaseUrl: string;
  apiPrivateKey: string;
  apiPublicKey: string;
  organizationId: string;
  sparkAddress: string;
  ecdsaAddress: string;
  identityPublicKeyHex: string;
  network: SparkNetwork;
}

function requirePrefixedEnv(prefix: string, name: string): string {
  return requireEnv(`${prefix}${name}`);
}

export function loadTurnkeySparkConfig(prefix = ""): TurnkeySparkConfig {
  const network = env("SPARK_NETWORK", "REGTEST") as SparkNetwork;

  return {
    apiBaseUrl: env("BASE_URL", "https://api.turnkey.com"),
    apiPrivateKey: requireEnv("API_PRIVATE_KEY"),
    apiPublicKey: requireEnv("API_PUBLIC_KEY"),
    organizationId: requireEnv("ORGANIZATION_ID"),
    sparkAddress: requirePrefixedEnv(prefix, "TURNKEY_SPARK_ADDRESS"),
    ecdsaAddress: requirePrefixedEnv(prefix, "TURNKEY_ECDSA_ADDRESS"),
    identityPublicKeyHex: requirePrefixedEnv(prefix, "IDENTITY_PUBLIC_KEY_HEX"),
    network,
  };
}

/**
 * Patch SparkWallet.prototype.claimTransfer to route through turnkeyClaim.
 *
 * The SDK's native claim path calls signer.decryptEcies() which requires
 * the identity private key client-side. Turnkey keeps that key inside the
 * enclave, so we intercept all claim attempts (including the SDK's
 * background auto-claim that fires during initialize()) and handle them
 * via the enclave-based flow.
 *
 * Must be called BEFORE SparkWallet.initialize() to avoid the race with
 * setupBackgroundStream's immediate claimTransfers() call.
 */
function patchClaimTransfer(signer: TurnkeySparkSigner): () => void {
  const proto = SparkWallet.prototype as any;
  const original = proto.claimTransfer;

  proto.claimTransfer = async function (
    this: any,
    { transfer, emit }: { transfer: any; emit?: boolean },
  ) {
    const result = await this.claimTransferMutex.runExclusive(() =>
      turnkeyClaim(this, signer, transfer),
    );
    return this.processClaimedTransferResults(result, transfer, emit);
  };

  return () => {
    proto.claimTransfer = original;
  };
}

export function initSignerFromConfig(config: TurnkeySparkConfig): {
  signer: TurnkeySparkSigner;
  network: SparkNetwork;
} {
  const turnkeyClient = new TurnkeyServerSDK({
    apiBaseUrl: config.apiBaseUrl,
    apiPrivateKey: config.apiPrivateKey,
    apiPublicKey: config.apiPublicKey,
    defaultOrganizationId: config.organizationId,
  });

  const signer = new TurnkeySparkSigner(
    turnkeyClient,
    config.sparkAddress,
    config.ecdsaAddress,
    config.identityPublicKeyHex,
  );

  return { signer, network: config.network };
}

export function initSigner(): {
  signer: TurnkeySparkSigner;
  network: SparkNetwork;
} {
  return initSignerFromConfig(loadTurnkeySparkConfig());
}

export async function initSparkWalletFromConfig(config: TurnkeySparkConfig): Promise<{
  wallet: SparkWallet;
  signer: TurnkeySparkSigner;
  network: SparkNetwork;
}> {
  const { signer, network } = initSignerFromConfig(config);

  const restoreClaimTransfer = patchClaimTransfer(signer);
  let wallet: SparkWallet;
  try {
    ({ wallet } = await SparkWallet.initialize({
      signer: signer as any,
      options: {
        network,
        signerWithPreExistingKeys: true,
      },
    }));
  } finally {
    restoreClaimTransfer();
  }

  // Instance-level override survives the prototype restore so the
  // background stream and any explicit calls still route through turnkeyClaim.
  const w = wallet as any;
  w.claimTransfer = async function ({ transfer, emit }: { transfer: any; emit?: boolean }) {
    const result = await w.claimTransferMutex.runExclusive(() =>
      turnkeyClaim(wallet, signer, transfer),
    );
    return w.processClaimedTransferResults(result, transfer, emit);
  };
  installTurnkeySwapService(wallet, signer);

  return { wallet, signer, network };
}

export async function initSparkWalletFromEnv(prefix = ""): Promise<{
  wallet: SparkWallet;
  signer: TurnkeySparkSigner;
  network: SparkNetwork;
}> {
  return initSparkWalletFromConfig(loadTurnkeySparkConfig(prefix));
}

export async function initSparkWallet(): Promise<{
  wallet: SparkWallet;
  signer: TurnkeySparkSigner;
  network: SparkNetwork;
}> {
  return initSparkWalletFromEnv();
}

export async function initIssuerWallet(): Promise<{
  wallet: IssuerSparkWallet;
  signer: TurnkeySparkSigner;
  network: SparkNetwork;
}> {
  const { signer, network } = initSigner();

  const { wallet } = await IssuerSparkWallet.initialize({
    signer: signer as any,
    options: {
      network,
      signerWithPreExistingKeys: true,
      tokenSignatures: "ECDSA",
    },
  });

  return { wallet, signer, network };
}

export { requireEnv, env };
export type { SparkNetwork };

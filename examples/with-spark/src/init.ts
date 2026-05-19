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
import { turnkeyClaim } from "./internal/turnkeyClaim";
import { installTurnkeySwapService } from "./internal/turnkeySwap";

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
  walletId?: string | undefined;
  depositPublicKeyHex?: string | undefined;
  network: SparkNetwork;
}

export function loadTurnkeySparkConfig(prefix = ""): TurnkeySparkConfig {
  return {
    apiBaseUrl: env("BASE_URL", "https://api.turnkey.com"),
    apiPrivateKey: requireEnv("API_PRIVATE_KEY"),
    apiPublicKey: requireEnv("API_PUBLIC_KEY"),
    organizationId: requireEnv("ORGANIZATION_ID"),
    sparkAddress: requireEnv(`${prefix}TURNKEY_SPARK_ADDRESS`),
    ecdsaAddress: requireEnv(`${prefix}TURNKEY_ECDSA_ADDRESS`),
    identityPublicKeyHex: requireEnv(`${prefix}IDENTITY_PUBLIC_KEY_HEX`),
    walletId: process.env[`${prefix}TURNKEY_WALLET_ID`],
    depositPublicKeyHex: process.env[`${prefix}SPARK_DEPOSIT_PUBLIC_KEY_HEX`],
    network: env("SPARK_NETWORK", "REGTEST") as SparkNetwork,
  };
}

/**
 * Build a claimTransfer override that routes through turnkeyClaim. Used both
 * to patch SparkWallet.prototype (covering the SDK's background auto-claim
 * fired during initialize()) and to override the wallet instance after init.
 *
 * The SDK's native claim path calls signer.decryptEcies() which requires the
 * identity private key client-side; Turnkey keeps that key inside the enclave.
 */
function makeClaimTransferOverride(signer: TurnkeySparkSigner) {
  return async function (
    this: any,
    { transfer, emit }: { transfer: any; emit?: boolean },
  ) {
    const result = await this.claimTransferMutex.runExclusive(() =>
      turnkeyClaim(this, signer, transfer),
    );
    return this.processClaimedTransferResults(result, transfer, emit);
  };
}

/** Patch the prototype before initialize() to win the race against background auto-claim. */
function patchClaimTransfer(signer: TurnkeySparkSigner): () => void {
  const proto = SparkWallet.prototype as any;
  const original = proto.claimTransfer;
  proto.claimTransfer = makeClaimTransferOverride(signer);
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
    {
      walletId: config.walletId,
      depositPublicKeyHex: config.depositPublicKeyHex,
    },
  );

  return { signer, network: config.network };
}

export function initSigner(): {
  signer: TurnkeySparkSigner;
  network: SparkNetwork;
} {
  return initSignerFromConfig(loadTurnkeySparkConfig());
}

export async function initSparkWalletFromConfig(
  config: TurnkeySparkConfig,
): Promise<{
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

  // Instance-level override survives the prototype restore so the background
  // stream and any explicit calls still route through turnkeyClaim.
  (wallet as any).claimTransfer = makeClaimTransferOverride(signer);
  installTurnkeySwapService(wallet, signer);

  // Disable the SDK's claim-time auto-optimize swap. The optimizer splits a
  // freshly-claimed leaf into binary denominations via the swap path, leaving
  // each new leaf in SWAP_PENDING locally. The SO-side state transitions to
  // AVAILABLE only after the swap finalizes, which the in-process LeafManager
  // sees only via a fresh sync — short-lived example runs that try to
  // withdraw/transfer immediately after a claim see available=0 because every
  // local leaf is SWAP_PENDING. Disabling the auto-optimize keeps the claim's
  // leaf AVAILABLE so the next operation proceeds. Users who want
  // optimization can call wallet.optimizeLeaves() explicitly and await it.
  const leafManager = (wallet as any).leafManager;
  if (leafManager) leafManager.onAutoOptimize = async () => undefined;

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

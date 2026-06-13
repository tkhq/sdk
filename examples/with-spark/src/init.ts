/**
 * Shared initialization for Spark examples.
 *
 * Creates a Turnkey client, TurnkeySparkSigner, and optionally
 * initializes a SparkWallet or IssuerSparkWallet.
 */

import * as path from "path";
import * as dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { IssuerSparkWallet } from "@buildonspark/issuer-sdk";
import { Turnkey as TurnkeyServerSDK } from "@turnkey/sdk-server";
import { TurnkeySparkSigner, TurnkeySparkWallet } from "@turnkey/spark";

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

export const initSignerFromConfig = (config: TurnkeySparkConfig) => {
  const client = new TurnkeyServerSDK({
    apiBaseUrl: config.apiBaseUrl,
    apiPrivateKey: config.apiPrivateKey,
    apiPublicKey: config.apiPublicKey,
    defaultOrganizationId: config.organizationId,
  });

  const signer = new TurnkeySparkSigner({
    client,
    walletId: config.walletId,
    sparkAddress: config.sparkAddress,
    ecdsaAddress: config.ecdsaAddress,
    identityPublicKeyHex: config.identityPublicKeyHex,
    depositPublicKeyHex: config.depositPublicKeyHex,
  });

  return { signer, network: config.network };
};

export const initSigner = () => initSignerFromConfig(loadTurnkeySparkConfig());

export async function initSparkWalletFromConfig(
  config: TurnkeySparkConfig,
): Promise<{
  wallet: TurnkeySparkWallet;
  signer: TurnkeySparkSigner;
  network: SparkNetwork;
}> {
  const { signer, network } = initSignerFromConfig(config);

  const { wallet } = await TurnkeySparkWallet.initialize({
    signer: signer as any,
    options: {
      network: config.network,
      signerWithPreExistingKeys: true,
    },
  });

  return { wallet, signer, network };
}

export async function initSparkWalletFromEnv(prefix = ""): Promise<{
  wallet: TurnkeySparkWallet;
  signer: TurnkeySparkSigner;
  network: SparkNetwork;
}> {
  return initSparkWalletFromConfig(loadTurnkeySparkConfig(prefix));
}

export async function initSparkWallet(): Promise<{
  wallet: TurnkeySparkWallet;
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
    signer,
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

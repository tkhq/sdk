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

type SparkNetwork = "MAINNET" | "REGTEST";

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env var: ${name}`);
  return val;
}

function env(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

export function initSigner(): {
  signer: TurnkeySparkSigner;
  network: SparkNetwork;
} {
  const network = env("SPARK_NETWORK", "REGTEST") as SparkNetwork;

  const turnkeyClient = new TurnkeyServerSDK({
    apiBaseUrl: env("BASE_URL", "https://api.turnkey.com"),
    apiPrivateKey: requireEnv("API_PRIVATE_KEY"),
    apiPublicKey: requireEnv("API_PUBLIC_KEY"),
    defaultOrganizationId: requireEnv("ORGANIZATION_ID"),
  });

  const signer = new TurnkeySparkSigner(
    turnkeyClient,
    requireEnv("TURNKEY_SPARK_ADDRESS"),
    requireEnv("TURNKEY_ECDSA_ADDRESS"),
    requireEnv("IDENTITY_PUBLIC_KEY_HEX"),
  );

  return { signer, network };
}

export async function initSparkWallet(): Promise<{
  wallet: SparkWallet;
  signer: TurnkeySparkSigner;
  network: SparkNetwork;
}> {
  const { signer, network } = initSigner();

  const { wallet } = await SparkWallet.initialize({
    signer: signer as any,
    options: { network },
  });

  return { wallet, signer, network };
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

/**
 * Native Spark baseline initialization.
 *
 * This intentionally avoids Turnkey and uses the signer bundled with
 * @buildonspark/spark-sdk so claim behavior can be compared directly.
 */

import * as path from "path";
import * as dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { SparkWallet } from "@buildonspark/spark-sdk";

export type SparkNetwork = "MAINNET" | "REGTEST";

function env(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

function optionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function optionalAccountNumber(): number | undefined {
  const value = optionalEnv("SPARK_ACCOUNT_NUMBER");
  if (!value) return undefined;

  const accountNumber = Number(value);
  if (!Number.isInteger(accountNumber) || accountNumber < 0) {
    throw new Error(`SPARK_ACCOUNT_NUMBER must be a non-negative integer`);
  }

  return accountNumber;
}

export async function initNativeSparkWallet({
  requireMnemonic = true,
}: {
  requireMnemonic?: boolean;
} = {}): Promise<{
  wallet: SparkWallet;
  mnemonic: string | undefined;
  network: SparkNetwork;
}> {
  const network = env("SPARK_NETWORK", "REGTEST") as SparkNetwork;
  const mnemonicOrSeed =
    optionalEnv("NATIVE_SPARK_MNEMONIC") ?? optionalEnv("SPARK_MNEMONIC");

  if (requireMnemonic && !mnemonicOrSeed) {
    throw new Error(
      "Missing NATIVE_SPARK_MNEMONIC. Run `pnpm run native:setup`, fund the printed Spark address, then add the printed mnemonic to .env.local.",
    );
  }

  const initOptions: {
    mnemonicOrSeed?: string;
    accountNumber?: number;
    options: { network: SparkNetwork };
  } = { options: { network } };

  if (mnemonicOrSeed) {
    initOptions.mnemonicOrSeed = mnemonicOrSeed;
  }

  const accountNumber = optionalAccountNumber();
  if (accountNumber !== undefined) {
    initOptions.accountNumber = accountNumber;
  }

  const { wallet, mnemonic } = await SparkWallet.initialize(initOptions);

  return { wallet, mnemonic, network };
}

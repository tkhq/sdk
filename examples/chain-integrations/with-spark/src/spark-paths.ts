/**
 * Shared BIP32 path conventions for Turnkey-managed Spark wallets.
 *
 * Keep the constants here to avoid drift between setup tooling and scripts.
 * These values are only needed at wallet-creation time (setup.ts).
 * Runtime code can discover existing accounts from the wallet instead of
 * hard-coding paths.
 */

import type { v1AddressFormat } from "@turnkey/sdk-server";

export type SparkNetwork = "MAINNET" | "REGTEST";

export const SPARK_PURPOSE = "8797555";
export const SPARK_ACCOUNT = "0";
export const SPARK_IDENTITY_CHILD = "0";
export const SPARK_DEPOSIT_CHILD = "2";

export function sparkIdentityPath(): string {
  return `m/${SPARK_PURPOSE}'/${SPARK_ACCOUNT}'/${SPARK_IDENTITY_CHILD}'`;
}

export function sparkDepositPath(): string {
  return `m/${SPARK_PURPOSE}'/${SPARK_ACCOUNT}'/${SPARK_DEPOSIT_CHILD}'`;
}

export function sparkAddressFormat(network: SparkNetwork): v1AddressFormat {
  switch (network) {
    case "MAINNET":
      return "ADDRESS_FORMAT_SPARK_MAINNET";
    case "REGTEST":
      return "ADDRESS_FORMAT_SPARK_REGTEST";
    default:
      throw new Error(`Unsupported Spark network: ${network}`);
  }
}

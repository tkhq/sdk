/**
 * Shared BIP32 path conventions for Turnkey-managed Spark wallets.
 *
 * Both setup scripts use the same purpose / account / child layout. Keeping
 * the constants here prevents drift between `setup.ts` and `setup-e2e.ts`.
 * The runtime signer (`turnkeySigner.ts`) discovers the IDENTITY path by
 * reading the wallet, so it doesn't import these — the constants are only
 * load-bearing at wallet-creation time.
 */

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

export function sparkAddressFormat(network: SparkNetwork): string {
  return network === "MAINNET"
    ? "ADDRESS_FORMAT_SPARK_MAINNET"
    : "ADDRESS_FORMAT_SPARK_REGTEST";
}

/**
 * Creates a Turnkey wallet with Spark accounts:
 *   1. Spark address (for BIP340 Schnorr signing — invoice helpers, FROST)
 *   2. Compressed address (for ECDSA signing — SO auth, token operations)
 *   3. Compressed DEPOSIT account public key (for Spark L1 deposits)
 *
 * Both accounts derive from the same key at the same BIP32 path. Turnkey's
 * signRawPayload dispatches Schnorr vs ECDSA based on the address format,
 * so having both lets the signer use the right algorithm for each context.
 *
 * Run once before using the example scripts (token-transfer, deposit, etc.).
 * Outputs the env vars you need in .env.local:
 *   - TURNKEY_WALLET_ID        (wallet containing the accounts below)
 *   - TURNKEY_SPARK_ADDRESS     (Spark address — for Schnorr signing)
 *   - TURNKEY_ECDSA_ADDRESS     (compressed address — for ECDSA signing)
 *   - IDENTITY_PUBLIC_KEY_HEX   (compressed 33-byte identity pubkey)
 *   - SPARK_DEPOSIT_PUBLIC_KEY_HEX
 *
 * Required env vars:
 *   BASE_URL, API_PUBLIC_KEY, API_PRIVATE_KEY, ORGANIZATION_ID
 *
 * Optional:
 *   SPARK_NETWORK – REGTEST (default) or MAINNET
 *   WALLET_NAME  – name for the new wallet (default: "Spark Wallet")
 */

import * as path from "path";
import * as dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { Turnkey as TurnkeyServerSDK } from "@turnkey/sdk-server";

type SparkNetwork = "MAINNET" | "REGTEST";

const SPARK_PURPOSE = "8797555";
const SPARK_ACCOUNT = "0";
const SPARK_IDENTITY_CHILD = "0";
const SPARK_DEPOSIT_CHILD = "2";

function sparkIdentityPath(): string {
  return `m/${SPARK_PURPOSE}'/${SPARK_ACCOUNT}'/${SPARK_IDENTITY_CHILD}'`;
}

function sparkDepositPath(): string {
  return `m/${SPARK_PURPOSE}'/${SPARK_ACCOUNT}'/${SPARK_DEPOSIT_CHILD}'`;
}

function sparkAddressFormat(network: SparkNetwork): string {
  return network === "MAINNET"
    ? "ADDRESS_FORMAT_SPARK_MAINNET"
    : "ADDRESS_FORMAT_SPARK_REGTEST";
}

interface CreateWalletResult {
  walletId: string;
  addresses: string[];
}

async function main() {
  const network = (process.env.SPARK_NETWORK ?? "REGTEST") as SparkNetwork;

  const requiredVars = [
    "API_PUBLIC_KEY",
    "API_PRIVATE_KEY",
    "ORGANIZATION_ID",
    "BASE_URL",
  ] as const;

  for (const v of requiredVars) {
    if (!process.env[v]) throw new Error(`Missing required env var: ${v}`);
  }

  const walletName = process.env.WALLET_NAME ?? "Spark Wallet";

  const turnkeyClient = new TurnkeyServerSDK({
    apiBaseUrl: process.env.BASE_URL ?? "https://api.turnkey.com",
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    defaultOrganizationId: process.env.ORGANIZATION_ID!,
  });

  const apiClient = turnkeyClient.apiClient();

  const identityPath = sparkIdentityPath();
  const depositPath = sparkDepositPath();

  console.log(`Creating Spark wallet "${walletName}" on ${network}...`);
  console.log(`  IDENTITY path: ${identityPath}`);
  console.log(`  DEPOSIT path:  ${depositPath}`);
  console.log(`  Spark format:  ${sparkAddressFormat(network)}`);

  const result = await apiClient.command<
    Record<string, unknown>,
    CreateWalletResult
  >(
    "/public/v1/submit/create_wallet",
    {
      parameters: {
        walletName,
        accounts: [
          {
            curve: "CURVE_SECP256K1",
            pathFormat: "PATH_FORMAT_BIP32",
            path: identityPath,
            addressFormat: sparkAddressFormat(network),
          },
          {
            curve: "CURVE_SECP256K1",
            pathFormat: "PATH_FORMAT_BIP32",
            path: identityPath,
            addressFormat: "ADDRESS_FORMAT_COMPRESSED",
          },
          {
            curve: "CURVE_SECP256K1",
            pathFormat: "PATH_FORMAT_BIP32",
            path: depositPath,
            addressFormat: "ADDRESS_FORMAT_COMPRESSED",
          },
        ],
      },
      organizationId: apiClient.config.organizationId,
      timestampMs: String(Date.now()),
      type: "ACTIVITY_TYPE_CREATE_WALLET",
    },
    "createWalletResult",
  );

  const sparkAddress = result.addresses[0];
  const ecdsaAddress = result.addresses[1];
  if (!sparkAddress || !ecdsaAddress) {
    throw new Error("Wallet created but missing address(es)");
  }

  // Retrieve the public key for the IDENTITY account
  const wallets = await apiClient.getWalletAccounts({
    organizationId: apiClient.config.organizationId,
    walletId: result.walletId,
  });

  const identityAccount = wallets.accounts.find(
    (a: { address: string }) => a.address === sparkAddress,
  );
  const depositAccount = wallets.accounts.find(
    (a: { path: string; addressFormat: string }) =>
      a.path === depositPath && a.addressFormat === "ADDRESS_FORMAT_COMPRESSED",
  );
  if (!identityAccount) {
    throw new Error("Could not find IDENTITY account after creation");
  }
  if (!depositAccount) {
    throw new Error("Could not find DEPOSIT account after creation");
  }

  console.log(`\nWallet created successfully!`);
  console.log(`  Wallet ID:           ${result.walletId}`);
  console.log(`  Spark address:       ${sparkAddress}`);
  console.log(`  ECDSA address:       ${ecdsaAddress}`);
  console.log(`  Identity public key: ${identityAccount.publicKey}`);
  console.log(`  Deposit public key:  ${depositAccount.publicKey}`);

  console.log(`\nAdd these to your .env.local:`);
  console.log(`  TURNKEY_WALLET_ID=${result.walletId}`);
  console.log(`  TURNKEY_SPARK_ADDRESS=${sparkAddress}`);
  console.log(`  TURNKEY_ECDSA_ADDRESS=${ecdsaAddress}`);
  console.log(`  IDENTITY_PUBLIC_KEY_HEX=${identityAccount.publicKey}`);
  console.log(`  SPARK_DEPOSIT_PUBLIC_KEY_HEX=${depositAccount.publicKey}`);
}

main().catch((err) => {
  console.error("\nError:", err);
  process.exit(1);
});

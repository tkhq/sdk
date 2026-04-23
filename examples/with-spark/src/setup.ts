/**
 * Creates a Turnkey wallet with the Spark IDENTITY account pre-provisioned.
 *
 * Run once before using index.ts (token operations) or e2e.ts (BTC operations).
 * Outputs the env vars you need in .env.local:
 *   - TURNKEY_IDENTITY_ADDRESS  (for index.ts — token flow)
 *   - TURNKEY_SPARK_ADDRESS     (same address, for e2e.ts — BTC flow)
 *   - IDENTITY_PUBLIC_KEY_HEX   (compressed 33-byte identity pubkey)
 *
 * The Spark handler derives all 5 key types (IDENTITY, SIGNING_HD, DEPOSIT,
 * STATIC_DEPOSIT_HD, HTLC_PREIMAGE_HD) on-the-fly from the wallet seed — only
 * the IDENTITY account needs to exist in the Turnkey DB.
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

function sparkIdentityPath(): string {
  return `m/${SPARK_PURPOSE}'/${SPARK_ACCOUNT}'/${SPARK_IDENTITY_CHILD}'`;
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

  const apiClient = turnkeyClient.apiClient() as unknown as {
    command<B, R>(url: string, body: B, resultKey: string): Promise<R>;
    config: { organizationId?: string };
  };

  console.log(`Creating Spark wallet "${walletName}" on ${network}...`);
  console.log(`  IDENTITY path: ${sparkIdentityPath()}`);
  console.log(`  Address format: ${sparkAddressFormat(network)}`);

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
            path: sparkIdentityPath(),
            addressFormat: sparkAddressFormat(network),
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
  if (!sparkAddress) {
    throw new Error("Wallet created but no address returned");
  }

  // Retrieve the public key for the IDENTITY account
  const wallets = await apiClient.command<
    Record<string, unknown>,
    { accounts: Array<{ address: string; publicKey: string }> }
  >(
    "/public/v1/query/list_wallet_accounts",
    { organizationId: apiClient.config.organizationId, walletId: result.walletId },
    "accounts",
  );

  const identityAccount = wallets.accounts.find(
    (a: { address: string }) => a.address === sparkAddress,
  );
  if (!identityAccount) {
    throw new Error("Could not find IDENTITY account after creation");
  }

  console.log(`\nWallet created successfully!`);
  console.log(`  Wallet ID: ${result.walletId}`);
  console.log(`  Spark address: ${sparkAddress}`);
  console.log(`  Identity public key: ${identityAccount.publicKey}`);

  console.log(`\nAdd these to your .env.local:`);
  console.log(`  TURNKEY_SPARK_ADDRESS=${sparkAddress}`);
  console.log(`  IDENTITY_PUBLIC_KEY_HEX=${identityAccount.publicKey}`);
}

main().catch((err) => {
  console.error("\nError:", err);
  process.exit(1);
});

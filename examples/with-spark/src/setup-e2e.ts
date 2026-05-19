/**
 * Creates the Turnkey wallets and accounts used by the hosted regtest E2E.
 *
 * The flow needs two Spark identities and two Bitcoin regtest Taproot accounts:
 *   - sender Spark wallet: receives the L1 deposit and sends the Spark transfer
 *   - sender BTC account: receives Lightspark faucet funds and funds the deposit
 *   - receiver Spark wallet: receives and claims the Spark transfer
 *   - receiver BTC account: receives the final cooperative-exit withdrawal
 *
 * Required env vars:
 *   BASE_URL, API_PUBLIC_KEY, API_PRIVATE_KEY, ORGANIZATION_ID
 *
 * Optional:
 *   SPARK_NETWORK – REGTEST (default) or MAINNET
 *   E2E_WALLET_NAME_SUFFIX – default current timestamp
 *   E2E_SENDER_WALLET_NAME – default "Spark E2E Sender <suffix>"
 *   E2E_RECEIVER_WALLET_NAME – default "Spark E2E Receiver <suffix>"
 *   SENDER_TURNKEY_L1_BTC_PATH – default m/86'/1'/0'/0/0
 *   RECEIVER_TURNKEY_L1_BTC_PATH – default m/86'/1'/0'/0/0
 */

import * as path from "path";
import * as dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { Turnkey as TurnkeyServerSDK } from "@turnkey/sdk-server";

import {
  SparkNetwork,
  sparkAddressFormat,
  sparkDepositPath,
  sparkIdentityPath,
} from "./spark-paths";

const L1_BTC_PATH = "m/86'/1'/0'/0/0";
const L1_BTC_ADDRESS_FORMAT = "ADDRESS_FORMAT_BITCOIN_REGTEST_P2TR";

type ApiClient = ReturnType<TurnkeyServerSDK["apiClient"]>;

type WalletAccount = {
  walletId: string;
  address: string;
  addressFormat: string;
  path: string;
  publicKey?: string;
};

interface CreateWalletResult {
  walletId: string;
  addresses: string[];
}

interface SparkWalletSetup {
  walletId: string;
  sparkAddress: string;
  ecdsaAddress: string;
  identityPublicKeyHex: string;
  depositPublicKeyHex: string;
}

interface L1AccountSetup {
  address: string;
  publicKeyHex: string;
  path: string;
}

interface RoleSetup extends SparkWalletSetup {
  l1: L1AccountSetup;
}

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env var: ${name}`);
  return val;
}

function env(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

function defaultWalletName(
  role: "Sender" | "Receiver",
  suffix: string,
): string {
  return `Spark E2E ${role} ${suffix}`;
}

async function createSparkWallet(
  apiClient: ApiClient,
  walletName: string,
  network: SparkNetwork,
): Promise<SparkWalletSetup> {
  const identityPath = sparkIdentityPath();
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
            path: sparkDepositPath(),
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
    throw new Error("Wallet created but missing Spark address(es)");
  }

  const { accounts } = await apiClient.getWalletAccounts({
    organizationId: apiClient.config.organizationId,
    walletId: result.walletId,
  });
  const identityAccount = (accounts as WalletAccount[]).find(
    (account) => account.address === sparkAddress,
  );
  const depositAccount = (accounts as WalletAccount[]).find(
    (account) =>
      account.path === sparkDepositPath() &&
      account.addressFormat === "ADDRESS_FORMAT_COMPRESSED",
  );
  if (!identityAccount?.publicKey) {
    throw new Error(
      "Could not load Spark identity public key after wallet creation",
    );
  }
  if (!depositAccount?.publicKey) {
    throw new Error(
      "Could not load Spark deposit public key after wallet creation",
    );
  }

  return {
    walletId: result.walletId,
    sparkAddress,
    ecdsaAddress,
    identityPublicKeyHex: identityAccount.publicKey,
    depositPublicKeyHex: depositAccount.publicKey,
  };
}

async function createOrReuseL1Account(
  apiClient: ApiClient,
  walletId: string,
  l1Path: string,
): Promise<L1AccountSetup> {
  const before = await apiClient.getWalletAccounts({
    organizationId: apiClient.config.organizationId,
    walletId,
  });

  let account = (before.accounts as WalletAccount[]).find(
    (candidate) =>
      candidate.path === l1Path &&
      candidate.addressFormat === L1_BTC_ADDRESS_FORMAT,
  );

  if (!account) {
    const result = await apiClient.createWalletAccounts({
      organizationId: apiClient.config.organizationId,
      walletId,
      accounts: [
        {
          curve: "CURVE_SECP256K1",
          pathFormat: "PATH_FORMAT_BIP32",
          path: l1Path,
          addressFormat: L1_BTC_ADDRESS_FORMAT,
        },
      ],
    });

    const address = result.addresses[0];
    if (!address) {
      throw new Error(
        "Turnkey did not return an address for the L1 funding account",
      );
    }

    const after = await apiClient.getWalletAccounts({
      organizationId: apiClient.config.organizationId,
      walletId,
    });
    account = (after.accounts as WalletAccount[]).find(
      (candidate) => candidate.address === address,
    );
  }

  if (!account?.publicKey) {
    throw new Error("Could not load L1 account public key after creation");
  }

  return {
    address: account.address,
    publicKeyHex: account.publicKey,
    path: account.path,
  };
}

async function setupRole(params: {
  apiClient: ApiClient;
  label: string;
  walletName: string;
  network: SparkNetwork;
  l1Path: string;
}): Promise<RoleSetup> {
  console.log(
    `Creating ${params.label} Spark wallet "${params.walletName}"...`,
  );
  const spark = await createSparkWallet(
    params.apiClient,
    params.walletName,
    params.network,
  );

  console.log(`Creating ${params.label} Bitcoin regtest account...`);
  const l1 = await createOrReuseL1Account(
    params.apiClient,
    spark.walletId,
    params.l1Path,
  );

  return { ...spark, l1 };
}

function printPrefixed(prefix: string, setup: RoleSetup) {
  printEnvLines([
    `${prefix}TURNKEY_WALLET_ID=${setup.walletId}`,
    `${prefix}TURNKEY_SPARK_ADDRESS=${setup.sparkAddress}`,
    `${prefix}TURNKEY_ECDSA_ADDRESS=${setup.ecdsaAddress}`,
    `${prefix}IDENTITY_PUBLIC_KEY_HEX=${setup.identityPublicKeyHex}`,
    `${prefix}SPARK_DEPOSIT_PUBLIC_KEY_HEX=${setup.depositPublicKeyHex}`,
    `${prefix}TURNKEY_L1_BTC_ADDRESS=${setup.l1.address}`,
    `${prefix}TURNKEY_L1_BTC_PUBLIC_KEY_HEX=${setup.l1.publicKeyHex}`,
  ]);
}

function printEnvLines(lines: string[]) {
  console.log(lines.join("\n"));
}

function printEnvBlock(title: string, lines: string[]) {
  console.log(`\n${title}`);
  printEnvLines(lines);
}

async function main() {
  const network = env("SPARK_NETWORK", "REGTEST") as SparkNetwork;
  if (network !== "REGTEST") {
    throw new Error("setup:e2e currently supports SPARK_NETWORK=REGTEST only");
  }

  const turnkeyClient = new TurnkeyServerSDK({
    apiBaseUrl: env("BASE_URL", "https://api.turnkey.com"),
    apiPrivateKey: requireEnv("API_PRIVATE_KEY"),
    apiPublicKey: requireEnv("API_PUBLIC_KEY"),
    defaultOrganizationId: requireEnv("ORGANIZATION_ID"),
  });
  const apiClient = turnkeyClient.apiClient();

  console.log(`Preparing hosted Spark ${network} E2E accounts...`);
  console.log(`  Spark identity path: ${sparkIdentityPath()}`);
  const walletNameSuffix = env(
    "E2E_WALLET_NAME_SUFFIX",
    new Date()
      .toISOString()
      .replace(/[-:.TZ]/g, "")
      .slice(0, 14),
  );

  const sender = await setupRole({
    apiClient,
    label: "sender",
    walletName: env(
      "E2E_SENDER_WALLET_NAME",
      defaultWalletName("Sender", walletNameSuffix),
    ),
    network,
    l1Path: env("SENDER_TURNKEY_L1_BTC_PATH", L1_BTC_PATH),
  });

  const receiver = await setupRole({
    apiClient,
    label: "receiver",
    walletName: env(
      "E2E_RECEIVER_WALLET_NAME",
      defaultWalletName("Receiver", walletNameSuffix),
    ),
    network,
    l1Path: env("RECEIVER_TURNKEY_L1_BTC_PATH", L1_BTC_PATH),
  });

  printEnvBlock("Add these to your .env.local:", ["SPARK_NETWORK=REGTEST"]);
  printPrefixed("SENDER_", sender);
  printPrefixed("RECEIVER_", receiver);
  printEnvLines([
    `WITHDRAW_BTC_ADDRESS=${receiver.l1.address}`,
    "L1_DEPOSIT_FEE_SATS=500",
    "L1_DEPOSIT_AMOUNT_SATS=",
    "L1_DEPOSIT_TXID=",
    "L1_FUNDING_TIMEOUT_MS=60000",
    "L1_FUNDING_POLL_MS=5000",
    "L1_DEPOSIT_CONFIRMATION_TIMEOUT_MS=300000",
    "L1_DEPOSIT_CONFIRMATION_POLL_MS=5000",
    "STATIC_DEPOSIT_INDEX=0",
    "STATIC_DEPOSIT_FEE_SATS=500",
    "STATIC_DEPOSIT_MAX_CLAIM_FEE_SATS=500",
    "STATIC_DEPOSIT_AMOUNT_SATS=",
    "STATIC_DEPOSIT_TXID=",
    "STATIC_DEPOSIT_VOUT=",
    "STATIC_DEPOSIT_FUNDING_TIMEOUT_MS=60000",
    "STATIC_DEPOSIT_FUNDING_POLL_MS=5000",
    "STATIC_DEPOSIT_CONFIRMATION_TIMEOUT_MS=300000",
    "STATIC_DEPOSIT_CONFIRMATION_POLL_MS=5000",
    "TRANSFER_CLAIM_TIMEOUT_MS=120000",
    "TRANSFER_CLAIM_POLL_MS=3000",
    "TRANSFER_AMOUNT_SATS=",
    "WITHDRAW_AMOUNT_SATS=",
  ]);

  printEnvBlock(
    "For the one-wallet scripts, you can also use the sender as the active wallet:",
    [
      `TURNKEY_WALLET_ID=${sender.walletId}`,
      `TURNKEY_SPARK_ADDRESS=${sender.sparkAddress}`,
      `TURNKEY_ECDSA_ADDRESS=${sender.ecdsaAddress}`,
      `IDENTITY_PUBLIC_KEY_HEX=${sender.identityPublicKeyHex}`,
      `SPARK_DEPOSIT_PUBLIC_KEY_HEX=${sender.depositPublicKeyHex}`,
      `TURNKEY_L1_BTC_ADDRESS=${sender.l1.address}`,
      `TURNKEY_L1_BTC_PUBLIC_KEY_HEX=${sender.l1.publicKeyHex}`,
      `RECEIVER_SPARK_ADDRESS=${receiver.sparkAddress}`,
    ],
  );
}

main().catch((err) => {
  console.error("\nError:", err);
  process.exit(1);
});

/**
 * Creates or reuses a Turnkey Bitcoin regtest Taproot funding account.
 *
 * Use this address with the Lightspark regtest faucet's Bitcoin receiver mode
 * (bcrt1...). The deposit-turnkey script later spends this UTXO into Spark's
 * single-use L1 deposit address and claims it into the Spark wallet.
 *
 * Required env vars:
 *   API_PUBLIC_KEY, API_PRIVATE_KEY, ORGANIZATION_ID
 *   TURNKEY_SPARK_ADDRESS
 *
 * Optional:
 *   BASE_URL
 *   TURNKEY_WALLET_ID – skips wallet discovery if provided
 *   TURNKEY_L1_BTC_PATH – default m/86'/1'/0'/0/0
 */

import { Turnkey as TurnkeyServerSDK } from "@turnkey/sdk-server";
import { env, requireEnv } from "./init";

const L1_BTC_PATH = "m/86'/1'/0'/0/0";
const L1_BTC_ADDRESS_FORMAT = "ADDRESS_FORMAT_BITCOIN_REGTEST_P2TR";

type WalletAccount = {
  walletId: string;
  address: string;
  addressFormat: string;
  path: string;
  publicKey?: string;
};

async function findWalletIdForAddress(
  apiClient: ReturnType<TurnkeyServerSDK["apiClient"]>,
  address: string,
): Promise<string> {
  const { wallets } = await apiClient.getWallets({
    organizationId: apiClient.config.organizationId,
  });

  for (const wallet of wallets) {
    const { accounts } = await apiClient.getWalletAccounts({
      organizationId: apiClient.config.organizationId,
      walletId: wallet.walletId,
    });

    if ((accounts as WalletAccount[]).some((account) => account.address === address)) {
      return wallet.walletId;
    }
  }

  throw new Error(
    `Could not find a Turnkey wallet containing TURNKEY_SPARK_ADDRESS=${address}. ` +
      "Set TURNKEY_WALLET_ID explicitly if this Spark address was imported or created elsewhere.",
  );
}

async function main() {
  const turnkeyClient = new TurnkeyServerSDK({
    apiBaseUrl: env("BASE_URL", "https://api.turnkey.com"),
    apiPrivateKey: requireEnv("API_PRIVATE_KEY"),
    apiPublicKey: requireEnv("API_PUBLIC_KEY"),
    defaultOrganizationId: requireEnv("ORGANIZATION_ID"),
  });
  const apiClient = turnkeyClient.apiClient();

  const path = env("TURNKEY_L1_BTC_PATH", L1_BTC_PATH);
  const walletId =
    process.env.TURNKEY_WALLET_ID ??
    (await findWalletIdForAddress(apiClient, requireEnv("TURNKEY_SPARK_ADDRESS")));

  const before = await apiClient.getWalletAccounts({
    organizationId: apiClient.config.organizationId,
    walletId,
  });

  let account = (before.accounts as WalletAccount[]).find(
    (candidate) =>
      candidate.path === path &&
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
          path,
          addressFormat: L1_BTC_ADDRESS_FORMAT,
        },
      ],
    });

    const address = result.addresses[0];
    if (!address) {
      throw new Error("Turnkey did not return an address for the L1 funding account");
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
    throw new Error("Could not load L1 funding account public key after creation");
  }

  console.log("Turnkey Bitcoin regtest funding account ready.");
  console.log(`  Wallet ID:  ${walletId}`);
  console.log(`  Path:       ${account.path}`);
  console.log(`  Address:    ${account.address}`);
  console.log(`  Public key: ${account.publicKey}`);

  console.log("\nAdd these to your .env.local:");
  console.log(`  TURNKEY_WALLET_ID=${walletId}`);
  console.log(`  TURNKEY_L1_BTC_ADDRESS=${account.address}`);
  console.log(`  TURNKEY_L1_BTC_PUBLIC_KEY_HEX=${account.publicKey}`);
}

main().catch((err) => {
  console.error("\nError:", err);
  process.exit(1);
});

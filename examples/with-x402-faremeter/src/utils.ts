import {
  type TurnkeyApiClient,
  TurnkeyActivityError,
} from "@turnkey/sdk-server";
import * as crypto from "crypto";

/**
 * Get an existing Solana wallet or create a new one.
 *
 * This function first checks for existing wallets in the organization.
 * If a wallet with a Solana account exists, it returns that address.
 * Otherwise, it creates a new wallet with a Solana account.
 */
export async function getOrCreateSolanaWallet(
  client: TurnkeyApiClient
): Promise<string> {
  // Check for existing wallets with Solana accounts
  const existingAddress = await findExistingSolanaWallet(client);
  if (existingAddress) {
    console.log(`Using existing Solana wallet: ${existingAddress}`);
    return existingAddress;
  }

  // Create a new wallet
  return await createNewSolanaWallet(client);
}

/**
 * Find an existing Solana wallet in the organization.
 *
 * Throws on API errors to avoid silently creating duplicate wallets
 * when the real issue is a transient network/auth failure.
 */
async function findExistingSolanaWallet(
  client: TurnkeyApiClient
): Promise<string | null> {
  const { wallets } = await client.getWallets();

  if (!wallets || wallets.length === 0) {
    return null;
  }

  // Look for a wallet with a Solana account
  for (const wallet of wallets) {
    const { accounts } = await client.getWalletAccounts({
      walletId: wallet.walletId,
    });

    const solanaAccount = accounts?.find(
      (account: { addressFormat: string; address: string }) =>
        account.addressFormat === "ADDRESS_FORMAT_SOLANA"
    );

    if (solanaAccount) {
      return solanaAccount.address;
    }
  }

  return null;
}

/**
 * Create a new Solana wallet in the Turnkey organization.
 *
 * This follows the same pattern as examples/with-solana.
 */
async function createNewSolanaWallet(
  client: TurnkeyApiClient
): Promise<string> {
  console.log("Creating a new Solana wallet...\n");

  const walletName = `Agent Wallet ${crypto.randomBytes(2).toString("hex")}`;

  try {
    const response = await client.createWallet({
      walletName,
      accounts: [
        {
          pathFormat: "PATH_FORMAT_BIP32",
          // Solana BIP44 path: https://github.com/satoshilabs/slips/blob/master/slip-0044.md
          path: "m/44'/501'/0'/0'",
          curve: "CURVE_ED25519",
          addressFormat: "ADDRESS_FORMAT_SOLANA",
        },
      ],
    });

    const walletId = response.walletId;
    if (!walletId) {
      throw new Error("Response doesn't contain a valid wallet ID");
    }

    const address = response.addresses[0];
    if (!address) {
      throw new Error("Response doesn't contain a valid address");
    }

    console.log(
      [
        `New Solana wallet created!`,
        `- Name: ${walletName}`,
        `- Wallet ID: ${walletId}`,
        `- Solana address: ${address}`,
        "",
      ].join("\n")
    );

    return address;
  } catch (error) {
    if (error instanceof TurnkeyActivityError) {
      throw error;
    }

    throw new TurnkeyActivityError({
      message: `Failed to create a new Solana wallet: ${(error as Error).message}`,
      cause: error as Error,
    });
  }
}

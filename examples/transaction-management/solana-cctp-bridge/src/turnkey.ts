import { Turnkey as TurnkeySDKServer } from "@turnkey/sdk-server";
import type { TurnkeyApiClient } from "@turnkey/sdk-server";
import { randomInt } from "crypto";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

export function getTurnkeyClient() {
  return new TurnkeySDKServer({
    apiBaseUrl: process.env.BASE_URL! ?? "https://api.turnkey.com",
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    defaultOrganizationId: process.env.ORGANIZATION_ID!,
  });
}

async function findWalletByName(
  apiClient: TurnkeyApiClient,
  organizationId: string,
  walletName: string,
) {
  const { wallets } = await apiClient.getWallets({ organizationId });
  const matches = wallets.filter(
    (wallet: { walletId: string; walletName: string }) =>
      wallet.walletName === walletName,
  );

  if (matches.length > 1) {
    throw new Error(
      `Found multiple Turnkey wallets named "${walletName}". Rename the duplicates or configure a unique wallet name.`,
    );
  }

  return matches[0];
}

const SOLANA_ACCOUNT = {
  curve: "CURVE_ED25519" as const,
  pathFormat: "PATH_FORMAT_BIP32" as const,
  addressFormat: "ADDRESS_FORMAT_SOLANA" as const,
};

async function getOrCreateWallet(
  apiClient: TurnkeyApiClient,
  organizationId: string,
  walletName: string,
) {
  const existing = await findWalletByName(
    apiClient,
    organizationId,
    walletName,
  );
  if (existing) {
    console.log(`Using Turnkey wallet "${walletName}" (${existing.walletId}).`);
    return existing.walletId;
  }

  try {
    const { walletId } = await apiClient.createWallet({
      organizationId,
      walletName,
      accounts: [],
    });
    console.log(`Created Turnkey wallet "${walletName}" (${walletId}).`);
    return walletId;
  } catch (error) {
    // Another run may have created the stable wallet after our initial lookup.
    const concurrentlyCreated = await findWalletByName(
      apiClient,
      organizationId,
      walletName,
    );
    if (concurrentlyCreated) {
      console.log(
        `Using Turnkey wallet "${walletName}" (${concurrentlyCreated.walletId}).`,
      );
      return concurrentlyCreated.walletId;
    }
    throw error;
  }
}

/**
 * Returns a stable Turnkey Solana address used as CCTP event_rent_payer (and
 * the transaction fee payer). Creates the wallet/account in the org if missing.
 */
export async function getOrCreateRentPayerAccount({
  apiClient,
  organizationId,
  walletName,
}: {
  apiClient: TurnkeyApiClient;
  organizationId: string;
  walletName: string;
}): Promise<string> {
  const walletId = await getOrCreateWallet(
    apiClient,
    organizationId,
    walletName,
  );

  const { accounts } = await apiClient.getWalletAccounts({
    organizationId,
    walletId,
  });
  const existing = accounts.find(
    (account: { addressFormat?: string; address?: string }) =>
      account.addressFormat === "ADDRESS_FORMAT_SOLANA" && account.address,
  );
  if (existing?.address) {
    console.log(
      `Using CCTP rent payer ${existing.address} from wallet "${walletName}".`,
    );
    return existing.address;
  }

  const accountPath = "m/44'/501'/0'/0'";
  const { addresses } = await apiClient.createWalletAccounts({
    organizationId,
    walletId,
    accounts: [{ ...SOLANA_ACCOUNT, path: accountPath }],
  });

  const address = addresses[0];
  if (!address) {
    throw new Error(
      "Turnkey created no Solana address for the CCTP rent payer.",
    );
  }

  console.log(
    `Created CCTP rent payer ${address} at ${accountPath} in wallet "${walletName}".`,
  );
  return address;
}

export async function createMessageSentEventAccount({
  apiClient,
  organizationId,
  walletName,
}: {
  apiClient: TurnkeyApiClient;
  organizationId: string;
  walletName: string;
}): Promise<string> {
  const walletId = await getOrCreateWallet(
    apiClient,
    organizationId,
    walletName,
  );

  // A random, unused BIP-44 account index lets independent script runs safely
  // derive fresh event signers without coordinating a shared counter.
  const accountIndex = randomInt(0, 2 ** 31);
  const accountPath = `m/44'/501'/${accountIndex}'/0'`;
  const { addresses } = await apiClient.createWalletAccounts({
    organizationId,
    walletId,
    accounts: [{ ...SOLANA_ACCOUNT, path: accountPath }],
  });

  const address = addresses[0];
  if (!address) {
    throw new Error(
      "Turnkey created no Solana address for the CCTP event account.",
    );
  }

  console.log(`Created fresh CCTP event signer ${address} at ${accountPath}.`);
  return address;
}

export async function pollTransactionStatus({
  apiClient,
  organizationId,
  sendTransactionStatusId,
  intervalMs = 200,
  timeoutMs = 60_000,
}: {
  apiClient: any;
  organizationId: string;
  sendTransactionStatusId: string;
  intervalMs?: number;
  timeoutMs?: number;
}): Promise<{
  eth?: { txHash?: string };
  solana?: { signature?: string };
  txStatus: string;
}> {
  console.log(`Polling transaction status for ${sendTransactionStatusId}...`);
  return apiClient.pollTransactionStatus({
    organizationId,
    sendTransactionStatusId,
    pollingIntervalMs: intervalMs,
    timeoutMs,
  });
}

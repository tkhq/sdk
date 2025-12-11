import * as crypto from "crypto";
import { ethers } from "ethers";
import { DEFAULT_ETHEREUM_ACCOUNTS } from "@turnkey/sdk-server";
import { getTurnkeyClient } from "./provider";
import { refineNonNull } from "./utils";

export interface TreasuryResult {
  walletId: string;
  address: string;
}

const TREASURY_WALLET_NAME_PREFIX = "Payflow Treasury Wallet";

/**
 * Gets or creates a treasury wallet
 * Priority:
 * 1. If TREASURY_WALLET_ID is set, retrieve that wallet
 * 2. If TREASURY_WALLET_ADDRESS is set, search for wallet by address
 * 3. Search for existing treasury wallets by name pattern
 * 4. Create a new wallet if none found
 */
export async function getOrCreateTreasury(): Promise<TreasuryResult> {
  const turnkeyClient = getTurnkeyClient();
  const organizationId = process.env.ORGANIZATION_ID!;

  // Option 1: Use provided wallet ID (most reliable)
  const treasuryWalletId = process.env.TREASURY_WALLET_ID;
  if (treasuryWalletId) {
    try {
      // Get wallet accounts to retrieve the address
      const accountsResponse = await turnkeyClient.apiClient().getWalletAccounts({
        organizationId,
        walletId: treasuryWalletId,
      });

      const address = accountsResponse.accounts?.[0]?.address;
      
      if (address) {
        console.log(`[INFO] Using existing treasury wallet (ID: ${treasuryWalletId}): ${address}`);
        return {
          walletId: treasuryWalletId,
          address: ethers.getAddress(address),
        };
      }
    } catch (error: any) {
      console.log(`[WARNING] Could not retrieve wallet with ID ${treasuryWalletId}: ${error.message}`);
      console.log(`   Will search for existing treasury wallet or create new one...`);
    }
  }

  // Option 2: Use provided address and search for matching wallet
  const treasuryAddress = process.env.TREASURY_WALLET_ADDRESS;
  if (treasuryAddress && ethers.isAddress(treasuryAddress)) {
    try {
      const walletsResponse = await turnkeyClient.apiClient().getWallets({
        organizationId,
      });

      const wallets = walletsResponse.wallets || [];
      const checksummedAddress = ethers.getAddress(treasuryAddress);

      // Search for wallet with matching address
      for (const wallet of wallets) {
        const walletData = wallet as any;
        if (walletData.addresses && Array.isArray(walletData.addresses)) {
          for (const addr of walletData.addresses) {
            if (ethers.getAddress(addr) === checksummedAddress) {
              console.log(`[INFO] Found existing treasury wallet (ID: ${wallet.walletId}): ${checksummedAddress}`);
              return {
                walletId: wallet.walletId,
                address: checksummedAddress,
              };
            }
          }
        }
      }

      // If address provided but wallet not found, just use the address
      console.log(`[INFO] Using provided treasury address (wallet not found in Turnkey): ${checksummedAddress}`);
      return {
        walletId: "", // Wallet not found in Turnkey
        address: checksummedAddress,
      };
    } catch (error: any) {
      console.log(`[WARNING] Could not search for wallets: ${error.message}`);
      // Fall through to create new wallet
    }
  }

  // Option 3: Search for existing treasury wallets by name pattern
  try {
    const walletsResponse = await turnkeyClient.apiClient().getWallets({
      organizationId,
    });

    const wallets = walletsResponse.wallets || [];
    
    // Look for wallets with treasury name pattern
    const treasuryWallet = wallets.find((wallet) =>
      wallet.walletName?.startsWith(TREASURY_WALLET_NAME_PREFIX)
    );

    if (treasuryWallet) {
      // Get wallet accounts to retrieve the address
      const accountsResponse = await turnkeyClient.apiClient().getWalletAccounts({
        organizationId,
        walletId: treasuryWallet.walletId,
      });

      const address = accountsResponse.accounts?.[0]?.address;
      
      if (address) {
        console.log(`[INFO] Found existing treasury wallet: ${address}`);
        console.log(`   TIP: Add TREASURY_WALLET_ID=${treasuryWallet.walletId} to .env.local for faster lookup`);
        return {
          walletId: treasuryWallet.walletId,
          address: ethers.getAddress(address),
        };
      }
    }
  } catch (error: any) {
      console.log(`[WARNING] Could not search for existing wallets: ${error.message}`);
    // Fall through to create new wallet
  }

  // Option 4: Create a new treasury wallet
  const walletName = `${TREASURY_WALLET_NAME_PREFIX} ${crypto.randomBytes(4).toString("hex")}`;

  const { walletId, addresses } = await turnkeyClient.apiClient().createWallet({
    walletName,
    accounts: DEFAULT_ETHEREUM_ACCOUNTS,
  });

  const address = refineNonNull(addresses[0], "Failed to get treasury address");

  console.log(`[INFO] Created new treasury wallet: ${address}`);
  console.log(`   TIP: Add TREASURY_WALLET_ID=${walletId} to .env.local to reuse this wallet`);

  return {
    walletId,
    address,
  };
}


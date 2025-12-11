import { DEFAULT_ETHEREUM_ACCOUNTS } from "@turnkey/sdk-server";
import { getTurnkeyClientForSubOrg } from "../provider";
import { refineNonNull, formatAddress } from "../utils";
import { printHeader, createSpinner, success, error } from "../cli/display";
import { promptSubOrgId, promptSubOrgIdWithSelection, promptWalletName } from "../cli/menu";
import { listMerchants } from "../utils/merchants";
import chalk from "chalk";

export interface NewWalletResult {
  walletId: string;
  address: string;
}

/**
 * Creates an additional wallet for an existing merchant sub-organization
 */
export async function addMerchantWallet(
  subOrganizationId: string,
  walletName?: string,
): Promise<NewWalletResult> {
  const subOrgClient = getTurnkeyClientForSubOrg(subOrganizationId);

  const finalWalletName = walletName || `Additional Wallet ${Date.now()}`;

  const { walletId, addresses } = await subOrgClient.apiClient().createWallet({
    walletName: finalWalletName,
    accounts: DEFAULT_ETHEREUM_ACCOUNTS,
  });

  const address = refineNonNull(addresses[0], "Failed to get wallet address");

  return {
    walletId,
    address,
  };
}

export async function runAddMerchantWallet(): Promise<void> {
  printHeader("Add Wallet to Merchant");

  // First, show available merchants to help user choose
  const merchants = await listMerchants();

  if (merchants.length === 0) {
    error("No merchants found. Please create a merchant first.");
    return;
  }

  // Try to use selection menu if possible, otherwise fall back to text input
  let subOrgId: string;
  
  if (merchants.length <= 10) {
    // Use selection menu for small lists
    subOrgId = await promptSubOrgIdWithSelection(merchants);
  } else {
    // Use text input for large lists
    console.log(chalk.gray("Available merchants:\n"));
    merchants.forEach((merchant, idx) => {
      console.log(chalk.cyan(`  ${idx + 1}. ${merchant.subOrganizationName}`));
      console.log(chalk.gray(`     Sub-Org ID: ${merchant.subOrganizationId}`));
      console.log(chalk.gray(`     Current Wallets: ${merchant.wallets.length}\n`));
    });
    subOrgId = await promptSubOrgId();
  }
  if (!subOrgId) {
    return;
  }

  // Verify the sub-org exists
  const selectedMerchant = merchants.find((m) => m.subOrganizationId === subOrgId);
  if (!selectedMerchant) {
    error(`Sub-organization ${subOrgId} not found in available merchants.`);
    return;
  }

  const walletName = await promptWalletName();
  if (!walletName) {
    return;
  }

  const spinner = createSpinner(`Creating wallet "${walletName}" in ${selectedMerchant.subOrganizationName}...`);
  spinner.start();

  try {
    const result = await addMerchantWallet(subOrgId, walletName);
    spinner.succeed("Wallet created successfully");

    console.log();
    success(`Wallet added to ${selectedMerchant.subOrganizationName}`);
    success(`   Wallet Name: ${walletName}`);
    success(`   Wallet ID: ${result.walletId}`);
    success(`   Address: ${formatAddress(result.address)}`);
    console.log();
    console.log(chalk.gray(`   TIP: This merchant now has ${selectedMerchant.wallets.length + 1} wallet(s).`));
    console.log();
  } catch (err: any) {
    spinner.fail(`Failed to create wallet: ${err.message}`);
    error(err.message);
  }
}


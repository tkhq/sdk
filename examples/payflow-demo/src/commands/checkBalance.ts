import { USDC_TOKEN_ADDRESSES } from "../utils";
import { printHeader } from "../cli/display";
import { checkAndDisplayBalance } from "../cli/balance";
import { getOrCreateTreasury } from "../treasury";
import { listMerchants } from "../utils/merchants";
import prompts from "prompts";
import chalk from "chalk";

interface WalletOption {
  address: string;
  label: string;
  type: "treasury" | "merchant";
  merchantName?: string;
  walletName?: string;
}

export async function runCheckBalance(): Promise<void> {
  printHeader("Check Wallet Balance");

  const network = process.env.NETWORK || "sepolia";
  const usdcTokenAddress =
    process.env.USDC_TOKEN_ADDRESS || USDC_TOKEN_ADDRESSES[network];

  if (!usdcTokenAddress) {
    console.log(chalk.red(`[ERROR] USDC token address not found for network: ${network}`));
    return;
  }

  console.log(chalk.blue(`Network: ${network}\n`));

  // Build list of available wallets
  const walletOptions: WalletOption[] = [];

  // Add treasury wallet
  try {
    const treasury = await getOrCreateTreasury();
    walletOptions.push({
      address: treasury.address,
      label: `Treasury Wallet (${treasury.address.slice(0, 6)}...${treasury.address.slice(-4)})`,
      type: "treasury",
    });
  } catch (error: any) {
    console.log(chalk.yellow(`[WARNING] Could not load treasury wallet: ${error.message}`));
  }

  // Add all merchant wallets
  try {
    const merchants = await listMerchants();
    merchants.forEach((merchant) => {
      merchant.wallets.forEach((wallet) => {
        if (wallet.address !== "N/A") {
          walletOptions.push({
            address: wallet.address,
            label: `${merchant.subOrganizationName} - ${wallet.walletName} (${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)})`,
            type: "merchant",
            merchantName: merchant.subOrganizationName,
            walletName: wallet.walletName,
          });
        }
      });
    });
  } catch (error: any) {
    console.log(chalk.yellow(`[WARNING] Could not load merchant wallets: ${error.message}`));
  }

  if (walletOptions.length === 0) {
    console.log(chalk.red("[ERROR] No wallets found. Please create a treasury wallet or merchant first."));
    return;
  }

  // Show selection menu
  const { selectedWallet } = await prompts({
    type: "select",
    name: "selectedWallet",
    message: "Select a wallet to check balance:",
    choices: walletOptions.map((option, idx) => ({
      title: option.label,
      value: idx,
    })),
  });

  if (selectedWallet === undefined || selectedWallet < 0 || selectedWallet >= walletOptions.length) {
    return;
  }

  const selectedOption = walletOptions[selectedWallet];
  if (!selectedOption) {
    return;
  }

  const address = selectedOption.address;

  console.log();
  if (selectedOption.type === "treasury") {
    console.log(chalk.cyan(`Checking Treasury Wallet balance...`));
  } else {
    console.log(chalk.cyan(`Checking ${selectedOption.merchantName} - ${selectedOption.walletName} balance...`));
  }
  console.log(chalk.gray(`Address: ${address}\n`));

  await checkAndDisplayBalance(address, network, usdcTokenAddress);
}


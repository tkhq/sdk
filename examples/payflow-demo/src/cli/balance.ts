import { ethers } from "ethers";
import { getProvider } from "../provider";
import { ERC20_ABI, USDC_DECIMALS, toReadableAmount, formatAddress } from "../utils";
import { createSpinner, printSeparator } from "./display";
import chalk from "chalk";

export interface WalletBalances {
  eth: string;
  usdc: string;
  ethRaw: bigint;
  usdcRaw: bigint;
}

/**
 * Checks wallet balance for both ETH and USDC
 */
export async function checkWalletBalance(
  address: string,
  network: string,
  usdcTokenAddress: string,
): Promise<WalletBalances> {
  const provider = getProvider(network);
  const usdcContract = new ethers.Contract(usdcTokenAddress, ERC20_ABI, provider);

  try {
    const balanceOfFn = usdcContract.balanceOf;
    if (!balanceOfFn) {
      throw new Error("USDC contract does not have balanceOf function");
    }
    const [ethBalance, usdcBalance] = await Promise.all([
      provider.getBalance(address),
      balanceOfFn(address).catch(() => 0n),
    ]);

    return {
      eth: ethers.formatEther(ethBalance),
      usdc: toReadableAmount(usdcBalance, USDC_DECIMALS),
      ethRaw: ethBalance,
      usdcRaw: usdcBalance,
    };
  } catch (err: any) {
    throw new Error(`Failed to check balance: ${err.message || "Unknown error"}`);
  }
}

/**
 * Displays wallet balance in a formatted way
 */
export function displayBalance(address: string, balances: WalletBalances): void {
  console.log(chalk.cyan("\nWallet Balances"));
  printSeparator();
  console.log(`Address: ${chalk.white(formatAddress(address))}`);
  console.log(`ETH:  ${chalk.yellow(balances.eth)} ETH`);
  console.log(`USDC: ${chalk.green(balances.usdc)} USDC`);
  printSeparator();
}

/**
 * Checks and displays balance with spinner
 */
export async function checkAndDisplayBalance(
  address: string,
  network: string,
  usdcTokenAddress: string,
): Promise<WalletBalances> {
  const spinner = createSpinner("Checking wallet balance...");
  spinner.start();

  try {
    const balances = await checkWalletBalance(address, network, usdcTokenAddress);
    spinner.succeed("Balance checked successfully");
    displayBalance(address, balances);
    return balances;
  } catch (err: any) {
    spinner.fail(`Failed to check balance: ${err.message}`);
    throw err;
  }
}


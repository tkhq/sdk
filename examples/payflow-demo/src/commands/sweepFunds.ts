import { sweepUSDC } from "../sweepUSDC";
import { getOrCreateTreasury } from "../treasury";
import { USDC_TOKEN_ADDRESSES } from "../utils";
import { createSpinner, success, error, warning, printHeader } from "../cli/display";
import { promptAddress, promptSubOrgId, promptWalletId } from "../cli/menu";
import { checkAndDisplayBalance } from "../cli/balance";
import chalk from "chalk";

export async function runSweepFunds(): Promise<void> {
  printHeader("Sweep Funds to Treasury");

  const network = process.env.NETWORK || "sepolia";
  const usdcTokenAddress =
    process.env.USDC_TOKEN_ADDRESS || USDC_TOKEN_ADDRESSES[network];

  if (!usdcTokenAddress) {
    error(`USDC token address not found for network: ${network}`);
    return;
  }

  console.log(chalk.blue(`Network: ${network}\n`));

  // Get sweep threshold from environment or use default (for display only - enforcement is in policy)
  const sweepThresholdUSDC = parseFloat(process.env.SWEEP_THRESHOLD_USDC || "0.03");
  console.log(chalk.gray(`Sweep Threshold: ${sweepThresholdUSDC} USDC (enforced at Turnkey policy level)\n`));

  // Get or create treasury
  const spinner = createSpinner("Setting up treasury wallet...");
  spinner.start();

  let treasury;
  try {
    treasury = await getOrCreateTreasury();
    spinner.succeed("Treasury wallet ready");
    success(`Treasury Address: ${treasury.address}\n`);
  } catch (err: any) {
    spinner.fail(`Failed to setup treasury: ${err.message}`);
    error(err.message);
    return;
  }

  // Prompt for merchant details
  const merchantAddress = await promptAddress("Merchant Wallet Address");
  if (!merchantAddress) {
    return;
  }

  const merchantSubOrgId = await promptSubOrgId();
  if (!merchantSubOrgId) {
    return;
  }

  const merchantWalletId = await promptWalletId();
  if (!merchantWalletId) {
    return;
  }

  // Check balance before sweeping
  console.log();
  try {
    await checkAndDisplayBalance(merchantAddress, network, usdcTokenAddress);
  } catch (err: any) {
    warning(`Could not check balance: ${err.message}`);
    console.log();
  }

  // Perform sweep
  const sweepSpinner = createSpinner("Sweeping USDC to treasury...");
  sweepSpinner.start();

  try {
    sweepSpinner.stop();

    const sweepResult = await sweepUSDC(
      merchantAddress,
      merchantSubOrgId,
      merchantWalletId,
      treasury.address,
      usdcTokenAddress,
      network,
    );

    if (sweepResult.success) {
      success(`Sweep Success!`);
      success(`Amount: ${sweepResult.amount} USDC`);
      if (sweepResult.transactionHash) {
        const explorerBase =
          network === "sepolia"
            ? "https://sepolia.etherscan.io"
            : network === "goerli"
              ? "https://goerli.etherscan.io"
              : "https://etherscan.io";
        console.log(chalk.blue(`   Transaction: ${explorerBase}/tx/${sweepResult.transactionHash}`));
      }
    } else {
      warning(`Sweep skipped: ${sweepResult.error}`);
      if (sweepResult.error?.includes("policy") || sweepResult.error?.includes("denied")) {
        console.log(chalk.gray(`   The transaction was rejected by Turnkey policy.`));
        console.log(chalk.gray(`   This may be due to:`));
        console.log(chalk.gray(`   - Balance below threshold (${sweepThresholdUSDC} USDC)`));
        console.log(chalk.gray(`   - Transaction not meeting policy conditions`));
      } else {
        console.log(chalk.gray(`   Note: To test the sweep, send some USDC to ${merchantAddress}`));
        console.log(chalk.gray(`   You can get testnet USDC from: https://faucet.circle.com/`));
      }
      console.log(chalk.yellow(`   [IMPORTANT] Gas fees are paid by the merchant wallet. Ensure it has ETH for gas.`));
      console.log(chalk.yellow(`   [IMPORTANT] Threshold enforcement happens at Turnkey policy level, not in application code.`));
    }
    console.log();
  } catch (err: any) {
    sweepSpinner.fail(`Failed to sweep funds: ${err.message}`);
    error(err.message);
  }
}


import { createMerchant } from "../createMerchant";
import { createUSDCOnlyPolicy } from "../createPolicy";
import { sweepUSDC } from "../sweepUSDC";
import { getOrCreateTreasury } from "../treasury";
import { USDC_TOKEN_ADDRESSES, formatAddress } from "../utils";
import { createSpinner, success, error, warning, printHeader, printSeparator } from "../cli/display";
import { confirmStep } from "../cli/menu";
import chalk from "chalk";

export async function runFullDemo(): Promise<void> {
  const network = process.env.NETWORK || "sepolia";
  const usdcTokenAddress =
    process.env.USDC_TOKEN_ADDRESS || USDC_TOKEN_ADDRESSES[network];

  if (!usdcTokenAddress) {
    error(`USDC token address not found for network: ${network}`);
    return;
  }

  printHeader("Payflow Full Demo");
  console.log(chalk.blue(`Network: ${network}`));
  console.log(chalk.blue(`USDC Token: ${formatAddress(usdcTokenAddress)}\n`));

  let treasury: { walletId: string; address: string } | null = null;
  let merchant: { subOrganizationId: string; walletId: string; address: string } | null = null;
  let policyId: string | null = null;

  // Step 1: Setup Treasury
  if (await confirmStep("Setup Treasury Wallet")) {
    const spinner = createSpinner("Setting up treasury wallet...");
    spinner.start();

    try {
      treasury = await getOrCreateTreasury();
      spinner.succeed("Treasury wallet ready");
      success(`Treasury Address: ${treasury.address}`);
      if (treasury.walletId) {
        console.log(chalk.gray(`   Wallet ID: ${treasury.walletId}`));
      }
      console.log();
    } catch (err: any) {
      spinner.fail(`Failed to setup treasury: ${err.message}`);
      error(err.message);
      return;
    }
  } else {
    warning("Skipped: Setup Treasury");
  }

  if (!treasury) {
    error("Treasury is required for the demo. Exiting.");
    return;
  }

  // Step 2: Create Merchant
  if (await confirmStep("Create Merchant Sub-Organization & Wallet")) {
    const spinner = createSpinner("Creating merchant sub-organization and wallet...");
    spinner.start();

    try {
      merchant = await createMerchant("Payflow Merchant Demo");
      spinner.succeed("Merchant created successfully");
      success(`Sub-Organization ID: ${merchant.subOrganizationId}`);
      success(`Wallet ID: ${merchant.walletId}`);
      success(`Merchant Address: ${merchant.address}`);
      console.log();
    } catch (err: any) {
      spinner.fail(`Failed to create merchant: ${err.message}`);
      error(err.message);
      return;
    }
  } else {
    warning("Skipped: Create Merchant");
  }

  if (!merchant) {
    error("Merchant is required for the demo. Exiting.");
    return;
  }

  // Step 3: Create Policy
  if (await confirmStep("Create Restricted Policy")) {
    const spinner = createSpinner("Creating USDC-only policy...");
    spinner.start();

    try {
      const policyName = `USDC-Only Policy for ${formatAddress(merchant.address)}`;
      const sweepThresholdUSDC = parseFloat(process.env.SWEEP_THRESHOLD_USDC || "0.03");
      policyId = await createUSDCOnlyPolicy(
        merchant.subOrganizationId, // Create policy in merchant's sub-organization
        policyName,
        treasury.address,
        usdcTokenAddress,
        sweepThresholdUSDC,
      );
      spinner.succeed("Policy created successfully");
      success(`Policy Name: ${policyName}`);
      success(`Policy ID: ${policyId}`);
      console.log(chalk.gray(`   Restriction: USDC transfers only → ${formatAddress(treasury.address)}`));
      console.log(chalk.gray(`   Threshold: Minimum ${sweepThresholdUSDC} USDC (enforced at policy level)`));
      console.log();
    } catch (err: any) {
      spinner.fail(`Failed to create policy: ${err.message}`);
      error(err.message);
      return;
    }
  } else {
    warning("Skipped: Create Policy");
  }

  // Step 4: Sweep USDC
  if (await confirmStep("Sweep USDC to Treasury")) {
    const spinner = createSpinner("Sweeping USDC to treasury...");
    spinner.start();

    try {
      // Note: sweepUSDC has its own console.log statements, so we'll stop the spinner
      // and let it handle its own output
      spinner.stop();

      const sweepResult = await sweepUSDC(
        merchant.address,
        merchant.subOrganizationId,
        merchant.walletId,
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
        console.log(chalk.gray(`   Note: To test the sweep, send some USDC to ${merchant.address}`));
        console.log(chalk.gray(`   You can get testnet USDC from: https://faucet.circle.com/`));
      }
      console.log();
    } catch (err: any) {
      spinner.fail(`Failed to sweep funds: ${err.message}`);
      error(err.message);
    }
  } else {
    warning("Skipped: Sweep USDC");
  }

  // Summary
  printHeader("Demo Summary");
  console.log(`Treasury Wallet:     ${treasury.address}`);
  if (merchant) {
    console.log(`Merchant Sub-Org:     ${merchant.subOrganizationId}`);
    console.log(`Merchant Wallet:      ${merchant.address}`);
    console.log(`Merchant Wallet ID:   ${merchant.walletId}`);
  }
  if (policyId) {
    console.log(`Policy ID:            ${policyId}`);
    console.log(`Policy Restriction:   USDC-only → ${formatAddress(treasury.address)}`);
  }
  printSeparator();
  success("Demo completed successfully!");
  console.log();
}


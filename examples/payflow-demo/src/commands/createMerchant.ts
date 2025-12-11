import { createMerchant } from "../createMerchant";
import { createUSDCOnlyPolicy } from "../createPolicy";
import { getOrCreateTreasury } from "../treasury";
import { USDC_TOKEN_ADDRESSES, formatAddress } from "../utils";
import { createSpinner, success, printHeader, warning } from "../cli/display";
import { promptMerchantName } from "../cli/menu";
import chalk from "chalk";

export async function runCreateMerchant(): Promise<void> {
  printHeader("Create New Merchant");

  const merchantName = await promptMerchantName();
  if (!merchantName) {
    return;
  }

  const spinner = createSpinner("Creating merchant sub-organization and wallet...");
  spinner.start();

  try {
    const merchant = await createMerchant(merchantName);
    spinner.succeed("Merchant created successfully");

    console.log();
    success(`Merchant Name: ${merchantName}`);
    success(`Sub-Organization ID: ${merchant.subOrganizationId}`);
    success(`Wallet ID: ${merchant.walletId}`);
    success(`Merchant Address: ${merchant.address}`);
    console.log();

    // Automatically create and apply USDC-only policy for this merchant
    const policySpinner = createSpinner("Creating USDC-only policy for merchant...");
    policySpinner.start();

    try {
      // Get treasury wallet
      const treasury = await getOrCreateTreasury();
      
      // Get network and USDC token address
      const network = process.env.NETWORK || "sepolia";
      const usdcTokenAddress =
        process.env.USDC_TOKEN_ADDRESS || USDC_TOKEN_ADDRESSES[network];

      if (!usdcTokenAddress) {
        policySpinner.fail(`USDC token address not found for network: ${network}`);
        warning("Merchant created but policy was not applied. You can create a policy manually later.");
      } else {
        // Create policy in the merchant's sub-organization
        const policyName = `USDC-Only Policy for ${merchantName}`;
        const sweepThresholdUSDC = parseFloat(process.env.SWEEP_THRESHOLD_USDC || "0.03");
        
        const policyId = await createUSDCOnlyPolicy(
          merchant.subOrganizationId,
          policyName,
          treasury.address,
          usdcTokenAddress,
          sweepThresholdUSDC,
        );

        policySpinner.succeed("Policy created and applied successfully");
        success(`Policy Name: ${policyName}`);
        success(`Policy ID: ${policyId}`);
        console.log(chalk.gray(`   Restriction: USDC transfers only → ${formatAddress(treasury.address)}`));
        console.log(chalk.gray(`   Threshold: Minimum ${sweepThresholdUSDC} USDC (enforced at policy level)`));
        console.log();
      }
    } catch (err: any) {
      policySpinner.fail(`Failed to create policy: ${err.message}`);
      warning("Merchant created but policy was not applied. You can create a policy manually later.");
      console.log();
    }

    console.log(chalk.blue("TIP: Save these details for future operations:"));
    console.log(chalk.gray(`   Sub-Org ID: ${merchant.subOrganizationId}`));
    console.log(chalk.gray(`   Wallet ID: ${merchant.walletId}`));
    console.log(chalk.gray(`   Address: ${merchant.address}`));
    console.log();
  } catch (err: any) {
    spinner.fail(`Failed to create merchant: ${err.message}`);
    throw err;
  }
}


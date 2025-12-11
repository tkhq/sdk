import { listMerchants } from "../utils/merchants";
import { printHeader, createSpinner } from "../cli/display";
import { formatAddress } from "../utils";
import chalk from "chalk";
import Table from "cli-table3";

export async function runListMerchants(): Promise<void> {
  printHeader("List All Merchants & Wallets");

  const spinner = createSpinner("Fetching merchants and wallets...");
  spinner.start();

  try {
    const merchants = await listMerchants();
    spinner.succeed(`Found ${merchants.length} merchant(s)`);

    // Show parent organization ID to verify association
    const parentOrgId = process.env.ORGANIZATION_ID!;
    console.log();
    console.log(chalk.gray(`Parent Organization ID: ${parentOrgId}`));
    console.log(chalk.gray(`All merchants below are sub-organizations of this parent org.\n`));

    if (merchants.length === 0) {
      console.log(chalk.yellow("\n[WARNING] No merchants found. Create one using 'Create New Merchant' option."));
      return;
    }

    console.log();
    console.log(chalk.bold("Account Hierarchy Overview\n"));

    // Create a summary table
    const summaryTable = new Table({
      head: ["#", "Merchant Name", "Sub-Org ID", "Wallets", "Primary Address"],
      style: {
        head: ["cyan", "cyan", "cyan", "cyan", "cyan"],
        border: ["gray"],
      },
      colWidths: [5, 30, 20, 10, 42],
    });

    merchants.forEach((merchant, idx) => {
      // Primary wallet is the first wallet (initial created wallet)
      const primaryWallet = merchant.wallets[0];
      const primaryAddress = primaryWallet && primaryWallet.address !== "N/A" 
        ? formatAddress(primaryWallet.address) 
        : "N/A";
      
      summaryTable.push([
        (idx + 1).toString(),
        merchant.subOrganizationName,
        merchant.subOrganizationId.slice(0, 16) + "...",
        merchant.wallets.length.toString(),
        primaryAddress,
      ]);
    });

    console.log(summaryTable.toString());
    console.log();

    // Show detailed hierarchical view
    console.log(chalk.bold("Detailed Account Structure\n"));

    merchants.forEach((merchant, idx) => {
      console.log(chalk.cyan(`\n${"=".repeat(70)}`));
      console.log(chalk.bold.cyan(`Merchant #${idx + 1}: ${merchant.subOrganizationName}`));
      console.log(chalk.gray(`   Sub-Organization ID: ${merchant.subOrganizationId}`));
      console.log(chalk.gray(`   Total Wallets: ${merchant.wallets.length}`));
      console.log(chalk.gray(`   Total Policies: ${merchant.policies.length}`));
      
      if (merchant.wallets.length === 0) {
        console.log(chalk.yellow(`   [WARNING] No wallets found in this merchant sub-org`));
      } else {
        console.log(chalk.blue(`\n   Wallets (${merchant.wallets.length} total):`));
        merchant.wallets.forEach((wallet, walletIdx) => {
          const isPrimary = walletIdx === 0;
          const addressDisplay = wallet.address !== "N/A" 
            ? formatAddress(wallet.address) 
            : "N/A";
          
          console.log(chalk.white(`      ${walletIdx + 1}. ${wallet.walletName}${isPrimary ? " (Primary)" : ""}`));
          console.log(chalk.gray(`         Wallet ID: ${wallet.walletId}`));
          console.log(chalk.gray(`         Address:   ${addressDisplay}`));
          if (wallet.address !== "N/A") {
            console.log(chalk.gray(`         Full Address: ${wallet.address}`));
          }
        });
      }

      // Display policies
      if (merchant.policies.length === 0) {
        console.log(chalk.yellow(`\n   [WARNING] No policies found for this merchant`));
        console.log(chalk.gray(`   Policies restrict what transactions merchant wallets can perform`));
      } else {
        console.log(chalk.blue(`\n   Policies (${merchant.policies.length} total):`));
        merchant.policies.forEach((policy, policyIdx) => {
          console.log(chalk.white(`      ${policyIdx + 1}. ${policy.policyName}`));
          console.log(chalk.gray(`         Policy ID: ${policy.policyId}`));
          console.log(chalk.gray(`         Effect: ${policy.effect}`));
          if (policy.condition) {
            // Truncate long conditions for display
            const conditionDisplay = policy.condition.length > 80 
              ? policy.condition.slice(0, 77) + "..." 
              : policy.condition;
            console.log(chalk.gray(`         Condition: ${conditionDisplay}`));
          }
          if (policy.consensus) {
            console.log(chalk.gray(`         Consensus: ${policy.consensus}`));
          }
          if (policy.notes) {
            const notesDisplay = policy.notes.length > 100 
              ? policy.notes.slice(0, 97) + "..." 
              : policy.notes;
            console.log(chalk.gray(`         Notes: ${notesDisplay}`));
          }
        });
      }
    });

    console.log(chalk.cyan(`\n${"=".repeat(70)}\n`));

    // Summary statistics
    const totalWallets = merchants.reduce((sum, m) => sum + m.wallets.length, 0);
    const totalPolicies = merchants.reduce((sum, m) => sum + m.policies.length, 0);
    const merchantsWithPolicies = merchants.filter(m => m.policies.length > 0).length;
    
    console.log(chalk.bold("Summary:"));
    console.log(chalk.gray(`   - Total Merchants: ${merchants.length}`));
    console.log(chalk.gray(`   - Total Wallets: ${totalWallets}`));
    console.log(chalk.gray(`   - Total Policies: ${totalPolicies}`));
    console.log(chalk.gray(`   - Merchants with Policies: ${merchantsWithPolicies}/${merchants.length}`));
    console.log(chalk.gray(`   - Average Wallets per Merchant: ${(totalWallets / merchants.length).toFixed(1)}`));
    console.log();
  } catch (err: any) {
    spinner.fail(`Failed to list merchants: ${err.message}`);
    throw err;
  }
}


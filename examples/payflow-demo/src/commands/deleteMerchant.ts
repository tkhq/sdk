import { getTurnkeyClient } from "../provider";
import { printHeader, createSpinner, success, error, warning } from "../cli/display";
import { promptSubOrgId, promptSubOrgIdWithSelection, confirmStep } from "../cli/menu";
import { listMerchants } from "../utils/merchants";
import chalk from "chalk";

/**
 * Deletes a merchant sub-organization
 * WARNING: This will delete the sub-org and all its wallets
 */
export async function deleteMerchant(
  subOrganizationId: string,
  deleteWithoutExport: boolean = false,
): Promise<void> {
  const turnkeyClient = getTurnkeyClient();

  // Delete the sub-organization
  await turnkeyClient.apiClient().deleteSubOrganization({
    organizationId: subOrganizationId, // The sub-org to delete
    deleteWithoutExport,
  });
}

export async function runDeleteMerchant(): Promise<void> {
  printHeader("Delete Merchant");

  // First, show available merchants to help user choose
  const merchants = await listMerchants();

  if (merchants.length === 0) {
    error("No merchants found. Nothing to delete.");
    return;
  }

  // Show parent org info
  const parentOrgId = process.env.ORGANIZATION_ID!;
  console.log(chalk.gray(`Parent Organization ID: ${parentOrgId}\n`));

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
      console.log(chalk.gray(`     Wallets: ${merchant.wallets.length}\n`));
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

  // Show warning about what will be deleted
  console.log();
  warning(`WARNING: This will permanently delete:`);
  console.log(chalk.red(`  - Merchant: ${selectedMerchant.subOrganizationName}`));
  console.log(chalk.red(`  - Sub-Organization ID: ${subOrgId}`));
  console.log(chalk.red(`  - All ${selectedMerchant.wallets.length} wallet(s) in this merchant`));
  console.log(chalk.red(`  - All funds in those wallets (if not exported first)`));
  console.log();

  const confirmed = await confirmStep("Delete this merchant");
  if (!confirmed) {
    console.log(chalk.gray("Deletion cancelled."));
    return;
  }

  // Ask about export requirement
  const { deleteWithoutExport } = await import("prompts").then((p) =>
    p.default({
      type: "confirm",
      name: "deleteWithoutExport",
      message: "Delete without exporting wallets? (WARNING: This may result in loss of access to wallets)",
      initial: false,
    })
  );

  const spinner = createSpinner(`Deleting merchant "${selectedMerchant.subOrganizationName}"...`);
  spinner.start();

  try {
    await deleteMerchant(subOrgId, deleteWithoutExport || false);
    spinner.succeed("Merchant deleted successfully");

    console.log();
    success(`Deleted merchant: ${selectedMerchant.subOrganizationName}`);
    success(`Sub-Organization ID: ${subOrgId}`);
    console.log();
  } catch (err: any) {
    spinner.fail(`Failed to delete merchant: ${err.message}`);
    error(err.message);
    
    if (err.message.includes("export")) {
      console.log();
      console.log(chalk.yellow("TIP: You may need to export wallets first before deleting."));
      console.log(chalk.yellow("     Set 'deleteWithoutExport' to true to force deletion."));
    }
  }
}


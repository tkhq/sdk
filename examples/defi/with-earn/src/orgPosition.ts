import { header, newClient, PARENT_TAG, printOrgVaults } from "./common";

// Steps 3 and 8: the platform's management view — enabled vaults with fee
// terms, net APY, and total deposited across all users.
async function main() {
  const { client, organizationId } = newClient("PARENT");

  header("Org position (platform view)", PARENT_TAG);
  await printOrgVaults(client, organizationId);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

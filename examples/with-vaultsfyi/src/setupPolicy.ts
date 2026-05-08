import { Turnkey } from "@turnkey/sdk-server";
import { vaultsFyi, resolveNetwork, getAssetAddress } from "./shared";

const [networkArg, vaultId] = process.argv.slice(2);

if (!networkArg || !vaultId) {
  console.error("Usage: pnpm setup-policy <network> <vaultId>");
  process.exit(1);
}

async function main() {
  const { network } = resolveNetwork(networkArg!);

  const turnkeyClient = new Turnkey({
    apiBaseUrl: process.env.TURNKEY_BASE_URL!,
    apiPrivateKey: process.env.TURNKEY_API_PRIVATE_KEY!,
    apiPublicKey: process.env.TURNKEY_API_PUBLIC_KEY!,
    defaultOrganizationId: process.env.TURNKEY_ORGANIZATION_ID!,
  }).apiClient();

  const userId = process.env.NONROOT_USER_ID!;
  const userAddress = process.env.SIGN_WITH!;

  const assetAddress = await getAssetAddress(network, vaultId!);
  console.log(`Asset address: ${assetAddress}`);

  // Discover deposit + redeem target addresses via dry-run
  const [deposit, redeem] = await Promise.all([
    vaultsFyi.getActions({
      path: { action: "deposit", userAddress, network, vaultId: vaultId! },
      query: { assetAddress, amount: "1" },
    }),
    vaultsFyi.getActions({
      path: { action: "redeem", userAddress, network, vaultId: vaultId! },
      query: { assetAddress, amount: "1" },
    }),
  ]);

  const targets = [
    ...new Set(
      [...deposit.actions, ...redeem.actions].map((a) => a.tx.to.toLowerCase()),
    ),
  ];
  const addressList = targets.map((a) => `'${a}'`).join(", ");

  console.log("Discovered target addresses:", targets);

  const { policyId } = await turnkeyClient.createPolicy({
    policyName: `Allow non-root user to interact with vault ${vaultId}`,
    effect: "EFFECT_ALLOW",
    consensus: `approvers.any(user, user.id == '${userId}')`,
    condition: `eth.tx.to in [${addressList}]`,
    notes: "vaults.fyi cookbook: deposit + redeem addresses",
  });

  console.log("Policy created:", policyId);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

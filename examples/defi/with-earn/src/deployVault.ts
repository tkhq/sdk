import type { v1EarnVault } from "@turnkey/sdk-server";

import {
  ask,
  ASSET_CAIP19,
  C,
  CATALOG_AVAILABLE,
  CHAIN_CAIP2,
  EARN_PROVIDER,
  header,
  newClient,
  PARENT_TAG,
  pollEarnStatus,
  printOrgVaults,
  requireEnv,
  sameAddress,
} from "./common";

// Step 2: choose a vault and fee terms, then enable it for the org. On EVM this
// deploys a fee wrapper in front of the vault; on Solana Turnkey creates a
// Kamino kVault allocated to the chosen K-Lend reserve. Either way the result's
// `wrapperAddress` is the deposit target.
// Usage: pnpm deploy-vault [vault-address] [client-fee-bps] [fee-wallet]
// Missing values prompt on a terminal, falling back to env/defaults.
async function main() {
  const [argVault, argFeeBps, argFeeWallet] = process.argv.slice(2);
  const { client, organizationId } = newClient("PARENT");

  header("Enable a vault (deploy fee wrapper)", PARENT_TAG);

  // Kamino's catalog covers mainnet only; on devnet the reserve is pinned in env.
  const vaults: v1EarnVault[] = CATALOG_AVAILABLE
    ? ((
        await client.listEarnVaults({
          organizationId,
          caip19: ASSET_CAIP19,
          provider: EARN_PROVIDER,
        })
      ).vaults ?? [])
    : [];

  const defaultVault =
    process.env.VAULT_ADDRESS ||
    vaults.find((v) => v.enabled)?.vaultAddress ||
    vaults[0]?.vaultAddress;
  if (!defaultVault) {
    throw new Error(
      CATALOG_AVAILABLE
        ? "vault catalog is empty"
        : `no catalog on ${CHAIN_CAIP2}; set VAULT_ADDRESS to the reserve to enable`,
    );
  }

  const vaultAddress = argVault ?? (await ask("Vault to enable", defaultVault));
  const chosen = vaults.find((v) => sameAddress(v.vaultAddress, vaultAddress));

  if (chosen?.enabled) {
    console.log(
      `${C.green}✓${C.reset} Vault is already enabled for this org — nothing to deploy.`,
    );
    return;
  }

  const clientFeeBps =
    argFeeBps ??
    (await ask(
      "Client fee (bps of yield)",
      process.env.CLIENT_FEE_BPS ?? "2000",
    ));
  const clientFeeWallet =
    argFeeWallet ??
    (await ask(
      "Client fee wallet (parent org address)",
      requireEnv("CLIENT_FEE_WALLET"),
    ));

  console.log(`\n🚀 Enabling ${vaultAddress} on ${CHAIN_CAIP2}…`);

  const { wrapperAddress, splitterAddress, deployRequestId } =
    await client.earnDeployWrapper({
      organizationId,
      vaultAddress,
      caip2: CHAIN_CAIP2,
      clientFeeBps,
      clientFeeWallet,
    });

  console.log(`   wrapper:  ${wrapperAddress}`);
  // Kamino vaults have no splitter: fees accrue in the vault and are split at
  // claim time.
  if (splitterAddress) console.log(`   splitter: ${splitterAddress}`);

  // earnDeployWrapper resolves at broadcast-enqueue time; wait for the deploy
  // tx to actually land on-chain.
  await pollEarnStatus("wrapper deploy", async () => {
    const { status, deployTxHash, error } = await client.getEarnDeployStatus({
      organizationId,
      deployRequestId,
    });
    return { status, txHash: deployTxHash, error };
  });

  console.log();
  await printOrgVaults(client, organizationId);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

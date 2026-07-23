import { createActivityPoller } from "@turnkey/http";
import {
  ask,
  ASSET_CAIP19,
  C,
  CHAIN_CAIP2,
  header,
  newClient,
  PARENT_TAG,
  pollEarnStatus,
  printOrgVaults,
  requireEnv,
} from "./common";

// Step 2: choose a vault and fee terms, then deploy the org's fee wrapper.
// Usage: pnpm deploy-vault [vault-address] [client-fee-bps] [fee-wallet]
// Missing values prompt on a terminal, falling back to env/defaults.
async function main() {
  const [argVault, argFeeBps, argFeeWallet] = process.argv.slice(2);
  const { client, organizationId } = newClient("PARENT");

  header("Enable a vault (deploy fee wrapper)", PARENT_TAG);

  const { vaults = [] } = await client.earnVaults({
    organizationId,
    caip19: ASSET_CAIP19,
    provider: "EARN_PROVIDER_MORPHO",
  });

  const defaultVault =
    process.env.VAULT_ADDRESS ||
    vaults.find((v) => v.enabled)?.vaultAddress ||
    vaults[0]?.vaultAddress;
  if (!defaultVault) throw new Error("vault catalog is empty");

  const vaultAddress = argVault ?? (await ask("Vault to enable", defaultVault));
  const chosen = vaults.find(
    (v) => v.vaultAddress?.toLowerCase() === vaultAddress.toLowerCase(),
  );

  if (chosen?.enabled) {
    console.log(`${C.green}✓${C.reset} Vault is already enabled for this org — nothing to deploy.`);
    return;
  }

  const clientFeeBps =
    argFeeBps ??
    (await ask("Client fee (bps of yield)", process.env.CLIENT_FEE_BPS ?? "2000"));
  const clientFeeWallet =
    argFeeWallet ??
    (await ask("Client fee wallet (parent org address)", requireEnv("CLIENT_FEE_WALLET")));

  console.log(`\n🚀 Deploying wrapper for ${vaultAddress} on ${CHAIN_CAIP2}…`);

  const activityPoller = createActivityPoller({
    client,
    requestFn: client.earnDeployWrapper,
  });
  const activity = await activityPoller({
    type: "ACTIVITY_TYPE_EARN_DEPLOY_WRAPPER",
    timestampMs: String(Date.now()),
    organizationId,
    parameters: { vaultAddress, chainCaip2: CHAIN_CAIP2, clientFeeBps, clientFeeWallet },
  });

  const result = activity.result.earnDeployWrapperResult;
  if (!result) {
    throw new Error(`deploy activity ${activity.id} completed without a result`);
  }

  console.log(`   wrapper:  ${result.wrapperAddress}`);
  console.log(`   splitter: ${result.splitterAddress}`);

  // The activity completes at broadcast-enqueue time; wait for the deploy tx
  // to actually land on-chain.
  await pollEarnStatus("wrapper deploy", async () => {
    const { status, deployTxHash, error } = await client.earnDeployStatus({
      organizationId,
      deployRequestId: result.deployRequestId,
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

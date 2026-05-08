/**
 * Redeems the entire position from VAULT_ID by asking vaults.fyi for the
 * redeem transaction(s) with `all=true` and signing each step.
 *
 * For protocols with redemption cooldowns (Sky sUSDS, Ethena sUSDe, similar)
 * the action enum also exposes `request-redeem`, `start-redeem-cooldown`, and
 * `claim-redeem`. Use `getTransactionsContext` to discover the current step
 * the user needs to take for a given vault.
 *
 * Run with: pnpm redeem
 */

import * as path from "path";
import * as dotenv from "dotenv";
import { base } from "viem/chains";
import { createAccount } from "@turnkey/viem";
import { Turnkey as TurnkeyServerSDK } from "@turnkey/sdk-server";
import {
  createWalletClient,
  createPublicClient,
  http,
  type Account,
} from "viem";
import { VaultsSdk } from "@vaultsfyi/sdk";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  const turnkeyClient = new TurnkeyServerSDK({
    apiBaseUrl: process.env.TURNKEY_BASE_URL!,
    apiPrivateKey: process.env.NONROOT_API_PRIVATE_KEY!,
    apiPublicKey: process.env.NONROOT_API_PUBLIC_KEY!,
    defaultOrganizationId: process.env.TURNKEY_ORGANIZATION_ID!,
  });

  const turnkeyAccount = await createAccount({
    client: turnkeyClient.apiClient(),
    organizationId: process.env.TURNKEY_ORGANIZATION_ID!,
    signWith: process.env.SIGN_WITH!,
  });

  const walletClient = createWalletClient({
    account: turnkeyAccount as Account,
    chain: base,
    transport: http(process.env.RPC_URL!),
  });

  const publicClient = createPublicClient({
    chain: base,
    transport: http(process.env.RPC_URL!),
  });

  const vaultsFyi = new VaultsSdk({ apiKey: process.env.VAULTS_FYI_API_KEY! });

  const userAddress = (turnkeyAccount as Account).address;
  const network = "base" as const;
  const vaultId = process.env.VAULT_ID!;
  const assetAddress = process.env.ASSET_ADDRESS!;

  console.log(`Redeeming full position from ${vaultId} on ${network}`);

  const { currentActionIndex, actions } = await vaultsFyi.getActions({
    path: { action: "redeem", userAddress, network, vaultId },
    query: { assetAddress, all: true },
  });

  const remaining = actions.slice(currentActionIndex);
  if (remaining.length === 0) {
    console.log("Nothing to do — vaults.fyi reports no pending redeem steps.");
    return;
  }

  console.log(`Executing ${remaining.length} step(s):`);
  for (const step of remaining) {
    const hash = await walletClient.sendTransaction({
      to: step.tx.to as `0x${string}`,
      data: step.tx.data as `0x${string}` | undefined,
      value: step.tx.value ? BigInt(step.tx.value) : undefined,
    });
    await publicClient.waitForTransactionReceipt({ hash, confirmations: 2 });
    console.log(`  ${step.name}: https://basescan.org/tx/${hash}`);
  }

  console.log("\nRedeem complete.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

/**
 * Deposits DEPOSIT_AMOUNT of ASSET_ADDRESS into VAULT_ID.
 *
 * vaults.fyi returns an ordered list of transactions (typically approve +
 * deposit), each with `tx.to`, `tx.data`, `tx.chainId`, and optional
 * `tx.value`. We sign each one with the Turnkey-managed non-root signer,
 * waiting for confirmations between steps so state changes (e.g. the
 * approval) are visible to the next step.
 *
 * Run with: pnpm deposit
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
  const amount = process.env.DEPOSIT_AMOUNT!;

  console.log(
    `Depositing ${amount} of ${assetAddress} into ${vaultId} on ${network}`,
  );

  const { currentActionIndex, actions } = await vaultsFyi.getActions({
    path: { action: "deposit", userAddress, network, vaultId },
    query: { assetAddress, amount },
  });

  const remaining = actions.slice(currentActionIndex);
  if (remaining.length === 0) {
    console.log("Nothing to do — vaults.fyi reports no pending steps.");
    return;
  }

  console.log(`Executing ${remaining.length} step(s):`);
  for (const step of remaining) {
    const hash = await walletClient.sendTransaction({
      to: step.tx.to as `0x${string}`,
      data: step.tx.data as `0x${string}` | undefined,
      value: step.tx.value ? BigInt(step.tx.value) : undefined,
    });
    // Wait for confirmations so state changes (e.g. an approval) are visible
    // to subsequent transactions.
    await publicClient.waitForTransactionReceipt({ hash, confirmations: 2 });
    console.log(`  ${step.name}: https://basescan.org/tx/${hash}`);
  }

  console.log(
    "\nDeposit complete. Run `pnpm balance` to verify the position.",
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

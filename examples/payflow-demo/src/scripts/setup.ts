import * as fs from "fs";
import * as path from "path";
import { getAdminClient } from "../turnkey";
import { generateP256KeyPair } from "@turnkey/crypto";
import {
  DERIVATION_PATH_BASE,
  MERCHANT_COUNT,
  SEPOLIA_USDC_ADDRESS,
  TRANSFER_SELECTOR,
  GENERATED_FILE,
} from "../config";

function ethAccountParams(pathIndex: number) {
  return {
    curve: "CURVE_SECP256K1" as const,
    pathFormat: "PATH_FORMAT_BIP32" as const,
    path: `${DERIVATION_PATH_BASE}/${pathIndex}`,
    addressFormat: "ADDRESS_FORMAT_ETHEREUM" as const,
  };
}

async function main() {
  const adminClient = getAdminClient();
  const api = adminClient.apiClient();
  console.log("=== Payflow Setup ===\n");

  // ── 1. Create merchant HD wallet with the first account ──
  console.log("1. Creating merchant HD wallet...");
  const merchantWallet = await api.createWallet({
    walletName: "Payflow Merchant Wallet",
    accounts: [ethAccountParams(0)],
  });

  const merchantWalletId = merchantWallet.walletId;
  const merchantAddresses = [...merchantWallet.addresses];
  console.log(`   Wallet ID: ${merchantWalletId}`);
  console.log(`   Account 0: ${merchantAddresses[0]}`);

  // ── 2. Derive remaining merchant accounts ──
  if (MERCHANT_COUNT > 1) {
    console.log(`\n2. Deriving ${MERCHANT_COUNT - 1} more merchant accounts...`);
    const additionalAccounts = [];
    for (let i = 1; i < MERCHANT_COUNT; i++) {
      additionalAccounts.push(ethAccountParams(i));
    }

    const derived = await api.createWalletAccounts({
      walletId: merchantWalletId,
      accounts: additionalAccounts,
    });

    for (const addr of derived.addresses) {
      merchantAddresses.push(addr);
    }

    for (let i = 1; i < MERCHANT_COUNT; i++) {
      console.log(`   Account ${i}: ${merchantAddresses[i]}`);
    }
  }

  // ── 3. Create treasury wallet (separate seed) ──
  console.log("\n3. Creating treasury HD wallet...");
  const treasuryWallet = await api.createWallet({
    walletName: "Payflow Treasury Wallet",
    accounts: [ethAccountParams(0)],
  });

  const treasuryWalletId = treasuryWallet.walletId;
  const treasuryAddress = treasuryWallet.addresses[0]!;
  console.log(`   Wallet ID: ${treasuryWalletId}`);
  console.log(`   Treasury address: ${treasuryAddress}`);

  // ── 4. Create non-root automation user with API key ──
  console.log("\n4. Creating automation user...");
  const automationKeyPair = generateP256KeyPair();

  const { userIds } = await api.createUsers({
    users: [
      {
        userName: "Payflow Automation User",
        userTags: [],
        apiKeys: [
          {
            apiKeyName: "payflow-automation-key",
            publicKey: automationKeyPair.publicKey,
            curveType: "API_KEY_CURVE_P256" as const,
          },
        ],
        authenticators: [],
        oauthProviders: [],
      },
    ],
  });

  const automationUserId = userIds[0]!;
  console.log(`   User ID: ${automationUserId}`);
  console.log(`   API Public Key: ${automationKeyPair.publicKey}`);
  console.log(`   API Private Key: ${automationKeyPair.privateKey}`);

  // ── 5. Create ALLOW policy for USDC sweeps to treasury only ──
  console.log("\n5. Creating sweep policy...");
  const paddedTreasury = treasuryAddress
    .toLowerCase()
    .replace(/^0x/, "")
    .padStart(64, "0");

  const condition = [
    `eth.tx.to == '${SEPOLIA_USDC_ADDRESS}'`,
    `eth.tx.data[0..10] == '${TRANSFER_SELECTOR}'`,
    `eth.tx.data[10..74] == '${paddedTreasury}'`,
  ].join(" && ");

  const consensus = `approvers.any(user, user.id == '${automationUserId}')`;

  const { policyId } = await api.createPolicy({
    policyName: "Payflow: allow USDC sweeps to treasury only",
    effect: "EFFECT_ALLOW",
    condition,
    consensus,
    notes: "",
  });

  console.log(`   Policy ID: ${policyId}`);
  console.log(`   Effect: EFFECT_ALLOW`);
  console.log(`   Condition: ${condition}`);
  console.log(`   Consensus: ${consensus}`);

  // ── 6. Persist generated identifiers ──
  const generated = {
    merchantWalletId,
    merchantAddresses,
    treasuryWalletId,
    treasuryAddress,
    automationUserId,
    automationApiPublicKey: automationKeyPair.publicKey,
    automationApiPrivateKey: automationKeyPair.privateKey,
    policyId,
  };

  const outputPath = path.resolve(process.cwd(), GENERATED_FILE);
  fs.writeFileSync(outputPath, JSON.stringify(generated, null, 2));
  console.log(`\n✓ Generated identifiers saved to ${GENERATED_FILE}`);

  console.log("\n=== Setup Complete ===");
  console.log("\nNext steps:");
  console.log(`  1. Update .env.local with automation credentials:`);
  console.log(`     AUTOMATION_API_PUBLIC_KEY="${automationKeyPair.publicKey}"`);
  console.log(`     AUTOMATION_API_PRIVATE_KEY="${automationKeyPair.privateKey}"`);
  console.log(`  2. Fund a merchant account with Sepolia USDC at https://faucet.circle.com/`);
  console.log(`     Merchant addresses:`);
  for (let i = 0; i < merchantAddresses.length; i++) {
    console.log(`       Merchant ${i}: ${merchantAddresses[i]}`);
  }
  console.log(`  3. Fund the merchant account with a small amount of Sepolia ETH for gas`);
  console.log(`  4. Run: pnpm run-demo`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

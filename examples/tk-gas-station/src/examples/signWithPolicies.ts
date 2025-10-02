import { resolve } from "path";
import * as dotenv from "dotenv";
import { z } from "zod";
import { parseUnits, createWalletClient, http } from "viem";
import { base } from "viem/chains";
import { Turnkey as TurnkeyServerSDK } from "@turnkey/sdk-server";
import { createAccount } from "@turnkey/viem";
import {
  buildIntentSigningPolicy,
  print,
  GasStationClient,
  GasStationHelpers,
} from "../lib";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

// Set to false to skip sub-org creation and just test signing
const CREATE_SUB_ORG = false;

const envSchema = z.object({
  BASE_URL: z.string().url(),
  API_PRIVATE_KEY: z.string().min(1),
  API_PUBLIC_KEY: z.string().min(1),
  ORGANIZATION_ID: z.string().min(1),
  EOA_PUBLIC_KEY: z.string().min(1),
  EOA_PRIVATE_KEY: z.string().min(1),
  USDC_ADDRESS: z.string().min(1).optional(),
  DAI_ADDRESS: z.string().min(1).optional(),
  // These are required when CREATE_SUB_ORG is false
  SUB_ORG_ID: z.string().min(1).optional(),
  EOA_WALLET_ADDRESS: z.string().min(1).optional(),
});

const env = envSchema.parse(process.env);

// Default to Base mainnet addresses if not specified
const USDC_ADDRESS =
  (env.USDC_ADDRESS as `0x${string}`) ||
  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const DAI_ADDRESS =
  (env.DAI_ADDRESS as `0x${string}`) ||
  "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb";

const turnkeyClient = new TurnkeyServerSDK({
  apiBaseUrl: env.BASE_URL,
  apiPrivateKey: env.API_PRIVATE_KEY,
  apiPublicKey: env.API_PUBLIC_KEY,
  defaultOrganizationId: env.ORGANIZATION_ID,
});

/**
 * Example: Create a sub-organization for a gas station with admin and EOA user
 *
 * This creates an isolated Turnkey sub-organization with:
 * - Admin user (from parent org) - retains root access
 * - EOA user (new end user) - will be removed from root quorum after policy creation
 * - One wallet with an Ethereum address
 * - Policies restricting EOA to only sign USDC transactions
 */
const main = async () => {
  print("===== Creating Sub-Organization with Delegated Access =====", "");

  let subOrgId: string;
  let walletAddress: `0x${string}`;

  const subOrgParams = {
    subOrganizationName: `Gas Station User - ${Date.now()}`,
    rootUsers: [
      {
        userName: "Admin User",
        userEmail: "admin@example.com",
        apiKeys: [
          {
            apiKeyName: "Admin API Key",
            publicKey: env.API_PUBLIC_KEY, // Use parent org's API key
            curveType: "API_KEY_CURVE_P256" as const,
          },
        ],
        authenticators: [],
        oauthProviders: [],
      },
      {
        userName: "EOA User",
        userEmail: "eoa@example.com",
        apiKeys: [
          {
            apiKeyName: "EOA API Key",
            publicKey: env.EOA_PUBLIC_KEY, // Use pre-configured EOA key
            curveType: "API_KEY_CURVE_P256" as const,
          },
        ],
        authenticators: [],
        oauthProviders: [],
      },
    ],
    rootQuorumThreshold: 1, // Single user approval required
    wallet: {
      walletName: "Gas Station Wallet",
      accounts: [
        {
          curve: "CURVE_SECP256K1" as const,
          pathFormat: "PATH_FORMAT_BIP32" as const,
          path: "m/44'/60'/0'/0/0", // Standard Ethereum derivation path
          addressFormat: "ADDRESS_FORMAT_ETHEREUM" as const,
        },
      ],
    },
    disableEmailRecovery: false,
    disableEmailAuth: false,
  };

  print("\nCreating sub-organization with:", "");
  print(`  Name: ${subOrgParams.subOrganizationName}`, "");
  print(
    `  Admin: ${subOrgParams.rootUsers[0].userName} (${subOrgParams.rootUsers[0].userEmail})`,
    ""
  );
  print(
    `  EOA User: ${subOrgParams.rootUsers[1].userName} (${subOrgParams.rootUsers[1].userEmail})`,
    ""
  );
  print(`  Wallet: ${subOrgParams.wallet?.walletName}`, "");

  try {
    const result = await turnkeyClient.apiClient().createSubOrganization({
      organizationId: env.ORGANIZATION_ID,
      subOrganizationName: subOrgParams.subOrganizationName,
      rootUsers: subOrgParams.rootUsers,
      rootQuorumThreshold: subOrgParams.rootQuorumThreshold,
      wallet: subOrgParams.wallet,
      disableEmailRecovery: subOrgParams.disableEmailRecovery,
      disableEmailAuth: subOrgParams.disableEmailAuth,
    });

    print("\n✅ Sub-Organization Created Successfully!", "");

    const subOrgResult = result.activity.result.createSubOrganizationResultV7;
    subOrgId = subOrgResult?.subOrganizationId!;
    const adminUserId = subOrgResult?.rootUserIds?.[0]!;
    const eoaUserId = subOrgResult?.rootUserIds?.[1]!;
    walletAddress = subOrgResult?.wallet?.addresses?.[0]! as `0x${string}`;

    print("\n═══════════════════════════════════════════════════════", "");
    print("📋 Sub-Organization Details", "");
    print("═══════════════════════════════════════════════════════", "");
    print(`Sub-Org ID:      ${subOrgId}`, "");
    print(`Wallet ID:       ${subOrgResult?.wallet?.walletId}`, "");
    print(`Wallet Address:  ${walletAddress}`, "");
    print(`Admin User ID:   ${adminUserId}`, "");
    print(`EOA User ID:     ${eoaUserId}`, "");

    // Step 2: Create policy to restrict EOA to only USDC transactions
    print("\n🔐 Creating EOA Signing Policy (USDC only)...", "");

    const eoaPolicy = buildIntentSigningPolicy({
      organizationId: subOrgId,
      eoaUserId: eoaUserId,
      restrictions: {
        allowedContracts: [USDC_ADDRESS],
      },
      policyName: "EOA USDC Only Policy",
    });

    try {
      const policyResult = await turnkeyClient
        .apiClient()
        .createPolicy(eoaPolicy);
      const policyId =
        policyResult.activity.result.createPolicyResult?.policyId;
      print(`✅ Policy created: ${policyId}`, "");
    } catch (error: any) {
      print(`❌ Failed to create EOA policy: ${error.message}`, "");
      throw error;
    }

    // Step 3: Remove EOA user from root quorum (keep only admin)
    print("👤 Updating root quorum (removing EOA user)...", "");

    try {
      await turnkeyClient.apiClient().updateRootQuorum({
        organizationId: subOrgId,
        threshold: 1,
        userIds: [adminUserId], // Keep only admin user in root quorum
      });
      print("✅ Root quorum updated", "");
    } catch (error: any) {
      print(`❌ Failed to update root quorum: ${error.message}`, "");
      throw error;
    }

    // Final summary
    print("\n✨ Setup Complete!", "");
    print(`📋 Sub-Org ID: ${subOrgId}`, "");
    print(`👤 EOA User ID: ${eoaUserId}`, "");
    print(`💰 Wallet: ${walletAddress}`, "");
  } catch (error: any) {
    console.error("❌ Failed to create sub-organization:", error.message);
    if (error.details) {
      console.error("Details:", error.details);
    }
    throw error;
  }

  // Test signing intents with the EOA user
  print("\n═══════════════════════════════════════════════════════", "");
  print("🧪 Testing Policy Enforcement", "");
  print("═══════════════════════════════════════════════════════", "");

  const eoaTurnkeyClient = new TurnkeyServerSDK({
    apiBaseUrl: env.BASE_URL,
    apiPrivateKey: env.EOA_PRIVATE_KEY,
    apiPublicKey: env.EOA_PUBLIC_KEY,
    defaultOrganizationId: subOrgId!,
  });

  const eoaAccount = await createAccount({
    client: eoaTurnkeyClient.apiClient(),
    organizationId: subOrgId!,
    signWith: walletAddress,
  });

  const eoaWalletClient = createWalletClient({
    account: eoaAccount,
    chain: base,
    transport: http(),
  });

  const gasStationClient = new GasStationClient({
    walletClient: eoaWalletClient,
    explorerUrl: "https://basescan.org",
  });

  // Track test results
  let usdcPassed = false;
  let daiPassed = false;

  // Test 1: Sign USDC transfer (should PASS)
  print("\n📝 Test 1: Signing USDC transfer (allowed by policy)...", "");
  try {
    const nonce = 0n;
    const executionParams = GasStationHelpers.buildTokenTransfer(
      USDC_ADDRESS as `0x${string}`,
      env.EOA_WALLET_ADDRESS as `0x${string}`,
      parseUnits("1", 6)
    );
    const builder = gasStationClient.createIntent();
    await builder
      .setTarget(executionParams.outputContract)
      .withValue(executionParams.value ?? 0n)
      .withCallData(executionParams.callData)
      .sign(nonce);

    usdcPassed = true;
    print("   ✅ Signed successfully", "");
  } catch (error: any) {
    print("   ❌ Failed to sign", "");
  }

  // Test 2: Sign DAI transfer (should FAIL - not in policy)
  print("\n📝 Test 2: Signing DAI transfer (blocked by policy)...", "");
  try {
    const nonce = 0n;
    const executionParams = GasStationHelpers.buildTokenTransfer(
      DAI_ADDRESS as `0x${string}`,
      env.EOA_WALLET_ADDRESS as `0x${string}`,
      parseUnits("1", 18)
    );
    const builder = gasStationClient.createIntent();
    await builder
      .setTarget(executionParams.outputContract)
      .withValue(executionParams.value ?? 0n)
      .withCallData(executionParams.callData)
      .sign(nonce);

    daiPassed = true;
    print("   ❌ Signed successfully (POLICY BYPASSED!)", "");
  } catch (error: any) {
    print("   ✅ Blocked by policy", "");
  }

  // Results summary
  print("\n═══════════════════════════════════════════════════════", "");
  print("🎯 Test Results", "");
  print("═══════════════════════════════════════════════════════", "");

  const usdcExpected = true; // Should pass
  const daiExpected = false; // Should be blocked

  print(`\nUSDC Transfer (allowed contract):`, "");
  print(`  Expected: ${usdcExpected ? "✅ Pass" : "❌ Block"}`, "");
  print(`  Actual:   ${usdcPassed ? "✅ Pass" : "❌ Block"}`, "");
  print(
    `  Result:   ${usdcPassed === usdcExpected ? "✅ CORRECT" : "❌ FAILED"}`,
    ""
  );

  print(`\nDAI Transfer (blocked contract):`, "");
  print(`  Expected: ${daiExpected ? "✅ Pass" : "❌ Block"}`, "");
  print(`  Actual:   ${daiPassed ? "✅ Pass" : "❌ Block"}`, "");
  print(
    `  Result:   ${daiPassed === daiExpected ? "✅ CORRECT" : "❌ FAILED"}`,
    ""
  );

  const allPassed = usdcPassed === usdcExpected && daiPassed === daiExpected;
  print(
    `\n${allPassed ? "✅ All tests passed! Policy is working correctly." : "❌ Some tests failed. Policy may not be working as expected."}`,
    ""
  );
};

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});

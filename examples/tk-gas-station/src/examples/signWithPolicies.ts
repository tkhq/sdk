import { resolve } from "path";
import * as dotenv from "dotenv";
import { z } from "zod";
import { parseUnits, createWalletClient, http } from "viem";
import { base } from "viem/chains";
import { Turnkey as TurnkeyServerSDK } from "@turnkey/sdk-server";
import { createAccount } from "@turnkey/viem";
import { generateP256KeyPair } from "@turnkey/crypto";
import {
  buildIntentSigningPolicy,
  buildPaymasterExecutionPolicy,
  print,
  GasStationClient,
  GasStationHelpers,
} from "../lib";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

// Set to false to skip sub-org creation and just test signing
const CREATE_SUB_ORG = true;

const envSchema = z.object({
  BASE_URL: z.string().url(),
  API_PRIVATE_KEY: z.string().min(1),
  API_PUBLIC_KEY: z.string().min(1),
  ORGANIZATION_ID: z.string().min(1),
  USDC_ADDRESS: z.string().min(1).optional(),
  DAI_ADDRESS: z.string().min(1).optional(),
  EXECUTION_CONTRACT: z.string().min(1).optional(),
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
 * Example: Create a sub-organization for a gas station with admin, EOA user, and paymaster
 *
 * This creates an isolated Turnkey sub-organization with:
 * - Admin user (from parent org) - retains root access
 * - EOA user (new end user) - will be removed from root quorum after policy creation
 * - Paymaster user (gas station operator) - will be removed from root quorum after policy creation
 * - Two wallets: one for EOA, one for paymaster
 * - Policies restricting EOA to only sign USDC transactions
 * - Policies restricting paymaster to only execute USDC transactions
 */
const main = async () => {
  print("===== Creating Sub-Organization with Delegated Access =====", "");

  // Generate API key pairs for EOA and Paymaster
  print("\n🔑 Generating EOA API Key Pair...", "");
  const eoaKeyPair = generateP256KeyPair();
  const eoaPublicKey = eoaKeyPair.publicKey;
  const eoaPrivateKey = eoaKeyPair.privateKey;
  console.log("\n📋 EOA Credentials (save these for reuse!):");
  console.log(`EOA_PUBLIC_KEY=${eoaPublicKey}`);
  console.log(`EOA_PRIVATE_KEY=${eoaPrivateKey}\n`);

  print("\n🔑 Generating Paymaster API Key Pair...", "");
  const paymasterKeyPair = generateP256KeyPair();
  const paymasterPublicKey = paymasterKeyPair.publicKey;
  const paymasterPrivateKey = paymasterKeyPair.privateKey;
  console.log("\n📋 Paymaster Credentials (save these for reuse!):");
  console.log(`PAYMASTER_PUBLIC_KEY=${paymasterPublicKey}`);
  console.log(`PAYMASTER_PRIVATE_KEY=${paymasterPrivateKey}\n`);

  let subOrgId: string;
  let eoaWalletAddress: `0x${string}`;
  let paymasterWalletAddress: `0x${string}`;
  let eoaUserId: string;
  let paymasterUserId: string;

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
            publicKey: eoaPublicKey,
            curveType: "API_KEY_CURVE_P256" as const,
          },
        ],
        authenticators: [],
        oauthProviders: [],
      },
      {
        userName: "Paymaster User",
        userEmail: "paymaster@example.com",
        apiKeys: [
          {
            apiKeyName: "Paymaster API Key",
            publicKey: paymasterPublicKey,
            curveType: "API_KEY_CURVE_P256" as const,
          },
        ],
        authenticators: [],
        oauthProviders: [],
      },
    ],
    rootQuorumThreshold: 1, // Single user approval required
    wallet: {
      walletName: "EOA Wallet",
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
  print(
    `  Paymaster: ${subOrgParams.rootUsers[2].userName} (${subOrgParams.rootUsers[2].userEmail})`,
    ""
  );
  print(`  EOA Wallet: ${subOrgParams.wallet.walletName}`, "");

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
    eoaUserId = subOrgResult?.rootUserIds?.[1]!;
    paymasterUserId = subOrgResult?.rootUserIds?.[2]!;
    eoaWalletAddress = subOrgResult?.wallet?.addresses?.[0]! as `0x${string}`;

    print("\n═══════════════════════════════════════════════════════", "");
    print("📋 Sub-Organization Details", "");
    print("═══════════════════════════════════════════════════════", "");
    print(`Sub-Org ID:            ${subOrgId}`, "");
    print(`EOA Wallet ID:         ${subOrgResult?.wallet?.walletId}`, "");
    print(`EOA Wallet Address:    ${eoaWalletAddress}`, "");
    print(`Admin User ID:         ${adminUserId}`, "");
    print(`EOA User ID:           ${eoaUserId}`, "");
    print(`Paymaster User ID:     ${paymasterUserId}`, "");

    // Step 2: Create paymaster wallet
    print("\n💰 Creating Paymaster Wallet...", "");

    try {
      const walletResult = await turnkeyClient.apiClient().createWallet({
        organizationId: subOrgId,
        walletName: "Paymaster Wallet",
        accounts: [
          {
            curve: "CURVE_SECP256K1",
            pathFormat: "PATH_FORMAT_BIP32",
            path: "m/44'/60'/0'/0/1", // Different derivation path
            addressFormat: "ADDRESS_FORMAT_ETHEREUM",
          },
        ],
      });

      const paymasterWalletId =
        walletResult.activity.result.createWalletResult?.walletId;
      paymasterWalletAddress = walletResult.activity.result.createWalletResult
        ?.addresses?.[0]! as `0x${string}`;

      print(`✅ Paymaster wallet created`, "");
      print(`Paymaster Wallet ID:   ${paymasterWalletId}`, "");
      print(`Paymaster Address:     ${paymasterWalletAddress}`, "");
    } catch (error: any) {
      print(`❌ Failed to create paymaster wallet: ${error.message}`, "");
      throw error;
    }

    // Step 3: Create policy to restrict EOA to only USDC transactions
    print("\n🔐 Creating EOA Signing Policy (USDC only)...", "");

    const eoaPolicy = buildIntentSigningPolicy({
      organizationId: subOrgId,
      eoaUserId: eoaUserId,
      restrictions: {
        allowedContracts: [USDC_ADDRESS],
      },
      policyName: `EOA USDC Only Policy - ${Date.now()}`,
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

    // Step 4: Remove EOA and Paymaster users from root quorum (keep only admin)
    print(
      "\n👤 Updating root quorum (removing EOA and Paymaster users)...",
      ""
    );

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
    print(`👤 Paymaster User ID: ${paymasterUserId}`, "");
    print(`💰 EOA Wallet: ${eoaWalletAddress}`, "");
    print(`💰 Paymaster Wallet: ${paymasterWalletAddress}`, "");
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
    apiPrivateKey: eoaPrivateKey,
    apiPublicKey: eoaPublicKey,
    defaultOrganizationId: subOrgId!,
  });

  const eoaAccount = await createAccount({
    client: eoaTurnkeyClient.apiClient(),
    organizationId: subOrgId!,
    signWith: eoaWalletAddress,
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
  let test1EoaSignPassed = false;
  let test2EoaSignPassed = false;
  let test3EoaSignPassed = false;
  let test4PaymasterUsdcPassed = false;
  let test5PaymasterDaiPassed = false;

  // Test 1: EOA signs USDC transfer (should PASS)
  print(
    "\n📝 Test 1: EOA signing USDC transfer (allowed by EOA policy)...",
    ""
  );
  let usdcIntent: any;
  try {
    const nonce = 0n;
    const executionParams = GasStationHelpers.buildTokenTransfer(
      USDC_ADDRESS as `0x${string}`,
      eoaWalletAddress,
      parseUnits("1", 6)
    );
    const builder = gasStationClient.createIntent();
    usdcIntent = await builder
      .setTarget(executionParams.outputContract)
      .withValue(executionParams.value ?? 0n)
      .withCallData(executionParams.callData)
      .sign(nonce);

    test1EoaSignPassed = true;
    print("   ✅ EOA signed successfully", "");
  } catch (error: any) {
    print("   ❌ EOA failed to sign", "");
  }

  // Test 2: EOA signs DAI transfer (should FAIL - not in EOA policy)
  print("\n📝 Test 2: EOA signing DAI transfer (blocked by EOA policy)...", "");
  try {
    const nonce = 1n;
    const executionParams = GasStationHelpers.buildTokenTransfer(
      DAI_ADDRESS as `0x${string}`,
      eoaWalletAddress,
      parseUnits("1", 18)
    );
    const builder = gasStationClient.createIntent();
    await builder
      .setTarget(executionParams.outputContract)
      .withValue(executionParams.value ?? 0n)
      .withCallData(executionParams.callData)
      .sign(nonce);

    test2EoaSignPassed = true;
    print("   ❌ EOA signed successfully (POLICY BYPASSED!)", "");
  } catch (error: any) {
    print("   ✅ Blocked by EOA policy", "");
  }

  // Add DAI policy for EOA (but not for paymaster)
  print("\n═══════════════════════════════════════════════════════", "");
  print("🔐 Adding DAI Policy for EOA (but NOT for Paymaster)", "");
  print("═══════════════════════════════════════════════════════", "");
  print("\n🔐 Creating EOA DAI Signing Policy...", "");

  const eoaDaiPolicy = buildIntentSigningPolicy({
    organizationId: subOrgId!,
    eoaUserId: eoaUserId,
    restrictions: {
      allowedContracts: [DAI_ADDRESS.toLowerCase() as `0x${string}`],
    },
    policyName: `EOA DAI Policy - ${Date.now()}`,
  });

  try {
    const policyResult = await turnkeyClient
      .apiClient()
      .createPolicy(eoaDaiPolicy);
    const policyId = policyResult.activity.result.createPolicyResult?.policyId;
    print(`✅ EOA DAI policy created: ${policyId}`, "");
    print("   Note: Paymaster policy will still only allow USDC", "");
  } catch (error: any) {
    print(`❌ Failed to create EOA DAI policy: ${error.message}`, "");
  }

  // Test 3: EOA signs DAI transfer (should NOW PASS with new policy)
  print(
    "\n📝 Test 3: EOA signing DAI transfer (now allowed by EOA policy)...",
    ""
  );
  let daiIntent: any;
  try {
    const nonce = 2n;
    const executionParams = GasStationHelpers.buildTokenTransfer(
      DAI_ADDRESS as `0x${string}`,
      eoaWalletAddress,
      parseUnits("1", 18)
    );
    const builder = gasStationClient.createIntent();
    daiIntent = await builder
      .setTarget(executionParams.outputContract)
      .withValue(executionParams.value ?? 0n)
      .withCallData(executionParams.callData)
      .sign(nonce);

    test3EoaSignPassed = true;
    print("   ✅ EOA signed successfully", "");
  } catch (error: any) {
    print("   ❌ EOA failed to sign", "");
  }

  // Test Paymaster Execution
  print("\n═══════════════════════════════════════════════════════", "");
  print("🔐 Testing Paymaster Execution Policy", "");
  print("═══════════════════════════════════════════════════════", "");

  // Only run paymaster tests if we have the required data
  if (env.EXECUTION_CONTRACT) {
    const EXECUTION_CONTRACT =
      env.EXECUTION_CONTRACT.toLowerCase() as `0x${string}`;

    print("\n🔐 Creating Paymaster Policy (USDC execution only)...", "");
    print(`   Allowing EOA: ${eoaWalletAddress}`, "");
    print(`   Allowing Contract: ${USDC_ADDRESS}`, "");

    // Create paymaster policy that only allows USDC contract execution
    const paymasterPolicy = buildPaymasterExecutionPolicy({
      organizationId: subOrgId,
      paymasterUserId: paymasterUserId,
      executionContractAddress: EXECUTION_CONTRACT,
      restrictions: {
        allowedContracts: [USDC_ADDRESS.toLowerCase() as `0x${string}`],
        allowedEOAs: [eoaWalletAddress.toLowerCase() as `0x${string}`],
      },
      policyName: `Paymaster USDC Only Policy - ${Date.now()}`,
    });

    try {
      const policyResult = await turnkeyClient
        .apiClient()
        .createPolicy(paymasterPolicy);
      const policyId =
        policyResult.activity.result.createPolicyResult?.policyId;
      print(`✅ Paymaster policy created: ${policyId}`, "");
      print("   Note: Paymaster can only execute USDC, not DAI", "");
    } catch (error: any) {
      print(`❌ Failed to create paymaster policy: ${error.message}`, "");
      // Don't throw - continue with tests to see what happens
    }

    // Create paymaster Turnkey client and wallet
    const paymasterTurnkeyClient = new TurnkeyServerSDK({
      apiBaseUrl: env.BASE_URL,
      apiPrivateKey: paymasterPrivateKey,
      apiPublicKey: paymasterPublicKey,
      defaultOrganizationId: subOrgId!,
    });

    const paymasterAccount = await createAccount({
      client: paymasterTurnkeyClient.apiClient(),
      organizationId: subOrgId,
      signWith: paymasterWalletAddress,
    });

    const paymasterWalletClient = createWalletClient({
      account: paymasterAccount,
      chain: base,
      transport: http(),
    });

    const paymasterGasStationClient = new GasStationClient({
      walletClient: paymasterWalletClient,
      explorerUrl: "https://basescan.org",
    });

    // Test 4: Paymaster signs execution for USDC intent (should PASS - USDC allowed in paymaster policy)
    print(
      "\n📝 Test 4: Paymaster signing execution for USDC (allowed by paymaster policy)...",
      ""
    );
    print("   EOA signed USDC intent in Test 1 ✅", "");
    print("   Paymaster should be able to sign the execution...", "");
    print(`   Intent EOA Address: ${usdcIntent?.eoaAddress}`, "");
    print(`   Policy Allows EOA: ${eoaWalletAddress}`, "");

    try {
      if (!usdcIntent) {
        throw new Error("USDC intent not available from Test 1");
      }

      // Paymaster signs the execution transaction (doesn't send it)
      await paymasterGasStationClient.signExecution(usdcIntent);

      test4PaymasterUsdcPassed = true;
      print("   ✅ Paymaster signed execution successfully", "");
    } catch (error: any) {
      print(`   ❌ Blocked by paymaster policy: ${error.message}`, "");
    }

    // Test 5: Paymaster tries to sign execution for DAI intent (should FAIL - DAI not in paymaster policy)
    print(
      "\n📝 Test 5: Paymaster signing execution for DAI (blocked by paymaster policy)...",
      ""
    );
    print("   EOA already signed DAI intent in Test 3 ✅", "");
    print("   But paymaster should be blocked from signing execution...", "");

    try {
      if (!daiIntent) {
        throw new Error("DAI intent not available from Test 3");
      }

      // Paymaster tries to sign the execution transaction (should fail)
      await paymasterGasStationClient.signExecution(daiIntent);

      test5PaymasterDaiPassed = true;
      print("   ❌ Paymaster signed execution (POLICY BYPASSED!)", "");
    } catch (error: any) {
      print("   ✅ Blocked by paymaster policy", "");
    }
  } else {
    print(
      "\n⚠️  Skipping paymaster tests - missing EXECUTION_CONTRACT environment variable",
      ""
    );
    print(
      "   Set EXECUTION_CONTRACT in .env.local to the gas station execution contract address",
      ""
    );
  }

  // Results summary
  print("\n═══════════════════════════════════════════════════════", "");
  print("🎯 Test Results", "");
  print("═══════════════════════════════════════════════════════", "");

  const test1Expected = true; // EOA should sign USDC
  const test2Expected = false; // EOA should be blocked from DAI (initially)
  const test3EoaExpected = true; // EOA should sign DAI (after policy added)
  const test4PaymasterUsdcExpected = true; // Paymaster should execute USDC
  const test5PaymasterDaiExpected = false; // Paymaster should be blocked from DAI

  print(`\nTest 1 - EOA signs USDC (allowed by EOA policy):`, "");
  print(`  Expected: ${test1Expected ? "✅ Pass" : "❌ Block"}`, "");
  print(`  Actual:   ${test1EoaSignPassed ? "✅ Pass" : "❌ Block"}`, "");
  print(
    `  Result:   ${test1EoaSignPassed === test1Expected ? "✅ CORRECT" : "❌ FAILED"}`,
    ""
  );

  print(`\nTest 2 - EOA signs DAI (blocked by EOA policy initially):`, "");
  print(`  Expected: ${test2Expected ? "✅ Pass" : "❌ Block"}`, "");
  print(`  Actual:   ${test2EoaSignPassed ? "✅ Pass" : "❌ Block"}`, "");
  print(
    `  Result:   ${test2EoaSignPassed === test2Expected ? "✅ CORRECT" : "❌ FAILED"}`,
    ""
  );

  print(`\nTest 3 - EOA signs DAI (now allowed after adding policy):`, "");
  print(`  Expected: ${test3EoaExpected ? "✅ Pass" : "❌ Block"}`, "");
  print(`  Actual:   ${test3EoaSignPassed ? "✅ Pass" : "❌ Block"}`, "");
  print(
    `  Result:   ${test3EoaSignPassed === test3EoaExpected ? "✅ CORRECT" : "❌ FAILED"}`,
    ""
  );

  // Show paymaster results if tests were run
  if (env.EXECUTION_CONTRACT) {
    print(
      `\nTest 4 - Paymaster executes USDC (allowed by paymaster policy):`,
      ""
    );
    print(
      `  Expected: ${test4PaymasterUsdcExpected ? "✅ Pass" : "❌ Block"}`,
      ""
    );
    print(
      `  Actual:   ${test4PaymasterUsdcPassed ? "✅ Pass" : "❌ Block"}`,
      ""
    );
    print(
      `  Result:   ${test4PaymasterUsdcPassed === test4PaymasterUsdcExpected ? "✅ CORRECT" : "❌ FAILED"}`,
      ""
    );

    print(
      `\nTest 5 - Paymaster executes DAI (blocked by paymaster policy):`,
      ""
    );
    print(
      `  Expected: ${test5PaymasterDaiExpected ? "✅ Pass" : "❌ Block"}`,
      ""
    );
    print(
      `  Actual:   ${test5PaymasterDaiPassed ? "✅ Pass" : "❌ Block"}`,
      ""
    );
    print(
      `  Result:   ${test5PaymasterDaiPassed === test5PaymasterDaiExpected ? "✅ CORRECT" : "❌ FAILED"}`,
      ""
    );

    const allPassed =
      test1EoaSignPassed === test1Expected &&
      test2EoaSignPassed === test2Expected &&
      test3EoaSignPassed === test3EoaExpected &&
      test4PaymasterUsdcPassed === test4PaymasterUsdcExpected &&
      test5PaymasterDaiPassed === test5PaymasterDaiExpected;

    print("\n═══════════════════════════════════════════════════════", "");
    print(
      `${allPassed ? "✅ All tests passed! Two-layer policy protection is working correctly." : "❌ Some tests failed. Policies may not be working as expected."}`,
      ""
    );

    if (allPassed) {
      print("\n🎯 Key Takeaways:", "");
      print(
        "   1. EOA policy controls what intents can be signed (Layer 1)",
        ""
      );
      print(
        "   2. Paymaster policy controls what can be executed on-chain (Layer 2)",
        ""
      );
      print(
        "   3. Both layers must allow the transaction for it to succeed",
        ""
      );
      print("   4. USDC: Both EOA and paymaster allow it → ✅ Success", "");
      print(
        "   5. DAI: EOA allows signing, but paymaster blocks execution → ❌ Blocked",
        ""
      );
    }
  } else {
    const allPassed =
      test1EoaSignPassed === test1Expected &&
      test2EoaSignPassed === test2Expected &&
      test3EoaSignPassed === test3EoaExpected;
    print(
      `\n${allPassed ? "✅ All tests passed! EOA policy is working correctly." : "❌ Some tests failed. Policy may not be working as expected."}`,
      ""
    );
  }
};

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});

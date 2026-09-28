import * as dotenv from "dotenv";
import * as path from "path";
import * as readline from "readline/promises";
import { Turnkey } from "@turnkey/sdk-server";
import type {
  TEthSendTransactionV2Body,
  TurnkeyApiClient,
} from "@turnkey/sdk-server";
import { parseUnits, encodeFunctionData } from "viem";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

// =====================================================
// Turnkey Delegated Access + Policy Enforcement Demo
// =====================================================
// This demo shows how to:
// - Create isolated merchant wallets using Turnkey Sub-Organizations
// - Use a single delegated API key to securely sweep USDC on behalf of merchants
// - Enforce strict policies so the delegated API key can ONLY be used to send USDC to the treasury
// - Run positive (successful sweep) and negative (blocked malicious tx) tests
// =====================================================

// Minimal USDC ABI (only the functions we need)
const USDC_ABI = [
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

const TURNKEY_CAIP2 = (process.env.TURNKEY_CAIP2 ||
  "eip155:11155111") as TEthSendTransactionV2Body["caip2"];
// Turnkey Gas Sponsorship: on by default so merchants never need to hold ETH for gas.
const TURNKEY_SPONSOR = process.env.TURNKEY_SPONSOR !== "false";
const SUBORG_PREFIX = "with-abi-policy-control-";
const API_BASE_URL = process.env.TURNKEY_BASE_URL || "https://api.turnkey.com";
const DEFAULT_FUND_ETH = "0.003";

interface Merchant {
  merchantId: string;
  subOrgId: string;
  depositAddress: string;
  delegatedClient: TurnkeyApiClient;
}

// =====================================================
// Parent Organization Client
// This client has full root access to the parent org.
// Used to create merchant sub-organizations and to read sub-org data
// (wallet accounts, balances) across all of them.
// =====================================================
const parentClient = new Turnkey({
  apiBaseUrl: API_BASE_URL,
  apiPublicKey: process.env.TURNKEY_API_PUBLIC_KEY!,
  apiPrivateKey: process.env.TURNKEY_API_PRIVATE_KEY!,
  defaultOrganizationId: process.env.TURNKEY_ORGANIZATION_ID!,
}).apiClient();

// =====================================================
// Helper: Build a delegated client scoped to a single merchant sub-org
// =====================================================
function makeDelegatedClient(subOrgId: string) {
  return new Turnkey({
    apiBaseUrl: API_BASE_URL,
    apiPublicKey: process.env.DELEGATED_API_PUBLIC_KEY!,
    apiPrivateKey: process.env.DELEGATED_API_PRIVATE_KEY!,
    defaultOrganizationId: subOrgId,
  }).apiClient();
}

// =====================================================
// Helper: Encode a USDC transfer(to, amount) calldata payload
// =====================================================
function encodeUsdcTransfer(to: string, amount: bigint): `0x${string}` {
  return encodeFunctionData({
    abi: USDC_ABI,
    functionName: "transfer",
    args: [to as `0x${string}`, amount],
  });
}

// =====================================================
// Helper: Fetch ETH + USDC balances via Turnkey's Balances API
// No public RPC node needed. Amounts come back in atomic units, and only
// non-zero balances are returned, so a missing asset means 0.
// =====================================================
async function getEthAndUsdcBalances(organizationId: string, address: string) {
  const { balances } = await parentClient.getWalletAddressBalances({
    organizationId,
    address,
    caip2: TURNKEY_CAIP2,
  });

  // The native gas asset has a slip44 CAIP-19 ID (e.g. "eip155:11155111/slip44:60"),
  // so this picks ETH, POL, BNB, etc. on whatever chain TURNKEY_CAIP2 points at.
  const native = balances?.find((b) => b.caip19?.includes("/slip44:"));
  const usdc = balances?.find((b) =>
    b.caip19?.toLowerCase().endsWith(process.env.USDC_CONTRACT!.toLowerCase()),
  );

  return {
    // Raw atomic units — use these for arithmetic (e.g. the sweep amount).
    ethBalance: BigInt(native?.balance ?? "0"),
    usdcBalance: BigInt(usdc?.balance ?? "0"),
    // Turnkey's normalized strings — display only, never arithmetic.
    ethDisplay: native?.display?.crypto ?? "0",
    usdcDisplay: usdc?.display?.crypto ?? "0",
  };
}

function getMerchantByIndex(
  merchants: Merchant[],
  input: string,
): Merchant | undefined {
  const index = parseInt(input, 10) - 1;
  if (isNaN(index)) return;
  return merchants[index];
}

// Detects a policy denial by string-matching Turnkey's display error message,
// not a stable error code — update the string if Turnkey rewords it.
function handlePolicyTestError(error: unknown, successMessage: string) {
  const errorMessage = error instanceof Error ? error.message : "";

  if (errorMessage.includes("No policies evaluated to outcome: Allow")) {
    console.log(successMessage);
    return;
  }

  console.log(`   🔍 Turnkey error:`, errorMessage);
  console.log(`   ⚠️ Transaction failed for another reason`);
}

async function loadMerchantsFromTurnkey(): Promise<Merchant[]> {
  const allResp = await parentClient.getSubOrgIds({
    organizationId: process.env.TURNKEY_ORGANIZATION_ID!,
  });

  const allSubOrgIds: string[] = allResp?.organizationIds || [];

  // Get org details for each sub-org to filter by name.
  // Demo-only: one getWhoami per sub-org (N+1); production would keep merchant sub-org IDs in its own DB.
  const filteredSubOrgIds: string[] = [];
  for (const subOrgId of allSubOrgIds) {
    try {
      const whoami = await parentClient.getWhoami({ organizationId: subOrgId });
      const orgName = whoami?.organizationName || "";
      if (orgName.startsWith(SUBORG_PREFIX)) {
        filteredSubOrgIds.push(subOrgId);
      }
    } catch {
      // Skip if we can't get org details
    }
  }

  const loaded: Merchant[] = [];
  let skipped = 0;
  let firstError: string | null = null;

  for (const subOrgId of filteredSubOrgIds) {
    try {
      const { accounts } = await parentClient.getWalletAccounts({
        organizationId: subOrgId,
        includeWalletDetails: true,
      });
      const depositAccount = accounts.find((a) => a.address);
      const depositAddress = depositAccount?.address;
      if (!depositAddress) {
        skipped++;
        continue;
      }

      const walletName = depositAccount?.walletDetails?.walletName || "";
      const merchantId = walletName.startsWith("Deposit-Wallet-")
        ? walletName.replace("Deposit-Wallet-", "")
        : walletName || `suborg-${subOrgId.slice(0, 8)}`;

      const delegatedClient = makeDelegatedClient(subOrgId);

      loaded.push({
        merchantId,
        subOrgId,
        depositAddress,
        delegatedClient,
      });
    } catch (error) {
      skipped++;
      if (!firstError) {
        firstError = error instanceof Error ? error.message : String(error);
      }
      // Skip unreadable sub-orgs so startup is resilient for demo runs.
    }
  }

  if (filteredSubOrgIds.length === 0) {
    console.log(
      `Startup note: no sub-orgs found matching prefix '${SUBORG_PREFIX}'.`,
    );
  } else if (loaded.length === 0) {
    console.log(
      `Startup warning: found ${filteredSubOrgIds.length} matching sub-org(s) but loaded 0 merchants${firstError ? ` (${firstError})` : ""}.`,
    );
  } else if (skipped > 0) {
    console.log(
      `Startup note: skipped ${skipped} sub-org(s) with no readable deposit wallet.`,
    );
  }

  return loaded;
}

async function sendEvmTransaction(
  client: TurnkeyApiClient,
  params: {
    from: string;
    to: string;
    data?: `0x${string}`;
    valueWei?: bigint;
  },
): Promise<string> {
  // Turnkey takes an ordered `calls` array: a single entry is a normal
  // EIP-1559 transaction; multiple entries batch via EIP-7702 (Gas Station).
  const txPayload = {
    from: params.from,
    caip2: TURNKEY_CAIP2,
    sponsor: TURNKEY_SPONSOR,
    calls: [
      {
        to: params.to,
        value: (params.valueWei ?? 0n).toString(),
        data: params.data || "0x",
      },
    ],
  };

  const sendResp = await client.ethSendTransaction(txPayload);
  const sendTransactionStatusId = sendResp?.sendTransactionStatusId;

  if (!sendTransactionStatusId) {
    throw new Error(
      "Missing sendTransactionStatusId from Turnkey ethSendTransaction",
    );
  }

  const statusResp = await client.pollTransactionStatus({
    sendTransactionStatusId,
  });
  const txHash = statusResp?.eth?.txHash;

  if (!txHash) {
    const errorMessage =
      statusResp?.error?.message ||
      "Turnkey transaction failed without tx hash";
    throw new Error(errorMessage);
  }

  return txHash;
}

// =====================================================
// Perform USDC sweep using the delegated client
// This is the core "positive" flow: merchant USDC → treasury
// =====================================================
async function performUSDCSweep(
  delegatedClient: TurnkeyApiClient,
  subOrgId: string,
  merchantAddress: string,
  treasuryAddress: string,
) {
  const { ethBalance, usdcBalance, usdcDisplay } = await getEthAndUsdcBalances(
    subOrgId,
    merchantAddress,
  );

  // Safety check: merchant needs ETH for gas unless sponsorship is enabled.
  if (!TURNKEY_SPONSOR) {
    if (ethBalance === 0n) {
      console.log(
        `   ❌ Cannot sweep: Merchant has 0 ETH for gas. Use 'fund' command first.`,
      );
      return;
    }
  }

  if (usdcBalance === 0n) {
    console.log(`   USDC balance is 0. Nothing to sweep.`);
    return;
  }

  console.log(`   USDC balance: ${usdcDisplay}`);

  const hash = await sendEvmTransaction(delegatedClient, {
    from: merchantAddress,
    to: process.env.USDC_CONTRACT!,
    data: encodeUsdcTransfer(treasuryAddress, usdcBalance),
  });

  console.log(`   ✅ Swept ${usdcDisplay} USDC → Tx: ${hash}`);
}

// =====================================================
// Negative Test: Try to send ETH from merchant (should be blocked by policy)
// =====================================================
async function tryMaliciousETHTransfer(
  delegatedClient: TurnkeyApiClient,
  merchantAddress: string,
  treasuryAddress: string,
) {
  console.log(`   ❌ Testing malicious ETH send to treasury...`);
  try {
    await sendEvmTransaction(delegatedClient, {
      from: merchantAddress,
      to: treasuryAddress,
      valueWei: parseUnits("0.001", 18),
    });

    console.log(
      `   ⚠️ WARNING: Transaction succeeded when it should have been blocked!`,
    );
  } catch (error) {
    handlePolicyTestError(
      error,
      `   ✅ Policy correctly blocked non-USDC transfer`,
    );
  }
}

// =====================================================
// Negative Test: Try to send USDC to wrong address (should be blocked)
// =====================================================
async function tryMaliciousUSDCToWrongRecipient(
  delegatedClient: TurnkeyApiClient,
  merchantAddress: string,
) {
  console.log(`   ❌ Testing USDC to wrong recipient...`);

  const vitalikAddress = "0xd8da6bf26964af9d7eed9e03e53415d37aa96045";

  try {
    await sendEvmTransaction(delegatedClient, {
      from: merchantAddress,
      to: process.env.USDC_CONTRACT!,
      data: encodeUsdcTransfer(vitalikAddress, parseUnits("10", 6)),
    });

    console.log(
      `   ⚠️ WARNING: USDC transfer succeeded when it should have been blocked!`,
    );
  } catch (error) {
    handlePolicyTestError(
      error,
      `   ✅ Policy correctly blocked wrong recipient`,
    );
  }
}

// =====================================================
// Create a new merchant
// This is the core function that demonstrates Turnkey's power:
// 1. Creates a Sub-Organization (isolated environment per merchant)
// 2. Attaches a delegated API key + merchant root user
// 3. Creates a restrictive policy (only USDC → treasury allowed)
// 4. Removes the delegated key from root quorum, leaving it bound by that policy
// =====================================================
async function createMerchant(merchantId: string): Promise<Merchant> {
  const treasuryAddress = process.env.TREASURY_ADDRESS!;
  const subOrgName = `${SUBORG_PREFIX}${merchantId}`;

  // Step 1: Create Sub-Organization with delegated key + merchant root user
  const subOrg = await parentClient.createSubOrganization({
    subOrganizationName: subOrgName,
    rootUsers: [
      {
        userName: "Parent-Delegated",
        apiKeys: [
          {
            apiKeyName: `da-${merchantId}`,
            publicKey: process.env.DELEGATED_API_PUBLIC_KEY!,
            curveType: "API_KEY_CURVE_P256",
          },
        ],
        authenticators: [],
        oauthProviders: [],
      },
      {
        userName: `Merchant-${merchantId}-Root`,
        userEmail: `merchant-${merchantId}@merchant.example`,
        apiKeys: [],
        authenticators: [],
        oauthProviders: [],
      },
    ],
    rootQuorumThreshold: 1,
    wallet: {
      walletName: `Deposit-Wallet-${merchantId}`,
      accounts: [
        {
          curve: "CURVE_SECP256K1",
          pathFormat: "PATH_FORMAT_BIP32",
          path: "m/44'/60'/0'/0/0",
          addressFormat: "ADDRESS_FORMAT_ETHEREUM",
        },
      ],
    },
  });

  const subOrgId = subOrg.subOrganizationId!;
  // rootUserIds come back in the same order as rootUsers above.
  const [delegatedUserId, merchantRootUserId] = subOrg.rootUserIds!;
  const depositAddress = subOrg.wallet?.addresses?.[0];

  if (!depositAddress) throw new Error("Failed to get deposit address");
  if (!delegatedUserId || !merchantRootUserId)
    throw new Error("Failed to get sub-org root user IDs");

  // Step 2: Create a delegated client scoped ONLY to this merchant's sub-org
  const delegatedClient = makeDelegatedClient(subOrgId);

  // Step 3: Register the USDC ABI so the policy engine can decode contract_call_args
  await delegatedClient.createSmartContractInterface({
    organizationId: subOrgId,
    smartContractAddress: process.env.USDC_CONTRACT!,
    smartContractInterface: JSON.stringify(USDC_ABI),
    type: "SMART_CONTRACT_INTERFACE_TYPE_ETHEREUM",
    label: "USDC",
    notes: "Minimal USDC ABI for policy enforcement",
  });

  // Step 4: Create restrictive policy
  await delegatedClient.createPolicy({
    policyName: "Delegated-Access-USDC-to-Treasury",
    effect: "EFFECT_ALLOW",
    consensus: `approvers.any(user, user.id == '${delegatedUserId}')`,
    condition: `
      eth.tx.to == '${process.env.USDC_CONTRACT}' &&
      eth.tx.function_name == 'transfer' &&
      eth.tx.contract_call_args['to'] == '${treasuryAddress}'
    `.trim(),
    notes: "Delegated Access: only allow USDC transfers to treasury",
  });

  // Step 5: Remove the delegated user from the root quorum.
  // The delegated user started as a root user only so it could run Steps 3–4 inside
  // this sub-org (the parent org can read sub-orgs but can't act in them). After this
  // call the merchant root user is the sole root, and the delegated key can do nothing
  // except what the Step 4 policy allows: USDC transfer() to the treasury.
  // If this call fails the delegated key stays root, so treat that sub-org as unsafe.
  await delegatedClient.updateRootQuorum({
    threshold: 1,
    userIds: [merchantRootUserId],
  });

  console.log(`✅ Merchant "${merchantId}" created`);
  console.log(`   Sub-org ID:      ${subOrgId}`);
  console.log(`   Deposit Address: ${depositAddress}`);

  return { merchantId, subOrgId, depositAddress, delegatedClient };
}

// =====================================================
// Fund a merchant with ETH from the treasury
// =====================================================
async function fundMerchant(
  merchantAddress: string,
  amountEth: string = DEFAULT_FUND_ETH,
) {
  const hash = await sendEvmTransaction(parentClient, {
    from: process.env.TREASURY_ADDRESS!,
    to: merchantAddress,
    valueWei: parseUnits(amountEth, 18),
  });

  console.log(`   ✅ Funded ${amountEth} ETH to merchant → Tx: ${hash}`);
}

// =====================================================
// Interactive CLI
// =====================================================
async function main() {
  console.log(
    "🚀 with-abi-policy-control — Delegated Access + ABI Policy Demo",
  );
  console.log("Commands:");
  console.log("  create <name>           → Create new merchant");
  console.log(
    "  fund <number> [eth]     → Fund merchant with ETH (default 0.003)",
  );
  console.log(
    "  sweepAll                → Sweep full USDC balance of all merchants",
  );
  console.log("  malicious <number>      → Run negative tests");
  console.log("  list                    → List merchants");
  console.log("  exit                    → Quit\n");

  // Both values are baked into each merchant's policy, so fail fast if missing.
  if (!process.env.TREASURY_ADDRESS || !process.env.USDC_CONTRACT)
    throw new Error("Set TREASURY_ADDRESS and USDC_CONTRACT in .env.local");

  const treasury = process.env.TREASURY_ADDRESS;
  const merchants: Merchant[] = await loadMerchantsFromTurnkey();

  if (merchants.length > 0) {
    console.log(`Loaded ${merchants.length} existing merchants from Turnkey.`);
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  while (true) {
    // rl.question rejects once stdin closes (Ctrl-D, or piped input running out).
    const line = await rl.question("> ").catch(() => null);
    if (line === null) break;

    try {
      const [cmd = "", ...args] = line.trim().split(/\s+/);
      const name = args[0] || "";

      if (["exit", "quit", "q"].includes(cmd.toLowerCase())) {
        break;
      }

      switch (cmd.toLowerCase()) {
        case "create": {
          if (!name) {
            console.log("Usage: create <name>");
            break;
          }
          const m = await createMerchant(name);
          merchants.push(m);
          break;
        }

        case "fund": {
          if (!name) {
            console.log("Usage: fund <number> [amount]");
            break;
          }
          const fundTarget = getMerchantByIndex(merchants, name);
          if (!fundTarget) {
            console.log("Merchant not found.");
            break;
          }
          await fundMerchant(
            fundTarget.depositAddress,
            args[1] || DEFAULT_FUND_ETH,
          );
          break;
        }

        case "list":
          console.log("\n📋 Merchants:");
          for (const [i, m] of merchants.entries()) {
            console.log(`   ${i + 1}. ${m.merchantId}`);
            console.log(`      Sub-org ID:     ${m.subOrgId}`);
            console.log(`      Deposit Address: ${m.depositAddress}`);
            try {
              const { ethDisplay, usdcDisplay } = await getEthAndUsdcBalances(
                m.subOrgId,
                m.depositAddress,
              );
              console.log(`      ETH: ${ethDisplay} | USDC: ${usdcDisplay}`);
            } catch {
              console.log("      ETH: n/a | USDC: n/a");
            }
          }
          break;

        case "sweepall":
          if (merchants.length === 0) {
            console.log("No merchants created yet.");
            break;
          }
          for (const m of merchants) {
            console.log(`--- ${m.merchantId} ---`);
            // Keep going if one merchant fails so the rest still get swept.
            try {
              await performUSDCSweep(
                m.delegatedClient,
                m.subOrgId,
                m.depositAddress,
                treasury,
              );
            } catch (err) {
              console.error(
                "   ❌ Sweep failed:",
                err instanceof Error ? err.message : err,
              );
            }
          }
          break;

        case "malicious": {
          if (!name) {
            console.log("Usage: malicious <number>");
            break;
          }
          const target = getMerchantByIndex(merchants, name);
          if (!target) {
            console.log("Merchant not found.");
            break;
          }
          await tryMaliciousETHTransfer(
            target.delegatedClient,
            target.depositAddress,
            treasury,
          );
          await tryMaliciousUSDCToWrongRecipient(
            target.delegatedClient,
            target.depositAddress,
          );
          break;
        }

        default:
          if (cmd) console.log("Unknown command.");
      }
    } catch (err) {
      console.error("❌ Error:", err instanceof Error ? err.message : err);
      console.log("   (You can still type 'exit' to quit)\n");
    }
  }

  rl.close();
  console.log("Goodbye!");
}

main().catch(console.error);

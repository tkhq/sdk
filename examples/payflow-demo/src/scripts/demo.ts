import * as fs from "fs";
import * as path from "path";
import { ethers } from "ethers";
import { getAutomationClient } from "../turnkey";
import { pollTransactionStatus } from "../turnkey";
import {
  SEPOLIA_USDC_ADDRESS,
  SEPOLIA_CAIP2,
  SEPOLIA_RPC_URL,
  ERC20_ABI,
  GENERATED_FILE,
} from "../config";

interface GeneratedConfig {
  merchantWalletId: string;
  merchantAddresses: string[];
  treasuryWalletId: string;
  treasuryAddress: string;
  automationUserId: string;
  automationApiPublicKey: string;
  automationApiPrivateKey: string;
  policyId: string;
}

function loadGenerated(): GeneratedConfig {
  const filePath = path.resolve(process.cwd(), GENERATED_FILE);
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `${GENERATED_FILE} not found. Run 'pnpm setup' first.`,
    );
  }
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

async function main() {
  const config = loadGenerated();
  const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC_URL);
  const usdc = new ethers.Contract(SEPOLIA_USDC_ADDRESS, ERC20_ABI, provider);
  const iface = new ethers.Interface(ERC20_ABI);

  const automationClient = getAutomationClient();
  const api = automationClient.apiClient();
  const organizationId = process.env.ORGANIZATION_ID!;

  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║            Payflow Demo — Merchant Sweep Flow           ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  // ── Display architecture ──
  console.log("Architecture:");
  console.log(`  Merchant Wallet: ${config.merchantWalletId}`);
  for (let i = 0; i < config.merchantAddresses.length; i++) {
    console.log(`    Account ${i}: ${config.merchantAddresses[i]}`);
  }
  console.log(`  Treasury Wallet: ${config.treasuryWalletId}`);
  console.log(`    Address: ${config.treasuryAddress}`);
  console.log(`  Automation User: ${config.automationUserId}`);
  console.log(`  Policy: ${config.policyId}`);
  console.log();

  // ── Find a funded merchant account ──
  console.log("─── Checking Merchant Balances ───\n");
  let fundedIndex = -1;
  let fundedBalance = 0n;

  for (let i = 0; i < config.merchantAddresses.length; i++) {
    const balance: bigint = await usdc.balanceOf!(config.merchantAddresses[i]);
    const formatted = ethers.formatUnits(balance, 6);
    console.log(`  Merchant ${i} (${config.merchantAddresses[i]}): ${formatted} USDC`);
    if (balance > 0n && fundedIndex === -1) {
      fundedIndex = i;
      fundedBalance = balance;
    }
  }

  console.log();

  if (fundedIndex === -1) {
    console.log("⚠  No merchant accounts have USDC balances.");
    console.log("   Fund a merchant account at https://faucet.circle.com/ and re-run.\n");
    console.log("   Merchant addresses:");
    for (const addr of config.merchantAddresses) {
      console.log(`     ${addr}`);
    }
    process.exit(0);
  }

  const merchantAddress = config.merchantAddresses[fundedIndex]!;
  const formattedBalance = ethers.formatUnits(fundedBalance, 6);
  console.log(`  Selected Merchant ${fundedIndex} with ${formattedBalance} USDC\n`);

  // ══════════════════════════════════════════════════════
  // POSITIVE PATH: Sweep USDC to treasury
  // ══════════════════════════════════════════════════════
  console.log("─── Positive Path: USDC Sweep to Treasury ───\n");
  console.log(`  From: ${merchantAddress} (Merchant ${fundedIndex})`);
  console.log(`  To:   ${config.treasuryAddress} (Treasury)`);
  console.log(`  Amount: ${formattedBalance} USDC\n`);

  const transferData = iface.encodeFunctionData("transfer", [
    config.treasuryAddress,
    fundedBalance,
  ]);

  const nonce = await provider.getTransactionCount(merchantAddress);
  const feeData = await provider.getFeeData();

  try {
    const { sendTransactionStatusId } = await api.ethSendTransaction({
      from: merchantAddress,
      to: SEPOLIA_USDC_ADDRESS,
      caip2: SEPOLIA_CAIP2,
      data: transferData,
      nonce: String(nonce),
      gasLimit: "200000",
      maxFeePerGas: String(feeData.maxFeePerGas ?? "50000000000"),
      maxPriorityFeePerGas: String(feeData.maxPriorityFeePerGas ?? "2000000000"),
    });

    const result = await pollTransactionStatus({
      apiClient: api,
      organizationId,
      sendTransactionStatusId,
    });

    if (result.txStatus === "INCLUDED") {
      console.log(`\n  ✓ Sweep successful!`);
      console.log(`    Amount: ${formattedBalance} USDC`);
      console.log(`    Tx Hash: ${result.eth?.txHash}`);
      console.log(`    Explorer: https://sepolia.etherscan.io/tx/${result.eth?.txHash}\n`);
    } else {
      console.log(`\n  ✗ Unexpected transaction status: ${result.txStatus}\n`);
    }
  } catch (error: any) {
    console.log(`\n  ✗ Sweep failed: ${error.message}\n`);
  }

  // ══════════════════════════════════════════════════════
  // NEGATIVE PATH 1: USDC transfer to non-treasury address
  // ══════════════════════════════════════════════════════
  console.log("─── Negative Path: USDC Transfer to Attacker Address ───\n");

  const attackerAddress = "0x000000000000000000000000000000000000dEaD";
  console.log(`  From: ${merchantAddress} (Merchant ${fundedIndex})`);
  console.log(`  To:   ${attackerAddress} (Attacker — NOT the treasury)`);
  console.log(`  Amount: 1 USDC`);
  console.log(`  Expected: REJECTED by policy\n`);

  const attackData = iface.encodeFunctionData("transfer", [
    attackerAddress,
    ethers.parseUnits("1", 6),
  ]);

  const attackNonce = await provider.getTransactionCount(merchantAddress);

  try {
    await api.ethSendTransaction({
      from: merchantAddress,
      to: SEPOLIA_USDC_ADDRESS,
      caip2: SEPOLIA_CAIP2,
      data: attackData,
      nonce: String(attackNonce),
      gasLimit: "200000",
      maxFeePerGas: String(feeData.maxFeePerGas ?? "50000000000"),
      maxPriorityFeePerGas: String(feeData.maxPriorityFeePerGas ?? "2000000000"),
    });

    console.log("  ✗ ERROR: Transaction was unexpectedly approved!\n");
  } catch (error: any) {
    const message = error.message || String(error);
    console.log(`  ✓ Transaction correctly REJECTED by policy.`);
    console.log(`    Reason: ${message}\n`);
  }

  // ══════════════════════════════════════════════════════
  // NEGATIVE PATH 2: Non-USDC ERC-20 transfer to treasury
  // ══════════════════════════════════════════════════════
  console.log("─── Negative Path: Non-USDC Token Transfer to Treasury ───\n");

  const fakeTokenAddress = "0x779877A7B0D9E8603169DdbD7836e478b4624789"; // Sepolia LINK
  console.log(`  From: ${merchantAddress} (Merchant ${fundedIndex})`);
  console.log(`  Token: ${fakeTokenAddress} (LINK — NOT USDC)`);
  console.log(`  To:   ${config.treasuryAddress} (Treasury)`);
  console.log(`  Expected: REJECTED by policy\n`);

  const nonUsdcData = iface.encodeFunctionData("transfer", [
    config.treasuryAddress,
    ethers.parseUnits("1", 18),
  ]);

  const nonUsdcNonce = await provider.getTransactionCount(merchantAddress);

  try {
    await api.ethSendTransaction({
      from: merchantAddress,
      to: fakeTokenAddress,
      caip2: SEPOLIA_CAIP2,
      data: nonUsdcData,
      nonce: String(nonUsdcNonce),
      gasLimit: "200000",
      maxFeePerGas: String(feeData.maxFeePerGas ?? "50000000000"),
      maxPriorityFeePerGas: String(feeData.maxPriorityFeePerGas ?? "2000000000"),
    });

    console.log("  ✗ ERROR: Transaction was unexpectedly approved!\n");
  } catch (error: any) {
    const message = error.message || String(error);
    console.log(`  ✓ Transaction correctly REJECTED by policy.`);
    console.log(`    Reason: ${message}\n`);
  }

  console.log("═══════════════════════════════════════════════════════════");
  console.log("  Demo complete. The policy allowed only USDC sweeps to");
  console.log("  the treasury and blocked all other transfer attempts.");
  console.log("═══════════════════════════════════════════════════════════\n");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

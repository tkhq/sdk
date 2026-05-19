import * as fs from "fs";
import * as path from "path";
import { ethers } from "ethers";
import { TurnkeySigner } from "@turnkey/ethers";
import prompts from "prompts";
import { getAutomationClient } from "../turnkey";
import {
  SEPOLIA_USDC_ADDRESS,
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
    throw new Error(`${GENERATED_FILE} not found. Run 'pnpm run-setup' first.`);
  }
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function isPolicyRejection(error: any): boolean {
  const msg = (error.message || String(error)).toLowerCase();
  return (
    msg.includes("policy") ||
    msg.includes("consensus") ||
    msg.includes("denied") ||
    msg.includes("no applicable policy") ||
    msg.includes("sufficient permissions")
  );
}

function extractPolicyReason(error: any): string {
  const msg = error.message || String(error);
  const detailsMatch = msg.match(/Details: \[(.+)\]/);
  if (detailsMatch) {
    try {
      const details = JSON.parse(`[${detailsMatch[1]}]`);
      const eval_ = details[0]?.policyEvaluations?.[0];
      if (eval_) {
        return `Policy "${eval_.policyId}" → ${eval_.outcome} (${details[0].message})`;
      }
    } catch {}
  }
  return msg;
}

function header() {
  console.log();
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║            Payflow Demo — Merchant Sweep Flow           ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log();
}

function divider(title: string) {
  const pad = Math.max(0, 55 - title.length);
  const line = "─".repeat(pad);
  console.log(`\n─── ${title} ${line}\n`);
}

async function main() {
  const config = loadGenerated();
  const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC_URL);
  const usdc = new ethers.Contract(SEPOLIA_USDC_ADDRESS, ERC20_ABI, provider);
  const iface = new ethers.Interface(ERC20_ABI);

  const automationClient = getAutomationClient();
  const organizationId = process.env.ORGANIZATION_ID!;

  // ── Validate credentials match generated config ──
  const envPubKey = process.env.AUTOMATION_API_PUBLIC_KEY;
  if (envPubKey !== config.automationApiPublicKey) {
    console.error("\n  ✗ Credential mismatch detected!");
    console.error(`    .env.local key:        ${envPubKey}`);
    console.error(`    generated.json key:    ${config.automationApiPublicKey}`);
    console.error("\n  Update .env.local with the credentials from payflow.generated.json:");
    console.error(`    AUTOMATION_API_PUBLIC_KEY="${config.automationApiPublicKey}"`);
    console.error(`    AUTOMATION_API_PRIVATE_KEY="${config.automationApiPrivateKey}"`);
    process.exit(1);
  }

  function createSigner(signWith: string) {
    return new TurnkeySigner(
      {
        client: automationClient.apiClient(),
        organizationId,
        signWith,
      },
      provider,
    );
  }

  header();

  // ── Display architecture ──
  console.log("  Your Turnkey Architecture:\n");
  console.log(`    Merchant Wallet:   ${config.merchantWalletId}`);
  for (let i = 0; i < config.merchantAddresses.length; i++) {
    console.log(`      └ Merchant ${i}:   ${config.merchantAddresses[i]}`);
  }
  console.log(`    Treasury Wallet:   ${config.treasuryWalletId}`);
  console.log(`      └ Omnibus:       ${config.treasuryAddress}`);
  console.log(`    Automation User:   ${config.automationUserId}`);
  console.log(`    Sweep Policy:      ${config.policyId}`);

  const merchantAddress = config.merchantAddresses[0]!;

  // ── Check balances ──
  await printBalances();

  async function printBalances() {
    divider("Account Balances");
    for (let i = 0; i < config.merchantAddresses.length; i++) {
      const bal: bigint = await usdc.balanceOf!(config.merchantAddresses[i]);
      const formatted = ethers.formatUnits(bal, 6);
      const status = bal > 0n ? `${formatted} USDC` : "0.0 USDC (empty)";
      console.log(`    Merchant ${i}:  ${status}`);
    }
    const treasuryBal: bigint = await usdc.balanceOf!(config.treasuryAddress);
    const treasuryFormatted = ethers.formatUnits(treasuryBal, 6);
    console.log(`    Treasury:   ${treasuryFormatted} USDC`);
  }

  // ── Interactive menu ──
  let running = true;
  while (running) {
    console.log();
    const { action } = await prompts({
      type: "select",
      name: "action",
      message: "Select a demo scenario",
      choices: [
        {
          title: "✓  Sweep USDC to treasury",
          description: "Transfer USDC from a merchant to the omnibus treasury",
          value: "sweep",
        },
        {
          title: "✗  Send USDC to attacker address",
          description: "Attempt a transfer to an unauthorized address (should be blocked)",
          value: "attack",
        },
        {
          title: "✗  Send non-USDC token to treasury",
          description: "Attempt a LINK transfer to the treasury (should be blocked)",
          value: "wrong-token",
        },
        {
          title: "▶  Run all scenarios",
          description: "Run positive sweep, then both negative paths in sequence",
          value: "all",
        },
        {
          title: "↻  Refresh balances",
          description: "Re-check merchant USDC balances",
          value: "refresh",
        },
        {
          title: "✕  Exit",
          value: "exit",
        },
      ],
    });

    if (!action || action === "exit") {
      running = false;
      continue;
    }

    if (action === "refresh") {
      await printBalances();
      continue;
    }

    const scenarios = action === "all" ? ["sweep", "attack", "wrong-token"] : [action];

    for (const act of scenarios) {
      if (act === "sweep") {
        await runSweep();
      } else if (act === "attack") {
        await runAttackerTransfer();
      } else if (act === "wrong-token") {
        await runWrongToken();
      }
    }

    await printBalances();
  }

  console.log("\n  Done. Thanks for watching the Payflow demo.\n");

  // ── Scenario implementations ──

  async function sweepOne(index: number, balance: bigint) {
    const from = config.merchantAddresses[index]!;
    const amount = ethers.formatUnits(balance, 6);

    console.log(`    From:    Merchant ${index} (${from})`);
    console.log(`    To:      Treasury (${config.treasuryAddress})`);
    console.log(`    Amount:  ${amount} USDC`);
    console.log(`    Signer:  Automation User (non-root)\n`);

    const transferData = iface.encodeFunctionData("transfer", [
      config.treasuryAddress,
      balance,
    ]);

    try {
      const signer = createSigner(from);
      console.log("    Signing via Turnkey policy engine...");
      const tx = await signer.sendTransaction({
        to: SEPOLIA_USDC_ADDRESS,
        data: transferData,
      });

      console.log("    Broadcasting to Sepolia...");
      const receipt = await tx.wait();

      console.log();
      console.log("    ┌─────────────────────────────────────────────┐");
      console.log("    │  ✓  SWEEP SUCCESSFUL                       │");
      console.log("    ├─────────────────────────────────────────────┤");
      console.log(`    │  Amount:  ${amount} USDC`);
      console.log(`    │  Tx Hash: ${receipt!.hash}`);
      console.log(`    │  Explorer: https://sepolia.etherscan.io/tx/${receipt!.hash}`);
      console.log("    └─────────────────────────────────────────────┘");
    } catch (error: any) {
      const msg = error.message || String(error);
      if (isPolicyRejection(error)) {
        console.log(`\n    ✗ Unexpectedly REJECTED by policy: ${msg}`);
      } else {
        console.log(`\n    ✗ Failed: ${msg}`);
      }
    }
  }

  async function runSweep() {
    divider("Positive Path: Sweep All Merchants to Treasury");

    const funded: { index: number; balance: bigint }[] = [];
    for (let i = 0; i < config.merchantAddresses.length; i++) {
      const bal: bigint = await usdc.balanceOf!(config.merchantAddresses[i]);
      if (bal > 0n) {
        funded.push({ index: i, balance: bal });
      }
    }

    if (funded.length === 0) {
      console.log("  ⚠  No merchant accounts have USDC balances.");
      console.log("     Fund an account at https://faucet.circle.com/ first.\n");
      console.log("     Merchant addresses:");
      for (const addr of config.merchantAddresses) {
        console.log(`       ${addr}`);
      }
      return;
    }

    const totalUsdc = ethers.formatUnits(
      funded.reduce((sum, f) => sum + f.balance, 0n),
      6,
    );
    console.log(`    Sweeping ${funded.length} funded account(s) → Treasury`);
    console.log(`    Total: ${totalUsdc} USDC\n`);

    for (const f of funded) {
      await sweepOne(f.index, f.balance);
    }
  }

  async function runAttackerTransfer() {
    divider("Negative Path: USDC to Attacker Address");

    const attackerAddress = "0x000000000000000000000000000000000000dEaD";

    console.log(`    From:     Merchant 0 (${merchantAddress})`);
    console.log(`    To:       ${attackerAddress} (NOT the treasury)`);
    console.log(`    Token:    USDC`);
    console.log(`    Amount:   1 USDC`);
    console.log(`    Signer:   Automation User (non-root)`);
    console.log(`    Expected: REJECTED — recipient is not the treasury\n`);

    const attackData = iface.encodeFunctionData("transfer", [
      attackerAddress,
      ethers.parseUnits("1", 6),
    ]);

    const nonce = await provider.getTransactionCount(merchantAddress);
    const feeData = await provider.getFeeData();

    try {
      console.log("    Submitting to Turnkey policy engine...");
      const signer = createSigner(merchantAddress);
      await signer.signTransaction({
        to: SEPOLIA_USDC_ADDRESS,
        data: attackData,
        nonce,
        gasLimit: 200000n,
        maxFeePerGas: feeData.maxFeePerGas ?? 50000000000n,
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ?? 2000000000n,
        chainId: 11155111n,
        type: 2,
      });

      console.log("\n    ✗ ERROR: Transaction was unexpectedly approved!");
    } catch (error: any) {
      const msg = error.message || String(error);
      if (isPolicyRejection(error)) {
        console.log();
        console.log("    ┌─────────────────────────────────────────────┐");
        console.log("    │  ✓  CORRECTLY BLOCKED BY POLICY             │");
        console.log("    ├─────────────────────────────────────────────┤");
        console.log(`    │  ${extractPolicyReason(error)}`);
        console.log("    └─────────────────────────────────────────────┘");
      } else {
        console.log(`\n    ✗ Failed for unexpected reason: ${msg}`);
      }
    }
  }

  async function runWrongToken() {
    divider("Negative Path: Non-USDC Token to Treasury");

    const fakeTokenAddress = "0x779877A7B0D9E8603169DdbD7836e478b4624789";

    console.log(`    From:     Merchant 0 (${merchantAddress})`);
    console.log(`    To:       Treasury (${config.treasuryAddress})`);
    console.log(`    Token:    LINK at ${fakeTokenAddress} (NOT USDC)`);
    console.log(`    Amount:   1 LINK`);
    console.log(`    Signer:   Automation User (non-root)`);
    console.log(`    Expected: REJECTED — token contract is not USDC\n`);

    const nonUsdcData = iface.encodeFunctionData("transfer", [
      config.treasuryAddress,
      ethers.parseUnits("1", 18),
    ]);

    const nonce = await provider.getTransactionCount(merchantAddress);
    const feeData = await provider.getFeeData();

    try {
      console.log("    Submitting to Turnkey policy engine...");
      const signer = createSigner(merchantAddress);
      await signer.signTransaction({
        to: fakeTokenAddress,
        data: nonUsdcData,
        nonce,
        gasLimit: 200000n,
        maxFeePerGas: feeData.maxFeePerGas ?? 50000000000n,
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ?? 2000000000n,
        chainId: 11155111n,
        type: 2,
      });

      console.log("\n    ✗ ERROR: Transaction was unexpectedly approved!");
    } catch (error: any) {
      const msg = error.message || String(error);
      if (isPolicyRejection(error)) {
        console.log();
        console.log("    ┌─────────────────────────────────────────────┐");
        console.log("    │  ✓  CORRECTLY BLOCKED BY POLICY             │");
        console.log("    ├─────────────────────────────────────────────┤");
        console.log(`    │  ${extractPolicyReason(error)}`);
        console.log("    └─────────────────────────────────────────────┘");
      } else {
        console.log(`\n    ✗ Failed for unexpected reason: ${msg}`);
      }
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

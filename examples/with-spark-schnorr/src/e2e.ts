/**
 * End-to-end Spark flow using Turnkey as the key custodian:
 *
 *   1. DEPOSIT:   Fund a Spark wallet from L1 Bitcoin (regtest)
 *   2. TRANSFER:  Send sats from the Turnkey-backed Spark wallet to another Spark address
 *   3. WITHDRAW:  Cooperative exit back to an L1 Bitcoin address (regtest)
 *
 * All FROST signing is delegated to Turnkey via the SPARK_PREPARE_AND_SIGN activity.
 * The signer never touches private keys — Turnkey generates nonces and signs inside
 * the enclave in a single round trip.
 *
 * Prerequisites:
 *   - bitcoind running in regtest mode
 *   - Spark operator (SO) running on regtest
 *   - Turnkey organization with a Spark wallet created (ADDRESS_FORMAT_SPARK_REGTEST)
 *   - The Spark wallet must have accounts for all 5 key types
 *
 * Required env vars (in .env.local):
 *   BASE_URL, API_PUBLIC_KEY, API_PRIVATE_KEY, ORGANIZATION_ID
 *   TURNKEY_SPARK_ADDRESS           – the Spark wallet address (sp1...)
 *   IDENTITY_PUBLIC_KEY_HEX         – compressed 33-byte identity pubkey
 *   RECEIVER_SPARK_ADDRESS          – destination for the transfer step
 *   WITHDRAW_BTC_ADDRESS            – L1 address for the withdrawal step
 *   BITCOIN_RPC_URL                 – regtest bitcoind RPC (default: http://127.0.0.1:18443)
 *   BITCOIN_RPC_USER                – RPC username (default: "user")
 *   BITCOIN_RPC_PASS                – RPC password (default: "pass")
 *
 * Optional:
 *   DEPOSIT_AMOUNT_SATS             – amount to deposit (default: 100000)
 *   TRANSFER_AMOUNT_SATS            – amount to transfer (default: 50000)
 *   WITHDRAW_AMOUNT_SATS            – amount to withdraw (default: 25000)
 *   SPARK_NETWORK                   – REGTEST (default) or MAINNET
 */

import * as path from "path";
import * as dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { SparkWallet } from "@buildonspark/spark-sdk";
import { Turnkey as TurnkeyServerSDK } from "@turnkey/sdk-server";
import { TurnkeySparkSigner } from "./turnkeySigner";

type SparkNetwork = "MAINNET" | "REGTEST";

// ---------------------------------------------------------------------------
// Bitcoin regtest helpers
// ---------------------------------------------------------------------------

interface BitcoinRpc {
  url: string;
  user: string;
  pass: string;
}

async function bitcoinRpc(
  rpc: BitcoinRpc,
  method: string,
  params: unknown[] = [],
): Promise<unknown> {
  const response = await fetch(rpc.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization:
        "Basic " + Buffer.from(`${rpc.user}:${rpc.pass}`).toString("base64"),
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const data = (await response.json()) as { result: unknown; error?: unknown };
  if (data.error) throw new Error(`bitcoind ${method}: ${JSON.stringify(data.error)}`);
  return data.result;
}

async function mineBlocks(rpc: BitcoinRpc, count: number): Promise<void> {
  const addr = (await bitcoinRpc(rpc, "getnewaddress")) as string;
  await bitcoinRpc(rpc, "generatetoaddress", [count, addr]);
}

async function sendBtc(
  rpc: BitcoinRpc,
  address: string,
  amountBtc: number,
): Promise<string> {
  return (await bitcoinRpc(rpc, "sendtoaddress", [address, amountBtc])) as string;
}

// ---------------------------------------------------------------------------
// Main flow
// ---------------------------------------------------------------------------

async function main() {
  const network = (process.env.SPARK_NETWORK ?? "REGTEST") as SparkNetwork;

  const requiredVars = [
    "API_PUBLIC_KEY",
    "API_PRIVATE_KEY",
    "ORGANIZATION_ID",
    "TURNKEY_SPARK_ADDRESS",
    "IDENTITY_PUBLIC_KEY_HEX",
    "RECEIVER_SPARK_ADDRESS",
    "WITHDRAW_BTC_ADDRESS",
  ] as const;

  for (const v of requiredVars) {
    if (!process.env[v]) throw new Error(`Missing required env var: ${v}`);
  }

  const sparkAddress = process.env.TURNKEY_SPARK_ADDRESS!;
  const identityPublicKeyHex = process.env.IDENTITY_PUBLIC_KEY_HEX!;
  const receiverSparkAddress = process.env.RECEIVER_SPARK_ADDRESS!;
  const withdrawBtcAddress = process.env.WITHDRAW_BTC_ADDRESS!;

  const depositSats = Number(process.env.DEPOSIT_AMOUNT_SATS ?? "100000");
  const transferSats = Number(process.env.TRANSFER_AMOUNT_SATS ?? "50000");
  const withdrawSats = Number(process.env.WITHDRAW_AMOUNT_SATS ?? "25000");

  const btcRpc: BitcoinRpc = {
    url: process.env.BITCOIN_RPC_URL ?? "http://127.0.0.1:18443",
    user: process.env.BITCOIN_RPC_USER ?? "user",
    pass: process.env.BITCOIN_RPC_PASS ?? "pass",
  };

  // ── Initialize ──────────────────────────────────────────────────────────

  const turnkeyClient = new TurnkeyServerSDK({
    apiBaseUrl: process.env.BASE_URL ?? "https://api.turnkey.com",
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    defaultOrganizationId: process.env.ORGANIZATION_ID!,
  });

  const signer = new TurnkeySparkSigner(
    turnkeyClient,
    sparkAddress,
    identityPublicKeyHex,
  );

  console.log(`\nInitializing SparkWallet on ${network}...`);

  // SparkWallet (not IssuerSparkWallet) for Bitcoin L1 operations.
  // The signer cast is safe: unimplemented methods throw at call time.
  const { wallet } = await SparkWallet.initialize({
    signer: signer as any,
    options: { network },
  });

  console.log(`Authenticated to Spark SO`);

  const walletSparkAddress = await wallet.getSparkAddress();
  console.log(`Spark address: ${walletSparkAddress}`);

  // ── Step 1: DEPOSIT (L1 -> Spark) ───────────────────────────────────────

  console.log(`\n== Step 1: DEPOSIT ${depositSats} sats from L1 regtest ==`);

  // 1a. Get a single-use deposit address from Spark
  const depositAddress = await wallet.getSingleUseDepositAddress();
  console.log(`  Deposit P2TR address: ${depositAddress}`);

  // 1b. Send BTC to the deposit address via regtest
  const depositBtc = depositSats / 1e8;
  console.log(`  Sending ${depositBtc} BTC via regtest...`);
  const depositTxid = await sendBtc(btcRpc, depositAddress, depositBtc);
  console.log(`  L1 txid: ${depositTxid}`);

  // 1c. Mine a block to confirm
  console.log(`  Mining 1 block...`);
  await mineBlocks(btcRpc, 1);

  // 1d. Claim the deposit into Spark
  // This triggers FROST signing via PREPARE_AND_SIGN to claim the UTXO.
  console.log(`  Claiming deposit...`);
  await wallet.claimDeposit(depositTxid);
  console.log(`  Deposit claimed`);

  // 1e. Check balance
  const balanceAfterDeposit = await wallet.getBalance();
  console.log(
    `  Balance: ${balanceAfterDeposit.satsBalance?.available ?? 0} sats available`,
  );

  // ── Step 2: TRANSFER (Spark -> Spark) ───────────────────────────────────

  console.log(
    `\n== Step 2: TRANSFER ${transferSats} sats to ${receiverSparkAddress} ==`,
  );

  // This triggers multiple FROST signing operations via PREPARE_AND_SIGN:
  //   - subtractSplitAndEncrypt for key tweaking (deferred into signFrost)
  //   - signFrost for CPFP refund tx
  //   - signFrost for direct refund tx
  //   - signFrost for directFromCpfp refund tx
  //   - aggregateFrost to combine partials
  const transferResult = await wallet.transfer({
    amountSats: transferSats,
    receiverSparkAddress,
  });
  console.log(`  Transfer initiated`);
  console.log(`  Result: ${JSON.stringify(transferResult)}`);

  // Check balance after transfer
  const balanceAfterTransfer = await wallet.getBalance();
  console.log(
    `  Balance: ${balanceAfterTransfer.satsBalance?.available ?? 0} sats available`,
  );

  // ── Step 3: WITHDRAW (Spark -> L1) ──────────────────────────────────────

  console.log(
    `\n== Step 3: WITHDRAW ${withdrawSats} sats to ${withdrawBtcAddress} ==`,
  );

  // Cooperative exit — sends Spark leaves to the SSP which broadcasts an
  // L1 transaction paying the withdrawal address.
  const withdrawResult = await wallet.withdraw({
    onchainAddress: withdrawBtcAddress,
    exitSpeed: "FAST",
  });
  console.log(`  Withdrawal initiated`);
  console.log(`  Result: ${JSON.stringify(withdrawResult)}`);

  // Mine blocks to confirm the L1 withdrawal transaction
  console.log(`  Mining 6 blocks for confirmation...`);
  await mineBlocks(btcRpc, 6);

  // Final balance
  const finalBalance = await wallet.getBalance();
  console.log(`\n== Final balance ==`);
  console.log(
    `  Available: ${finalBalance.satsBalance?.available ?? 0} sats`,
  );
  console.log(`  Owned: ${finalBalance.satsBalance?.owned ?? 0} sats`);

  console.log(`\nE2E flow complete.`);
  wallet.cleanupConnections();
}

main().catch((err) => {
  console.error("\nError:", err);
  process.exit(1);
});

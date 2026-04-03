import * as path from "path";
import * as dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import {
  DefaultSparkSigner,
  SparkWallet,
  WalletConfig,
  getSigHashFromTx,
  getP2TRAddressFromPublicKey,
  Network,
} from "@buildonspark/spark-sdk";
import { Transaction, p2tr, TEST_NETWORK } from "@scure/btc-signer";
import { Turnkey as TurnkeyServerSDK } from "@turnkey/sdk-server";

type SparkNetwork = "MAINNET" | "REGTEST";

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function hex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("hex");
}

// ---------------------------------------------------------------------------
// 1. Initialize DefaultSparkSigner from mnemonic (low-level access to keys)
// ---------------------------------------------------------------------------

async function initSigner(mnemonic: string): Promise<DefaultSparkSigner> {
  const signer = new DefaultSparkSigner();
  const seed = await signer.mnemonicToSeed(mnemonic);
  await signer.createSparkWalletFromSeed(seed);
  return signer;
}

// ---------------------------------------------------------------------------
// 2. Raw Schnorr signing comparison
//    Signs an arbitrary payload with the Spark identity key (Schnorr) and,
//    if Turnkey credentials are configured, compares against Turnkey's output.
// ---------------------------------------------------------------------------

async function compareSchnorrSignatures(
  signer: DefaultSparkSigner,
  payload: Uint8Array
): Promise<void> {
  console.log("\n── Schnorr signature (identity key) ──────────────────────────");
  console.log(`Payload (hex): ${hex(payload)}`);

  const sparkSig = await signer.signSchnorrWithIdentityKey(payload);
  console.log(`Spark SDK sig: ${hex(sparkSig)}`);

  const turnkeyAddress = process.env.TURNKEY_IDENTITY_ADDRESS;
  if (
    !process.env.API_PRIVATE_KEY ||
    !process.env.API_PUBLIC_KEY ||
    !process.env.ORGANIZATION_ID ||
    !turnkeyAddress
  ) {
    console.log(
      "\nSkipping Turnkey comparison – set TURNKEY_IDENTITY_ADDRESS and Turnkey credentials in .env.local to enable."
    );
    return;
  }

  const client = new TurnkeyServerSDK({
    apiBaseUrl: process.env.BASE_URL ?? "https://api.turnkey.com",
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    defaultOrganizationId: process.env.ORGANIZATION_ID!,
  });

  const { r, s } = await client.apiClient().signRawPayload({
    signWith: turnkeyAddress,
    encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
    hashFunction: "HASH_FUNCTION_NO_OP",
    payload: hex(payload),
  });

  const turnkeySig = (r + s).toLowerCase();
  console.log(`Turnkey sig:   ${turnkeySig}`);

  const match =
    hex(sparkSig).toLowerCase() === turnkeySig;
  console.log(`\nSignatures match: ${match ? "✅  YES" : "❌  NO"}`);
}

// ---------------------------------------------------------------------------
// 3. Bitcoin P2TR transaction signing (deposit key) on regtest
//    Uses @scure/btc-signer + Spark SDK's signTransactionIndex.
//    Requires UTXO_TXID, UTXO_VOUT, UTXO_VALUE, DESTINATION_ADDRESS in env.
// ---------------------------------------------------------------------------

async function signBitcoinTransaction(
  signer: DefaultSparkSigner,
  depositPubKey: Uint8Array
): Promise<string> {
  const txid = process.env.UTXO_TXID!;
  const vout = parseInt(process.env.UTXO_VOUT!, 10);
  const value = BigInt(process.env.UTXO_VALUE!);
  const destination = process.env.DESTINATION_ADDRESS!;
  const fee = BigInt(process.env.FEE_SATS ?? "300");

  // x-only (32-byte) pubkey for taproot
  const xOnly =
    depositPubKey.length === 33 ? depositPubKey.slice(1) : depositPubKey;

  const payment = p2tr(xOnly, undefined, TEST_NETWORK);

  const tx = new Transaction();
  tx.addInput({
    txid,
    index: vout,
    witnessUtxo: {
      script: payment.script,
      amount: value,
    },
    tapInternalKey: xOnly,
  });

  tx.addOutputAddress(destination, value - fee, TEST_NETWORK);

  // Compute the sighash before signing so we can log / compare it
  const prevOut = {
    script: payment.script,
    amount: value,
  };
  const sighash = getSigHashFromTx(tx, 0, prevOut);
  console.log("\n── Bitcoin P2TR transaction signing (deposit key) ────────────");
  console.log(`Sighash (hex): ${hex(sighash)}`);

  // Sign in place using the Spark SDK (Schnorr, deposit key)
  signer.signTransactionIndex(tx, 0, depositPubKey);

  tx.finalize();
  const txHex = Buffer.from(tx.extract()).toString("hex");
  console.log(`\nSigned tx hex:\n  ${txHex}`);
  console.log(
    "\nTo broadcast on regtest:\n  bitcoin-cli -regtest sendrawtransaction <hex>"
  );
  return txHex;
}

// ---------------------------------------------------------------------------
// 4. Full Spark wallet on REGTEST – tests that the SDK signs correctly
//    enough for the Spark network to accept the transaction
// ---------------------------------------------------------------------------

async function testSparkWallet(
  mnemonic: string,
  network: SparkNetwork
): Promise<void> {
  console.log(`\n── SparkWallet on ${network} ──────────────────────────────────`);

  const walletOptions =
    network === "MAINNET" ? WalletConfig.MAINNET : WalletConfig.REGTEST;
  const { wallet, mnemonic: generatedMnemonic } = await SparkWallet.initialize({
    mnemonicOrSeed: mnemonic,
    options: walletOptions,
  });

  if (generatedMnemonic) {
    console.log("New wallet generated – save this mnemonic:");
    console.log(`  ${generatedMnemonic}`);
    console.log("Set MNEMONIC in .env.local to reuse it.\n");
  }

  const sparkAddress = await wallet.getSparkAddress();
  const identityPubKey = wallet.getIdentityPublicKey();
  const { balance } = await wallet.getBalance();

  console.log(`Spark address:       ${sparkAddress}`);
  console.log(`Identity public key: ${identityPubKey}`);
  console.log(`Balance:             ${balance.toLocaleString()} sats`);

  const receiver = process.env.RECEIVER_SPARK_ADDRESS;
  if (receiver) {
    const amountSats = parseInt(process.env.TRANSFER_AMOUNT_SATS ?? "1000", 10);
    console.log(`\nSending ${amountSats} sats to ${receiver} ...`);
    const result = await wallet.transfer({ receiverSparkAddress: receiver, amountSats });
    console.log(`Transfer complete: ${JSON.stringify(result)}`);
  } else {
    console.log(
      "\nSet RECEIVER_SPARK_ADDRESS (and optionally TRANSFER_AMOUNT_SATS) to test a Spark transfer."
    );
  }

  wallet.cleanupConnections();
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const network = (process.env.SPARK_NETWORK ?? "REGTEST") as SparkNetwork;
  let mnemonic = process.env.MNEMONIC?.trim();

  // Generate a fresh mnemonic if none provided
  if (!mnemonic) {
    const tmpSigner = new DefaultSparkSigner();
    mnemonic = await tmpSigner.generateMnemonic();
    console.log("No MNEMONIC set – generated a new one:");
    console.log(`  ${mnemonic}`);
    console.log("Add it to .env.local as MNEMONIC to reuse this wallet.\n");
  }

  console.log(`\nInitializing Spark signer on ${network}...`);
  const signer = await initSigner(mnemonic);

  const identityPubKey = await signer.getIdentityPublicKey();
  const depositPubKey = await signer.getDepositSigningKey();
  const sparkNetwork: Network =
    network === "MAINNET" ? Network.MAINNET : Network.REGTEST;
  const btcAddress = getP2TRAddressFromPublicKey(depositPubKey, sparkNetwork);

  console.log(`\nIdentity public key: ${hex(identityPubKey)}`);
  console.log(`Deposit public key:  ${hex(depositPubKey)}`);
  console.log(`P2TR deposit addr:   ${btcAddress}`);

  // Raw Schnorr comparison (identity key)
  const testPayload = Buffer.from(
    "spark-schnorr-test:" + Date.now().toString()
  );
  await compareSchnorrSignatures(signer, testPayload);

  // Bitcoin transaction signing (deposit key) – only when UTXO env vars are set
  if (
    process.env.UTXO_TXID &&
    process.env.UTXO_VOUT &&
    process.env.UTXO_VALUE &&
    process.env.DESTINATION_ADDRESS
  ) {
    await signBitcoinTransaction(signer, depositPubKey);
  } else {
    console.log(
      "\nSkipping Bitcoin tx signing – set UTXO_TXID, UTXO_VOUT, UTXO_VALUE, DESTINATION_ADDRESS to enable."
    );
  }

  // Full Spark wallet test on regtest
  await testSparkWallet(mnemonic, network);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

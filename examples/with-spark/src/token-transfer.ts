/**
 * Token operations: CREATE → MINT → TRANSFER
 *
 * Uses IssuerSparkWallet with ECDSA signing via Turnkey's SignRawPayload.
 * No FROST signing or custom orchestration needed — the SDK handles
 * everything internally.
 *
 * Required env vars:
 *   API_PUBLIC_KEY, API_PRIVATE_KEY, ORGANIZATION_ID
 *   TURNKEY_SPARK_ADDRESS, IDENTITY_PUBLIC_KEY_HEX
 *   RECEIVER_SPARK_ADDRESS
 */

import { initIssuerWallet, requireEnv, env } from "./init";

async function main() {
  const receiverSparkAddress = requireEnv("RECEIVER_SPARK_ADDRESS");
  const tokenName = env("TOKEN_NAME", "TurnkeyTestToken");
  const tokenTicker = env("TOKEN_TICKER", "TKT");
  const tokenDecimals = Number(env("TOKEN_DECIMALS", "0"));
  const maxSupply = BigInt(env("TOKEN_SUPPLY", "1000000"));
  const mintAmount = BigInt(env("MINT_AMOUNT", String(maxSupply)));
  const transferAmount = BigInt(env("TRANSFER_AMOUNT", String(mintAmount)));

  const { wallet, signer } = await initIssuerWallet();
  console.log(`Authenticated to Spark SO`);

  const sparkAddress = await wallet.getSparkAddress();
  const identityPubKey = await signer.getIdentityPublicKey();
  console.log(`Spark address:       ${sparkAddress}`);
  console.log(
    `Identity public key: ${Buffer.from(identityPubKey).toString("hex")}`,
  );

  // CREATE
  console.log(`\n── CREATE token (${tokenName} / ${tokenTicker}) ──`);
  await wallet.createToken({
    tokenName,
    tokenTicker,
    decimals: tokenDecimals,
    maxSupply,
    isFreezable: false,
  });
  const tokenIdentifier = await wallet.getIssuerTokenIdentifier();
  if (!tokenIdentifier) throw new Error("No token identifier after creation");
  console.log(`  Token: ${tokenIdentifier}`);

  // MINT
  console.log(`\n── MINT ${mintAmount.toLocaleString()} tokens ──`);
  const mintTxId = await wallet.mintTokens(mintAmount);
  console.log(`  Tx: ${mintTxId}`);

  // TRANSFER
  console.log(
    `\n── TRANSFER ${transferAmount.toLocaleString()} tokens → ${receiverSparkAddress} ──`,
  );
  const transferTxId = await wallet.transferTokens({
    tokenIdentifier,
    tokenAmount: transferAmount,
    receiverSparkAddress,
  });
  console.log(`  Tx: ${transferTxId}`);

  const { tokenTransactionsWithStatus } = await wallet.queryTokenTransactions({
    tokenTransactionHashes: [transferTxId],
  });
  if (tokenTransactionsWithStatus.length > 0) {
    console.log(`  Status: ${tokenTransactionsWithStatus[0]!.status}`);
  }

  console.log(`\nDone.`);
  wallet.cleanupConnections();
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});

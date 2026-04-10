/**
 * Mints a new Spark token using Turnkey as the key custodian, then
 * transfers the minted tokens to a receiver address.
 *
 * Flow:
 *   1. Authenticate to SO (Turnkey signs the challenge via ECDSA/Schnorr)
 *   2. CREATE transaction — announces the token (name, ticker, supply)
 *   3. MINT transaction  — issues tokens to the issuer's own address
 *   4. TRANSFER transaction — sends tokens to RECEIVER_SPARK_ADDRESS
 *
 * IssuerSparkWallet handles ALL transaction construction internally:
 *   - Correct version numbers
 *   - Fetching SO operator public keys
 *   - Protobuf serialization / expiry time
 *   - Hashing (hashPartialTokenTransaction)
 *   - Broadcasting via gRPC
 *
 * Required env vars (in .env.local):
 *   BASE_URL, API_PUBLIC_KEY, API_PRIVATE_KEY, ORGANIZATION_ID
 *   TURNKEY_IDENTITY_ADDRESS, IDENTITY_PUBLIC_KEY_HEX
 *   RECEIVER_SPARK_ADDRESS
 *   SPARK_NETWORK   – REGTEST (default) or MAINNET
 *
 * Optional:
 *   TOKEN_NAME      – default "TurnkeyTestToken"
 *   TOKEN_TICKER    – default "TKT"
 *   TOKEN_DECIMALS  – default 0
 *   TOKEN_SUPPLY    – total max supply to create (default 1000000)
 *   MINT_AMOUNT     – how many tokens to mint (default TOKEN_SUPPLY)
 *   TRANSFER_AMOUNT – how many to transfer (default MINT_AMOUNT)
 */

import * as path from "path";
import * as dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { IssuerSparkWallet } from "@buildonspark/issuer-sdk";
import { Turnkey as TurnkeyServerSDK } from "@turnkey/sdk-server";
import { TurnkeySparkSigner } from "./turnkeySigner";

type SparkNetwork = "MAINNET" | "REGTEST";

async function main() {
  const network = (process.env.SPARK_NETWORK ?? "REGTEST") as SparkNetwork;

  const requiredVars = [
    "API_PUBLIC_KEY",
    "API_PRIVATE_KEY",
    "ORGANIZATION_ID",
    "TURNKEY_IDENTITY_ADDRESS",
    "IDENTITY_PUBLIC_KEY_HEX",
    "RECEIVER_SPARK_ADDRESS",
  ];

  for (const v of requiredVars) {
    if (!process.env[v]) throw new Error(`Missing required env var: ${v}`);
  }

  const tokenName = process.env.TOKEN_NAME ?? "TurnkeyTestToken";
  const tokenTicker = process.env.TOKEN_TICKER ?? "TKT";
  const tokenDecimals = Number(process.env.TOKEN_DECIMALS ?? "0");
  const maxSupply = BigInt(process.env.TOKEN_SUPPLY ?? "1000000");
  const mintAmount = BigInt(process.env.MINT_AMOUNT ?? String(maxSupply));
  const transferAmount = BigInt(
    process.env.TRANSFER_AMOUNT ?? String(mintAmount),
  );
  const receiverSparkAddress = process.env.RECEIVER_SPARK_ADDRESS!;

  // Initialize Turnkey client
  const turnkeyClient = new TurnkeyServerSDK({
    apiBaseUrl: process.env.BASE_URL ?? "https://api.turnkey.com",
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    defaultOrganizationId: process.env.ORGANIZATION_ID!,
  });

  // Create the Turnkey-backed signer
  const signer = new TurnkeySparkSigner(
    turnkeyClient,
    process.env.TURNKEY_IDENTITY_ADDRESS!,
    process.env.IDENTITY_PUBLIC_KEY_HEX!,
  );

  // Initialize IssuerSparkWallet with Turnkey signer.
  // Cast to `any` is safe: the mismatched methods (subtractAndSplitSecretWithProofsGivenDerivations,
  // etc.) are all notImplemented() stubs that are never called in the token-only flow.
  console.log(`\nInitializing IssuerSparkWallet on ${network}...`);

  const { wallet } = await IssuerSparkWallet.initialize({
    signer: signer as any,
    options: {
      network,
      signerWithPreExistingKeys: true,
      tokenSignatures: "SCHNORR",
    },
  });

  console.log(`✅ Authenticated to Spark SO`);

  const sparkAddress = await wallet.getSparkAddress();
  const identityPubKey = await signer.getIdentityPublicKey();
  console.log(`\nSpark address:       ${sparkAddress}`);
  console.log(
    `Identity public key: ${Buffer.from(identityPubKey).toString("hex")}`,
  );

  // Step 1: CREATE token
  console.log(`\n── Step 1: CREATE token ────────────────────────────────────`);
  console.log(`  Name:       ${tokenName}`);
  console.log(`  Ticker:     ${tokenTicker}`);
  console.log(`  Decimals:   ${tokenDecimals}`);
  console.log(`  Max supply: ${maxSupply.toLocaleString()}`);

  const createResult = await wallet.createToken({
    tokenName,
    tokenTicker,
    decimals: tokenDecimals,
    maxSupply,
    isFreezable: false,
  });
  console.log(`✅ Token created`);
  console.log(`   Result: ${JSON.stringify(createResult)}`);

  // Get the token identifier (set by the SDK after creation)
  const tokenIdentifier = await wallet.getIssuerTokenIdentifier();
  if (!tokenIdentifier) {
    throw new Error("Could not retrieve token identifier after creation");
  }
  console.log(`   Token identifier: ${tokenIdentifier}`);

  // Step 2: MINT tokens
  console.log(
    `\n── Step 2: MINT ${mintAmount.toLocaleString()} tokens ────────────────────────────`,
  );

  const mintTxId = await wallet.mintTokens(mintAmount);
  console.log(`✅ Tokens minted`);
  console.log(`   Tx ID: ${mintTxId}`);

  // Check balance after mint
  const { tokenBalances } = await wallet.getBalance();
  for (const [tokenId, info] of tokenBalances) {
    console.log(
      `   Balance: ${info.ownedBalance} ${info.tokenMetadata?.tokenTicker ?? tokenId}`,
    );
  }

  // Step 3: TRANSFER tokens
  console.log(
    `\n── Step 3: TRANSFER ${transferAmount.toLocaleString()} tokens ────────────────────`,
  );
  console.log(`   To: ${receiverSparkAddress}`);

  const transferTxId = await wallet.transferTokens({
    tokenIdentifier,
    tokenAmount: transferAmount,
    receiverSparkAddress,
  });
  console.log(`✅ Transfer broadcast`);
  console.log(`   Tx ID: ${transferTxId}`);

  // Check transaction status
  const { tokenTransactionsWithStatus } = await wallet.queryTokenTransactions({
    tokenTransactionHashes: [transferTxId],
  });
  if (tokenTransactionsWithStatus.length > 0) {
    console.log(`   Status: ${tokenTransactionsWithStatus[0]!.status}`);
  }

  // Final balance
  const finalBalance = await wallet.getBalance();
  console.log(`\n── Final balances ─────────────────────────────────────────`);
  for (const [tokenId, info] of finalBalance.tokenBalances) {
    console.log(
      `   ${info.tokenMetadata?.tokenTicker ?? tokenId}: ${info.ownedBalance}`,
    );
  }

  console.log(`\n✅ Token operations succeeded with Turnkey signing!\n`);
  wallet.cleanupConnections();
}

main().catch((err) => {
  console.error("\n❌ Error:", err);
  process.exit(1);
});

import * as dotenv from "dotenv";
import * as path from "path";
import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
import { Ed25519PublicKey } from "@mysten/sui/keypairs/ed25519";
import { messageWithIntent } from "@mysten/sui/cryptography";
import { Turnkey } from "@turnkey/sdk-server";
import { blake2b } from "@noble/hashes/blake2b";
import { bytesToHex } from "@noble/hashes/utils";
import prompts from "prompts";
import { USDC_COIN_TYPE, USDC_DECIMALS } from "./usdc";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

function toSerializedSignature({
  signature,
  pubKey,
}: {
  signature: Uint8Array;
  pubKey: Ed25519PublicKey;
}): string {
  const scheme = new Uint8Array([0x00]); // ED25519 flag
  const pubKeyBytes = pubKey.toRawBytes();
  const serialized = new Uint8Array(
    scheme.length + signature.length + pubKeyBytes.length
  );
  serialized.set(scheme, 0);
  serialized.set(signature, scheme.length);
  serialized.set(pubKeyBytes, scheme.length + signature.length);
  return Buffer.from(serialized).toString("base64");
}

async function main() {
  const organizationId = process.env.ORGANIZATION_ID!;
  const turnkeyClient = new Turnkey({
    apiBaseUrl: process.env.BASE_URL || "https://api.turnkey.com",
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    defaultOrganizationId: organizationId,
  });

  const suiAddress = process.env.SUI_ADDRESS!;
  const suiPublicKeyHex = process.env.SUI_PUBLIC_KEY!;

  if (!suiAddress || !suiPublicKeyHex) {
    throw new Error(
      "Please set your SUI_ADDRESS and SUI_PUBLIC_KEY in the .env.local file."
    );
  }

  console.log(`Using Sui address: ${suiAddress}`);

  const publicKey = new Ed25519PublicKey(Buffer.from(suiPublicKeyHex, "hex"));
  if (publicKey.toSuiAddress() !== suiAddress) {
    throw new Error("SUI_PUBLIC_KEY does not match SUI_ADDRESS");
  }

  const provider = new SuiClient({ url: getFullnodeUrl("testnet") });

  // Check if account exists and has SUI for gas
  try {
    const suiCoins = await provider.getCoins({
      owner: suiAddress,
      coinType: "0x2::sui::SUI",
    });

    if (!suiCoins.data.length) {
      console.log(
        `Your account has no SUI for gas. Please fund your address ${suiAddress} to proceed.`
      );
      process.exit(1);
    }

    console.log(
      `SUI balance available for gas: ${suiCoins.data.length} coin(s)`
    );
  } catch (error) {
    console.log(
      `Error checking account. Please fund your address ${suiAddress} to proceed.`
    );
    process.exit(1);
  }

  // Check USDC balance
  const usdcCoins = await provider.getCoins({
    owner: suiAddress,
    coinType: USDC_COIN_TYPE,
  });

  if (!usdcCoins.data.length) {
    console.log(
      `\nYour account has no USDC. Please acquire USDC at ${suiAddress} to proceed.`
    );
    process.exit(1);
  }

  // Calculate total USDC balance
  const totalUsdcBalance = usdcCoins.data.reduce(
    (sum, coin) => sum + BigInt(coin.balance),
    0n
  );
  console.log(
    `\nTotal USDC balance: ${Number(totalUsdcBalance) / 10 ** USDC_DECIMALS} USDC (${totalUsdcBalance} base units)`
  );

  console.log("\nPreparing to send USDC...");

  // Get recipient address and amount
  const { recipientAddress, usdcAmount } = await prompts([
    {
      type: "text",
      name: "recipientAddress",
      message: "Recipient address:",
      initial: "<recipient_sui_address>",
    },
    {
      type: "text",
      name: "usdcAmount",
      message: "Amount of USDC to send (in base units):",
      initial: "100",
    },
  ]);

  const amount = BigInt(usdcAmount);

  // Validate amount
  if (amount > totalUsdcBalance) {
    console.error(
      `\nInsufficient USDC balance. You have ${totalUsdcBalance} base units but trying to send ${amount} base units.`
    );
    process.exit(1);
  }

  console.log(
    `\nSending ${Number(amount) / 10 ** USDC_DECIMALS} USDC (${amount} base units) to ${recipientAddress}`
  );

  // Build the transaction
  const tx = new Transaction();
  tx.setSender(suiAddress);
  tx.setGasPrice(await provider.getReferenceGasPrice());
  tx.setGasBudget(10_000_000n); // Higher gas budget for coin operations

  // Get SUI coins for gas payment
  const suiCoinsForGas = await provider.getCoins({
    owner: suiAddress,
    coinType: "0x2::sui::SUI",
  });

  if (!suiCoinsForGas.data.length) {
    throw new Error("No SUI coins available for gas");
  }

  // Set gas payment (using a separate SUI coin from the USDC transfer)
  tx.setGasPayment([
    {
      objectId: suiCoinsForGas.data[0]!.coinObjectId,
      version: suiCoinsForGas.data[0]!.version,
      digest: suiCoinsForGas.data[0]!.digest,
    },
  ]);

  // Merge all USDC coins if there are multiple
  if (usdcCoins.data.length > 1) {
    const primaryCoin = usdcCoins.data[0]!;
    const coinsToMerge = usdcCoins.data
      .slice(1)
      .map((coin) => tx.object(coin.coinObjectId));
    tx.mergeCoins(tx.object(primaryCoin.coinObjectId), coinsToMerge);
  }

  // Split the exact amount to send
  const primaryUsdcCoin = tx.object(usdcCoins.data[0]!.coinObjectId);
  const coinToSend = tx.splitCoins(primaryUsdcCoin, [amount]);

  // Transfer the split coin via Move call to 0x2::transfer::public_transfer
  tx.moveCall({
    target: "0x2::transfer::public_transfer",
    typeArguments: [`0x2::coin::Coin<${USDC_COIN_TYPE}>`],
    arguments: [coinToSend, tx.pure.address(recipientAddress)],
  });

  // Build the transaction bytes
  const txBytes = await tx.build({ client: provider });
  console.log("Transaction built successfully", txBytes);
  console.log("Transaction built successfully hex", bytesToHex(txBytes));

  const serializedTx = await tx.prepareForSerialization({ client: provider });
  console.log("Serialized transaction:", serializedTx);

  const txJson = await tx.toJSON();
  console.log("Transaction JSON:", txJson);

  // Create the signing message
  const intentMsg = messageWithIntent("TransactionData", txBytes);
  console.log("Signing message:", intentMsg);
  console.log("Signing message hex:", bytesToHex(intentMsg));

  const digest = blake2b(intentMsg, { dkLen: 32 });

  console.log("Signing message hex:", bytesToHex(digest));

  // Sign the payload using Turnkey with HASH_FUNCTION_NOT_APPLICABLE
  // Note: unlike ECDSA, EdDSA's API does not support signing raw digests (see RFC 8032).
  // Turnkey's signer requires an explicit value to be passed here to minimize ambiguity.
  const txSignResult = await turnkeyClient.apiClient().signRawPayload({
    signWith: suiAddress,
    payload: bytesToHex(digest),
    encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
    hashFunction: "HASH_FUNCTION_NOT_APPLICABLE",
  });

  // Extract r and s from the result
  const { r, s } = txSignResult;

  // Ensure r and s are 64 hex characters (32 bytes)
  const rHex = r.padStart(64, "0");
  const sHex = s.padStart(64, "0");

  // Concatenate r and s to form the signature
  const txSignatureHex = rHex + sHex;

  // Validate signature length
  if (txSignatureHex.length !== 128) {
    throw new Error(
      "Invalid signature length for Ed25519. Expected 128 hex characters."
    );
  }

  const signature = Buffer.from(txSignatureHex, "hex");
  const serialized = toSerializedSignature({ signature, pubKey: publicKey });

  // Submit the transaction
  console.log("\nSubmitting transaction...");
  const result = await provider.executeTransactionBlock({
    transactionBlock: Buffer.from(txBytes).toString("base64"),
    signature: serialized,
    requestType: "WaitForEffectsCert",
    options: { showEffects: true },
  });

  console.log("\nTransaction Digest:", result.digest);
  console.log(
    `View on explorer: https://suiscan.xyz/testnet/tx/${result.digest}`
  );

  // Check transaction status
  if (result.effects?.status?.status === "success") {
    console.log("Transaction confirmed successfully!");
  } else {
    console.log("Transaction status:", result.effects?.status);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

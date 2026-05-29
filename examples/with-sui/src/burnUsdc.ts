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
  const usdcTreasuryCapId = process.env.USDC_TREASURY_CAP_ID;

  if (!suiAddress || !suiPublicKeyHex) {
    throw new Error(
      "Please set your SUI_ADDRESS and SUI_PUBLIC_KEY in the .env.local file."
    );
  }

  if (!usdcTreasuryCapId) {
    throw new Error(
      "Please set USDC_TREASURY_CAP_ID in .env.local. This must reference the TreasuryCap<USDC> object you control."
    );
  }

  console.log(`Using Sui address: ${suiAddress}`);
  console.log(`Using TreasuryCap object: ${usdcTreasuryCapId}`);

  const publicKey = new Ed25519PublicKey(Buffer.from(suiPublicKeyHex, "hex"));
  if (publicKey.toSuiAddress() !== suiAddress) {
    throw new Error("SUI_PUBLIC_KEY does not match SUI_ADDRESS");
  }

  const provider = new SuiClient({ url: getFullnodeUrl("testnet") });

  // Fetch USDC coins to determine available balance for burning.
  console.log("\nFetching USDC coin objects to burn...");
  const usdcCoins = await provider.getCoins({
    owner: suiAddress,
    coinType: USDC_COIN_TYPE,
  });

  if (!usdcCoins.data.length) {
    console.log(
      `Your account ${suiAddress} has no USDC to burn. Mint or receive USDC before running this script.`
    );
    process.exit(1);
  }

  const totalUsdcBalance = usdcCoins.data.reduce(
    (sum, coin) => sum + BigInt(coin.balance),
    0n
  );
  console.log(
    `Total USDC balance: ${Number(totalUsdcBalance) / 10 ** USDC_DECIMALS} USDC (${totalUsdcBalance} base units)`
  );

  const { usdcAmount } = await prompts({
    type: "text",
    name: "usdcAmount",
    message: "Amount of USDC to burn (in base units):",
    initial: "1000000",
  });

  if (!usdcAmount || usdcAmount.trim() === "") {
    throw new Error("USDC burn amount is required.");
  }

  const amount = BigInt(usdcAmount.trim());

  if (amount <= 0n) {
    throw new Error("Burn amount must be greater than zero.");
  }

  if (amount > totalUsdcBalance) {
    console.error(
      `\nInsufficient USDC balance. You have ${totalUsdcBalance} base units but tried to burn ${amount} base units.`
    );
    process.exit(1);
  }

  console.log(
    `\nBurning ${Number(amount) / 10 ** USDC_DECIMALS} USDC (${amount} base units) from ${suiAddress}`
  );

  const tx = new Transaction();
  tx.setSender(suiAddress);
  tx.setGasPrice(await provider.getReferenceGasPrice());
  tx.setGasBudget(10_000_000n);

  const suiCoinsForGas = await provider.getCoins({
    owner: suiAddress,
    coinType: "0x2::sui::SUI",
  });

  if (!suiCoinsForGas.data.length) {
    throw new Error("No SUI coins available for gas");
  }

  tx.setGasPayment([
    {
      objectId: suiCoinsForGas.data[0]!.coinObjectId,
      version: suiCoinsForGas.data[0]!.version,
      digest: suiCoinsForGas.data[0]!.digest,
    },
  ]);

  if (usdcCoins.data.length > 1) {
    const primaryCoin = usdcCoins.data[0]!;
    const coinsToMerge = usdcCoins.data
      .slice(1)
      .map((coin) => tx.object(coin.coinObjectId));
    tx.mergeCoins(tx.object(primaryCoin.coinObjectId), coinsToMerge);
  }

  const primaryUsdcCoin = tx.object(usdcCoins.data[0]!.coinObjectId);
  const coinToBurn = tx.splitCoins(primaryUsdcCoin, [amount]);

  tx.moveCall({
    target: "0x2::coin::burn",
    arguments: [tx.object(usdcTreasuryCapId), coinToBurn],
    typeArguments: [USDC_COIN_TYPE],
  });

  const txBytes = await tx.build({ client: provider });
  console.log("Transaction built successfully", txBytes);
  console.log("Transaction built successfully hex", bytesToHex(txBytes));

  const serializedTx = await tx.prepareForSerialization({ client: provider });
  console.log("Serialized transaction:", serializedTx);

  const txJson = await tx.toJSON();
  console.log("Transaction JSON:", txJson);

  const intentMsg = messageWithIntent("TransactionData", txBytes);
  console.log("Signing message:", intentMsg);
  console.log("Signing message hex:", bytesToHex(intentMsg));

  const digest = blake2b(intentMsg, { dkLen: 32 });
  console.log("Signing message hex:", bytesToHex(digest));

  const txSignResult = await turnkeyClient.apiClient().signRawPayload({
    signWith: suiAddress,
    payload: bytesToHex(digest),
    encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
    hashFunction: "HASH_FUNCTION_NOT_APPLICABLE",
  });

  const { r, s } = txSignResult;

  const rHex = r.padStart(64, "0");
  const sHex = s.padStart(64, "0");
  const txSignatureHex = rHex + sHex;

  if (txSignatureHex.length !== 128) {
    throw new Error(
      "Invalid signature length for Ed25519. Expected 128 hex characters."
    );
  }

  const signature = Buffer.from(txSignatureHex, "hex");
  const serialized = toSerializedSignature({ signature, pubKey: publicKey });

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

  if (result.effects?.status?.status === "success") {
    console.log("Burn transaction confirmed successfully!");
  } else {
    console.log("Transaction status:", result.effects?.status);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

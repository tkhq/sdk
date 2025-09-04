import * as dotenv from "dotenv";
import * as path from "path";
import { Transaction } from "@iota/iota-sdk/transactions";
import { IotaClient, getFullnodeUrl } from "@iota/iota-sdk/client";
import { Ed25519PublicKey } from '@iota/iota-sdk/keypairs/ed25519';
import prompts from "prompts";
import { Turnkey } from "@turnkey/sdk-server";
import { blake2b } from "@noble/hashes/blake2b";
import { bytesToHex } from "@noble/hashes/utils";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  const organizationId = process.env.ORGANIZATION_ID!;
  const turnkeyClient = new Turnkey({
    apiBaseUrl: process.env.BASE_URL!,
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    defaultOrganizationId: organizationId,
  });

  const provider = new IotaClient({ url: getFullnodeUrl('devnet')});

  // Use your Iota address and public key from environment variables
  const iotaAddress = process.env.IOTA_ADDRESS!;
  const iotaPublicKeyHex = process.env.IOTA_PUBLIC_KEY!;

  if (!iotaAddress || !iotaPublicKeyHex) {
    throw new Error(
      "Please set your IOTA_ADDRESS and IOTA_PUBLIC_KEY in the .env.local file.",
    );
  }

  console.log(`Using Iota address: ${iotaAddress}`);
  const publicKeyBytes = Buffer.from(iotaPublicKeyHex, "hex");

  // Verify that the public key corresponds to the Iota address
  const publicKey = new Ed25519PublicKey(publicKeyBytes);
  const computedAddress = publicKey.toIotaAddress();

  console.log(`Computed Iota address from public key: ${computedAddress}`);
  if (computedAddress !== iotaAddress) {
    throw new Error(
      "The IOTA_PUBLIC_KEY does not correspond to the IOTA_ADDRESS.",
    );
  }

  // Check balance
  const balanceData = await provider.getBalance({
    owner: iotaAddress,
    coinType: "0x2::iota::IOTA",
  });
  const balance = BigInt(balanceData.totalBalance);
  if (balance === 0n) {
    console.log(
      `Your balance is zero. Please fund your address ${iotaAddress} to proceed.`,
    );
    process.exit(1);
  }

  // Fetch the user's Iota coin objects
  const coins = await provider.getCoins({
    owner: iotaAddress,
    coinType: "0x2::iota::IOTA",
  });

  if (coins.data.length === 0) {
    throw new Error("No IOTA coins found in the account.");
  }

  // Create and sign a transaction
  const { recipientAddress } = await prompts([
    {
      type: "text",
      name: "recipientAddress",
      message: "Recipient address:",
      initial: "<recipient_iota_address>",
    },
  ]);

  const amount = 1000n; // 1,000 MIST (minimum practical amount)

  console.log(
    `\nSending ${amount} MIST (${
      Number(amount) / 1e9
    } IOTA) to ${recipientAddress}`,
  );

  const tx = new Transaction();

  // Use the first coin for transfer

  const referenceGasPrice = await provider.getReferenceGasPrice();
  tx.setGasPrice(referenceGasPrice);
  tx.setGasBudget(5000000n);

  // Set gas payment
  tx.setGasPayment([
    {
      objectId: coins.data[0]!.coinObjectId,
      version: coins.data[0]!.version,
      digest: coins.data[0]!.digest,
    },
  ]);

  // Set sender
  tx.setSender(iotaAddress);

  // Split coins and transfer
  const coin = tx.splitCoins(tx.gas, [tx.pure(amount)]);
  tx.transferObjects([coin], tx.pure(recipientAddress));

  // Build the transaction block
  const txBytes = await tx.build({
    provider,
  });

  // Create the intent message
  const intentMessage = messageWithIntent(IntentScope.TransactionData, txBytes);

  // Hash the intent message
  const txDigest = blake2b(intentMessage, { dkLen: 32 });

  // Sign the payload using Turnkey with HASH_FUNCTION_NOT_APPLICABLE
  // Note: unlike ECDSA, EdDSA's API does not support signing raw digests (see RFC 8032).
  // Turnkey's signer requires an explicit value to be passed here to minimize ambiguity.
  const txSignResult = await turnkeyClient.apiClient().signRawPayload({
    signWith: iotaAddress,
    payload: bytesToHex(txDigest),
    encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
    hashFunction: "HASH_FUNCTION_NOT_APPLICABLE",
  });

  // Extract r and s from the result
  const { r, s } = txSignResult;

  // Concatenate r and s to form the signature
  const signatureBytes = Buffer.from(r + s, "hex");

  // Create the serialized signature
  const serializedSignature = toSerializedSignature({
    signature: signatureBytes,
    signatureScheme: "ED25519",
    pubKey: publicKey,
  });

  // Base64 encode the transaction bytes
  const txBytesBase64 = Buffer.from(txBytes).toString("base64");

  // Execute the transaction
  const response = await provider.executeTransactionBlock({
    transactionBlock: txBytesBase64,
    signature: serializedSignature,
    options: { showEffects: true },
    requestType: "WaitForEffectsCert",
  });

  console.log("\nTransaction Hash:", response.digest);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

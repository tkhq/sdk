import * as dotenv from "dotenv";
import * as path from "path";
import { AptosClient, TxnBuilderTypes, BCS, TransactionBuilder } from "aptos";
import prompts from "prompts";
import { Turnkey } from "@turnkey/sdk-server";
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

  const client = new AptosClient("https://fullnode.mainnet.aptoslabs.com/v1");
  const aptosAddress = process.env.APTOS_ADDRESS!;
  const aptosPublicKeyHex = process.env.APTOS_PUBLIC_KEY!;

  if (!aptosAddress || !aptosPublicKeyHex) {
    throw new Error(
      "Please set your APTOS_ADDRESS and APTOS_PUBLIC_KEY in the .env.local file."
    );
  }

  console.log(`Using Aptos address: ${aptosAddress}`);
  const publicKeyBytes = Uint8Array.from(Buffer.from(aptosPublicKeyHex, "hex"));

  // Check if account exists
  let accountData = await client.getAccount(aptosAddress).catch(() => null);
  if (!accountData) {
    console.log(
      `Your account does not exist. Please fund your address ${aptosAddress} to proceed.`
    );
    process.exit(1);
  }

  // Create and sign a transaction
  const { recipientAddress } = await prompts([
    {
      type: "text",
      name: "recipientAddress",
      message: "Recipient address:",
      initial: "<recipient_aptos_address>",
    },
  ]);

  const amount = 100n; // 100 Octas (minimum practical amount)

  console.log(
    `\nSending ${amount} Octas (${
      Number(amount) / 1e8
    } APT) to ${recipientAddress}`
  );

  // Prepare the transaction payload
  const entryFunctionPayload =
    new TxnBuilderTypes.TransactionPayloadEntryFunction(
      TxnBuilderTypes.EntryFunction.natural(
        "0x1::aptos_account",
        "transfer",
        [],
        [
          BCS.bcsToBytes(
            TxnBuilderTypes.AccountAddress.fromHex(recipientAddress)
          ),
          BCS.bcsSerializeUint64(Number(amount)),
        ]
      )
    );

  // Get account sequence number and chain ID
  const [{ sequence_number: sequenceNumber }, chainId] = await Promise.all([
    client.getAccount(aptosAddress),
    client.getChainId(),
  ]);

  // Build the raw transaction
  const rawTxn = new TxnBuilderTypes.RawTransaction(
    TxnBuilderTypes.AccountAddress.fromHex(aptosAddress),
    BigInt(sequenceNumber),
    entryFunctionPayload,
    2000n, // Max gas amount
    100n, // Gas price per unit
    BigInt(Math.floor(Date.now() / 1000) + 600), // Expiration timestamp
    new TxnBuilderTypes.ChainId(Number(chainId))
  );

  // Get the signing message
  const signingMessage = TransactionBuilder.getSigningMessage(rawTxn);

  // Sign the payload using Turnkey with HASH_FUNCTION_NOT_APPLICABLE
  // Note: unlike ECDSA, EdDSA's API does not support signing raw digests (see RFC 8032).
  // Turnkey's signer requires an explicit value to be passed here to minimize ambiguity.
  const txSignResult = await turnkeyClient.apiClient().signRawPayload({
    signWith: aptosAddress,
    payload: bytesToHex(signingMessage),
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

  // Construct the signed transaction using the public key and signature
  const authenticator = new TxnBuilderTypes.TransactionAuthenticatorEd25519(
    new TxnBuilderTypes.Ed25519PublicKey(publicKeyBytes),
    new TxnBuilderTypes.Ed25519Signature(Buffer.from(txSignatureHex, "hex"))
  );

  const signedTxn = new TxnBuilderTypes.SignedTransaction(
    rawTxn,
    authenticator
  );
  const bcsTxn = BCS.bcsToBytes(signedTxn);

  // Submit the transaction
  const transactionRes = await client.submitSignedBCSTransaction(bcsTxn);
  console.log("\nTransaction Hash:", transactionRes.hash);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

import * as dotenv from "dotenv";
import * as path from "path";
import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
import { Ed25519PublicKey } from "@mysten/sui/keypairs/ed25519";
import { messageWithIntent } from "@mysten/sui/cryptography";
import { Turnkey } from "@turnkey/sdk-server";
import { blake2b } from "@noble/hashes/blake2b";
import { bytesToHex } from "@noble/hashes/utils";

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
    scheme.length + signature.length + pubKeyBytes.length,
  );
  serialized.set(scheme, 0);
  serialized.set(signature, scheme.length);
  serialized.set(pubKeyBytes, scheme.length + signature.length);
  return Buffer.from(serialized).toString("base64");
}

async function main() {
  // load the variables from .env
  // SUI_ADDRESS and SUI_PUBLIC_KEY of the Turnkey signer
  const {
    ORGANIZATION_ID,
    API_PRIVATE_KEY,
    API_PUBLIC_KEY,
    SUI_ADDRESS,
    SUI_PUBLIC_KEY,
  } = process.env;

  if (SUI_ADDRESS === undefined || SUI_PUBLIC_KEY === undefined) {
    throw new Error("SUI_ADDRESS or SUI_PUBLIC_KEY not set in .env.local");
  }

  const publicKey = new Ed25519PublicKey(Buffer.from(SUI_PUBLIC_KEY!, "hex"));
  if (publicKey.toSuiAddress() !== SUI_ADDRESS) {
    throw new Error("SUI_PUBLIC_KEY does not match SUI_ADDRESS");
  }

  // sending to the same address
  const recipient = SUI_ADDRESS;
  const amount = 1_000_000n; // 0.001 SUI

  const turnkeyClient = new Turnkey({
    apiBaseUrl: "https://api.turnkey.com",
    apiPrivateKey: API_PRIVATE_KEY!,
    apiPublicKey: API_PUBLIC_KEY!,
    defaultOrganizationId: ORGANIZATION_ID!,
  });

  // *** TRANSACTION BUILDING *** //

  const provider = new SuiClient({ url: getFullnodeUrl("testnet") });

  // fetch the user's SUI coin objects
  const coins = await provider.getCoins({
    owner: SUI_ADDRESS!,
    coinType: "0x2::sui::SUI",
  });
  if (!coins.data.length) throw new Error("No SUI coins");

  const tx = new Transaction();
  tx.setSender(SUI_ADDRESS!);
  tx.setGasPrice(await provider.getReferenceGasPrice());
  tx.setGasBudget(5_000_000n);
  tx.setGasPayment([
    {
      objectId: coins.data[0]!.coinObjectId,
      version: coins.data[0]!.version,
      digest: coins.data[0]!.digest,
    },
  ]); // separate intended send amount from gas payment
  const coin = tx.splitCoins(tx.gas, [tx.pure("u64", amount)]);
  tx.transferObjects([coin], tx.pure.address(recipient));

  const txBytes = await tx.build();

  const intentMsg = messageWithIntent("TransactionData", txBytes);
  const digest = blake2b(intentMsg, { dkLen: 32 });

  const { r, s } = await turnkeyClient.apiClient().signRawPayload({
    signWith: SUI_ADDRESS!,
    payload: bytesToHex(digest),
    encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
    hashFunction: "HASH_FUNCTION_NOT_APPLICABLE",
  });

  const signature = Buffer.from(r + s, "hex");
  const serialized = toSerializedSignature({ signature, pubKey: publicKey });

  // *** EXECUTION *** //

  const result = await provider.executeTransactionBlock({
    transactionBlock: Buffer.from(txBytes).toString("base64"),
    signature: serialized,
    requestType: "WaitForEffectsCert",
    options: { showEffects: true },
  });

  console.log("Transaction digest:", result.digest);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});

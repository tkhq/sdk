import { Transaction } from "@mysten/sui/transactions";
import { messageWithIntent } from "@mysten/sui/cryptography";
import { blake2b } from "@noble/hashes/blake2b";
import { bytesToHex } from "@noble/hashes/utils";

import {
  getSuiClient,
  getTurnkeyClient,
  loadSignerPublicKey,
  toSerializedSignature,
} from "./shared.js";

async function main() {
  const { address, publicKey } = loadSignerPublicKey();

  // Self-transfer for demo purposes so the example is safe to re-run.
  const recipient = address;
  const amount = 1_000_000n; // 0.001 SUI

  const turnkeyClient = getTurnkeyClient();
  const provider = getSuiClient();

  // *** TRANSACTION BUILDING *** //

  // Fetch the user's SUI coin objects via the gRPC node provider.
  // `listCoins` returns `{ objects: Coin[], hasNextPage, cursor }` where
  // each `Coin` is `{ objectId, version, digest, owner, type, balance }`.
  const coins = await provider.listCoins({
    owner: address,
    coinType: "0x2::sui::SUI",
  });
  if (!coins.objects.length) throw new Error("No SUI coins");

  const gasCoin = coins.objects[0]!;

  const tx = new Transaction();
  tx.setSender(address);
  const { referenceGasPrice } = await provider.getReferenceGasPrice();
  tx.setGasPrice(referenceGasPrice);
  tx.setGasBudget(5_000_000n);
  tx.setGasPayment([
    {
      objectId: gasCoin.objectId,
      version: gasCoin.version,
      digest: gasCoin.digest,
    },
  ]); // separate intended send amount from gas payment
  const coin = tx.splitCoins(tx.gas, [tx.pure("u64", amount)]);
  tx.transferObjects([coin], tx.pure.address(recipient));

  const txBytes = await tx.build();

  // Canonical Turnkey-Sui signing flow (unchanged): wrap tx bytes in the
  // "TransactionData" intent, blake2b(32) it, then have Turnkey sign the
  // raw 32-byte digest.
  const intentMsg = messageWithIntent("TransactionData", txBytes);
  const digest = blake2b(intentMsg, { dkLen: 32 });

  const { r, s } = await turnkeyClient.apiClient().signRawPayload({
    signWith: address,
    payload: bytesToHex(digest),
    encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
    hashFunction: "HASH_FUNCTION_NOT_APPLICABLE",
  });

  const signature = Buffer.from(r + s, "hex");
  const serialized = toSerializedSignature({ signature, pubKey: publicKey });

  // *** EXECUTION *** //

  // Broadcast through the gRPC node provider. QuickNode by default when
  // QUICKNODE_SUI_URL is set, otherwise the public testnet gRPC fullnode.
  // The gRPC `executeTransaction` takes raw transaction bytes plus an
  // array of base64-encoded flagged signatures.
  const result = await provider.executeTransaction({
    transaction: txBytes,
    signatures: [serialized],
  });

  const executed =
    result.$kind === "Transaction"
      ? result.Transaction
      : result.FailedTransaction;
  console.log("Transaction digest:", executed.digest);
  if (result.$kind === "FailedTransaction") {
    console.error("Transaction failed:", executed.status.error);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});

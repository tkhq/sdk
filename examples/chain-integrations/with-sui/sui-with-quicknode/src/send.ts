import { Transaction } from "@mysten/sui/transactions";
import { messageWithIntent } from "@mysten/sui/cryptography";
import { blake2b } from "@noble/hashes/blake2b";
import { bytesToHex } from "@noble/hashes/utils";

import {
  getSuiClient,
  getTurnkeyClient,
  loadSignerPublicKey,
  toSerializedSignature,
} from "./shared";

async function main() {
  const { address, publicKey } = loadSignerPublicKey();

  // Self-transfer for demo purposes so the example is safe to re-run.
  const recipient = address;
  const amount = 1_000_000n; // 0.001 SUI

  const turnkeyClient = getTurnkeyClient();
  const provider = getSuiClient();

  // *** TRANSACTION BUILDING *** //

  // Fetch the user's SUI coin objects (via the configured node provider).
  const coins = await provider.getCoins({
    owner: address,
    coinType: "0x2::sui::SUI",
  });
  if (!coins.data.length) throw new Error("No SUI coins");

  const tx = new Transaction();
  tx.setSender(address);
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

  // Canonical Turnkey-Sui signing flow: wrap tx bytes in the
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

  // Broadcast through the configured node provider (QuickNode by default
  // when QUICKNODE_SUI_URL is set, otherwise the public testnet fullnode).
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

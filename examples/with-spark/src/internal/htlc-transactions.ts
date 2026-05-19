/**
 * Vendored from @buildonspark/spark-sdk@0.7.5
 * Source: src/utils/htlc-transactions.ts
 *
 * Only `createRefundTxsForLightning` (and its private helpers) is vendored
 * because it isn't re-exported from the package's public types. Once the
 * SDK adds it to its public exports, delete this file and import directly.
 *
 * Adjacent helpers used by this code (`maybeApplyFee`,
 * `getEphemeralAnchorOutput`, `getNextHTLCTransactionSequence`) ARE
 * publicly exported by spark-sdk, so we re-import those from the package
 * rather than re-vendoring them.
 */

import {
  Transaction,
  Script,
  taprootListToTree,
  p2tr,
  ScriptNum,
} from "@scure/btc-signer";
import { secp256k1 } from "@noble/curves/secp256k1";
import { hexToBytes } from "@noble/curves/utils";
import type { BTC_NETWORK } from "@scure/btc-signer/utils";
import type { TransactionInput } from "@scure/btc-signer/psbt";

import {
  maybeApplyFee,
  getEphemeralAnchorOutput,
  getTxId,
  SparkValidationError,
} from "@buildonspark/spark-sdk";

interface CreateLightningRefundTxsInput {
  nodeTx: Transaction;
  directNodeTx: Transaction | undefined;
  vout: number;
  sequence: number;
  directSequence: number;
  directInput?: TransactionInput;
  network: BTC_NETWORK;
  hash: Uint8Array;
  hashLockDestinationPubkey: Uint8Array;
  sequenceLockDestinationPubkey: Uint8Array;
}

// Fixed BIP341 "NUMS" x-only public key (a well-known constant, not tied to any secret).
// Used as the Taproot internal key so HTLC outputs depend only on the script.
const PUB_KEY_BYTES =
  "0250929b74c1a04954b78b4b6035e97a5e078a5a0f28ec96d547bfee9ace803ac0";

function numsPoint(): Buffer {
  const withdrawalPubKeyPoint = secp256k1.Point.fromHex(PUB_KEY_BYTES);
  const withdrawalPubKey = withdrawalPubKeyPoint.toBytes(true).slice(1);
  return Buffer.from(withdrawalPubKey);
}

const lightningHTLCSequence = 2160;

export function createRefundTxsForLightning({
  nodeTx,
  directNodeTx,
  vout,
  sequence,
  directSequence,
  directInput,
  network,
  hash,
  hashLockDestinationPubkey,
  sequenceLockDestinationPubkey,
}: CreateLightningRefundTxsInput): {
  cpfpRefundTx: Transaction;
  directRefundTx?: Transaction;
  directFromCpfpRefundTx?: Transaction;
} {
  const cpfpRefundTx = createLightningHTLCTransaction({
    nodeTx,
    sequence,
    vout,
    hash,
    hashLockDestinationPubkey,
    sequenceLockDestinationPubkey,
    applyFee: false,
    network,
  });

  const directFromCpfpRefundTx = createLightningHTLCTransaction({
    nodeTx,
    sequence: directSequence,
    vout,
    hash,
    hashLockDestinationPubkey,
    sequenceLockDestinationPubkey,
    applyFee: true,
    network,
  });

  if (directSequence && directNodeTx) {
    const directRefundTx = createLightningHTLCTransaction({
      nodeTx: directNodeTx,
      sequence: directSequence,
      vout,
      hash,
      hashLockDestinationPubkey,
      sequenceLockDestinationPubkey,
      applyFee: true,
      network,
    });
    return { cpfpRefundTx, directRefundTx, directFromCpfpRefundTx };
  }
  if (directInput && !directSequence) {
    throw new SparkValidationError(
      "directSequence must be provided if directInput is",
      {
        field: "directSequence",
        value: directSequence,
      },
    );
  }

  return { cpfpRefundTx, directFromCpfpRefundTx };
}

function createLightningHTLCTransaction({
  nodeTx,
  vout,
  sequence,
  hash,
  hashLockDestinationPubkey,
  sequenceLockDestinationPubkey,
  applyFee,
  network,
}: {
  nodeTx: Transaction;
  vout: number;
  hash: Uint8Array;
  hashLockDestinationPubkey: Uint8Array;
  sequenceLockDestinationPubkey: Uint8Array;
  sequence: number;
  applyFee: boolean;
  network: BTC_NETWORK;
}): Transaction {
  let outAmount = nodeTx.getOutput(vout)?.amount ?? 0n;
  if (applyFee) {
    outAmount = maybeApplyFee(outAmount);
  }

  const input: TransactionInput = {
    txid: hexToBytes(getTxId(nodeTx)),
    index: 0,
  };

  const htlcTransaction = new Transaction({
    version: 3,
    allowUnknownOutputs: true,
  });

  htlcTransaction.addInput({
    ...input,
    sequence,
  });

  const taprootAddress = createHTLCTaprootAddress({
    hash,
    hashLockDestinationPubkey,
    sequence: lightningHTLCSequence,
    sequenceLockDestinationPubkey,
    network,
  });

  htlcTransaction.addOutput({
    script: taprootAddress,
    amount: outAmount,
  });

  if (!applyFee) {
    htlcTransaction.addOutput(getEphemeralAnchorOutput());
  }

  return htlcTransaction;
}

function createHTLCTaprootAddress({
  hash,
  hashLockDestinationPubkey,
  sequence,
  sequenceLockDestinationPubkey,
  network,
}: {
  hash: Uint8Array;
  hashLockDestinationPubkey: Uint8Array;
  sequence: number;
  sequenceLockDestinationPubkey: Uint8Array;
  network: BTC_NETWORK;
}): Uint8Array {
  const numsKey = numsPoint();

  const hashLockScript = createHashLockScript(hash, hashLockDestinationPubkey);
  const sequenceLockScript = createSequenceLockScript(
    sequence,
    sequenceLockDestinationPubkey,
  );

  const hashLockLeaf = { leafVersion: 0xc0, script: hashLockScript };
  const sequenceLockLeaf = { leafVersion: 0xc0, script: sequenceLockScript };

  const scriptTree = taprootListToTree([hashLockLeaf, sequenceLockLeaf]);

  return p2tr(numsKey, scriptTree, network, true).script;
}

function createHashLockScript(
  hash: Uint8Array,
  pubkey: Uint8Array,
): Uint8Array {
  return Script.encode([
    "SHA256",
    hash,
    "EQUALVERIFY",
    pubkey.slice(1, 33),
    "CHECKSIG",
  ]);
}

function createSequenceLockScript(
  sequence: number,
  sequenceLockDestinationPubkey: Uint8Array,
): Uint8Array {
  const seqOperand =
    sequence >= 0 && sequence <= 16
      ? sequence
      : ScriptNum().encode(BigInt(sequence));
  return Script.encode([
    seqOperand,
    "CHECKSEQUENCEVERIFY",
    "DROP",
    sequenceLockDestinationPubkey.slice(1, 33),
    "CHECKSIG",
  ]);
}

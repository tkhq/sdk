import {
  PublicKey,
  SystemProgram,
  Transaction,
  VersionedTransaction,
  TransactionMessage,
  Connection,
} from "@solana/web3.js";
import { recentBlockhash } from "./solanaNetwork";
import type { TurnkeySigner } from "@turnkey/solana";

/**
 * Creates an unsigned Solana transfer.
 * @param signer
 * @param fromAddress
 * @param toAddress
 * @param amount amount to send in LAMPORTS (one SOL = 1000000000 LAMPS)
 */
export async function createTransfer(input: {
  fromAddress: string;
  toAddress: string;
  amount: number;
  version: string;
  feePayerAddress?: string;
  connection: Connection;
}): Promise<Transaction | VersionedTransaction> {
  const {
    fromAddress,
    toAddress,
    amount,
    version,
    feePayerAddress,
    connection,
  } = input;
  const fromKey = new PublicKey(fromAddress);
  const toKey = new PublicKey(toAddress);

  let feePayerKey;
  if (feePayerAddress) {
    feePayerKey = new PublicKey(feePayerAddress);
  }

  const blockhash = await recentBlockhash(connection);

  let transferTransaction;

  if (version === "legacy") {
    // Legacy transaction
    transferTransaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: fromKey,
        toPubkey: toKey,
        lamports: amount,
      })
    );

    // Get a recent block hash
    transferTransaction!.recentBlockhash = blockhash;
    // Set the signer
    transferTransaction!.feePayer = feePayerKey ?? fromKey;
  } else {
    // VersionedTransaction
    const txMessage = new TransactionMessage({
      payerKey: feePayerKey ?? fromKey,
      recentBlockhash: blockhash,
      instructions: [
        SystemProgram.transfer({
          fromPubkey: fromKey,
          toPubkey: toKey,
          lamports: Number(amount),
        }),
      ],
    });

    const versionedTxMessage = txMessage.compileToV0Message();
    transferTransaction = new VersionedTransaction(versionedTxMessage);
  }

  return transferTransaction;
}

/**
 * Creates a Solana transfer and signs it with Turnkey.
 * @param signer
 * @param fromAddress
 * @param toAddress
 * @param amount amount to send in LAMPORTS (one SOL = 1000000000 LAMPS)
 */
export async function signTransfer(input: {
  signer: TurnkeySigner;
  fromAddress: string;
  toAddress: string;
  amount: number;
  connection: Connection;
}): Promise<Transaction> {
  const { signer, fromAddress, toAddress, amount, connection } = input;
  const fromKey = new PublicKey(fromAddress);
  const toKey = new PublicKey(toAddress);

  const transferTransaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: fromKey,
      toPubkey: toKey,
      lamports: amount,
    })
  );

  // Get a recent block hash
  transferTransaction.recentBlockhash = await recentBlockhash(connection);
  // Set the signer
  transferTransaction.feePayer = fromKey;

  await signer.addSignature(transferTransaction, fromAddress);

  return transferTransaction;
}

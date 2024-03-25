import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { recentBlockhash } from "./solanaNetwork";
import type { TurnkeySigner } from "@turnkey/solana";

/**
 * Creates a Solana transfer and signs it with Turnkey.
 * @param signer
 * @param fromAddress
 * @param toAddress
 * @param amount amount to send in LAMPORTS (one SOL = 1000000000 LAMPS)
 */
export async function createAndSignTransfer(input: {
  signer: TurnkeySigner;
  fromAddress: string;
  toAddress: string;
  amount: number;
}): Promise<Transaction> {
  const { signer, fromAddress, toAddress, amount } = input;
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
  transferTransaction.recentBlockhash = await recentBlockhash();
  // Set the signer
  transferTransaction.feePayer = fromKey;

  await signer.addSignature(transferTransaction, fromAddress);

  return transferTransaction;
}

export async function signTransfers(input: {
  signer: TurnkeySigner;
  fromAddress: string,
  unsignedTxs: Transaction[]
}): Promise<Transaction[]> {
  const { signer, fromAddress, unsignedTxs } = input;

  const signedTxs = await signer.signAllTransactions(unsignedTxs, fromAddress);

  return signedTxs as Transaction[];
}

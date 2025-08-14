import { PublicKey } from "@solana/web3.js";
import { TurnkeySigner } from "@turnkey/solana";

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
  type TransactionInstruction,
  SystemProgram,
} from "@solana/web3.js";

import {
  Actions,
  createEd25519AuthorityInfo,
  findSwigPda,
  getCreateSwigInstruction,
  fetchSwig,
  getAddAuthorityInstructions,
  createEd25519SessionAuthorityInfo,
  getCreateSessionInstructions,
  getSignInstructions,
} from "@swig-wallet/classic";

/**
 * Rescue with reimbursement function for SWIG administration
 * This function will return a transaction of the SWIG owner to sign and broadcast, gas will be paid by the rescuer
 * @param connection Connection instance
 * @param userPayer Payer public key
 * @param swigAddress SWIG address
 * @param amount Amount to rescue
 * @param reimbursementAmount Amount to reimburse the rescuer
 * @param sponsor Address of the sponsor
 * @param turnkeySigner Turnkey signer instance
 */
export async function rescueWithReimbursement(
  connection: Connection,
  roleId: number,
  userPayer: PublicKey,
  swigAddress: PublicKey,
  amount: bigint,
  reimbursementAmount: bigint,
  sponsor: PublicKey,
  turnkeySigner: TurnkeySigner
): Promise<Transaction> {
  // TODO: Implement rescue with reimbursement logic

  const swig = await fetchSwig(connection, swigAddress);

  const swigIx = await getSignInstructions(
    swig,
    roleId,
    [
      SystemProgram.transfer({
        fromPubkey: swigAddress,
        toPubkey: userPayer,
        lamports: amount, 
      }),
      SystemProgram.transfer({
        fromPubkey: swigAddress,
        toPubkey: sponsor,
        lamports: reimbursementAmount, 
      })
    ],
    false,
    {
      payer: sponsor.publicKey,
    }
  );
  const tx = new Transaction().add(
    ...swigIx
  );

  tx.payer = sponsor;

  tx.recentBlockhash = await connection.getLatestBlockhash();

  await turnkeySigner.addSignature(tx, sponsor.toBase58());

  return tx;
}

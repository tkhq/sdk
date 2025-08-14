import {
  Connection,
  PublicKey,
  Transaction,
  Keypair,
  type TransactionInstruction,
  VersionedTransaction,
  TransactionConfirmationStrategy,
  sendAndConfirmRawTransaction,
  getConfirmationStrategy,
} from "@solana/web3.js";
import { TurnkeySigner } from "@turnkey/solana";

import { generateSwigAddress } from "./generateSwigAddress";

import bs58 from "bs58";

import {
  getCreateSwigInstruction,
  createEd25519AuthorityInfo,
  Actions,
  fetchSwig,
  getAddAuthorityInstructions,
  createEd25519SessionAuthorityInfo,
} from "@swig-wallet/classic";
/**
 * Sponsored init function for SWIG administration
 * Returns a transaction signed by the sponsor for the treasurer to sign and broadcast
 * @param connection Connection instance
 * @param turnkeySigner Turnkey signer instance
 * @param walletId Wallet id to generate the swig
 * @param sponsor Sponsor public key
 * @param treasurer Treasurer public key
 */
export async function sponsoredInit(
  connection: Connection,
  turnkeySigner: TurnkeySigner,
  walletId: string,
  treasurer: PublicKey,
  sponsor: PublicKey,
  //managementPda: PublicKey
): Promise<Transaction> {
  // TODO: Implement sponsored init logic
  const [swigAddress, idBytes] = generateSwigAddress(walletId);

  const rootAuthorityInfo = createEd25519AuthorityInfo(treasurer); // this is the end-user suborg wallet key (for now)
  const rootActions = Actions.set().manageAuthority().get(); // TODO: investigate manageAuthority

  const createSwigIx = await getCreateSwigInstruction({
    sponsor,
    id: idBytes,
    actions: rootActions,
    authorityInfo: rootAuthorityInfo,
  });

  const transaction = new Transaction().add(createSwigIx);
  transaction.recentBlockhash = await connection.getLatestBlockhash();
  transaction.feePayer = sponsor;

  await turnkeySigner.addSignature(transaction, sponsor.toBase58()); // same here

  let broadcastedTx = await broadcast(connection, transaction); // in the futuer we can combine the transactions and not have to broadcast

  // todo get the managmeent pda later
  const allButManageActions = Actions.set().allButManageAuthority().get(); // TODO: investigate allButManageAuthority
  const swig = await fetchSwig(connection, swigAddress);
  const addAuthorityInstructions = await getAddAuthorityInstructions(
    swig,
    0, // iterate new role id
    createEd25519SessionAuthorityInfo(treasurer, 1000n), // giving a second role to the treasurer; can add session key here
    allButManageActions, // set all but manage
    {
      payer: sponsor,
    }
  );

  const addAuthorityTx = new Transaction().add(...addAuthorityInstructions); // this one needs to be signed by the treasurer on the client side
  addAuthorityTx.recentBlockhash =
    await connection.getLatestBlockhash();
  addAuthorityTx.feePayer = sponsor;

  // sign transaction using @turnkey/solana
  await turnkeySigner.addSignature(addAuthorityTx, sponsor.toBase58()); // same here

  return addAuthorityTx;
}

// todo refactor this to be a utility function
async function broadcast(
  connection: Connection,
  signedTransaction: Transaction | VersionedTransaction,
) {
  const signature =
    "version" in signedTransaction
      ? signedTransaction.signatures[0]!
      : signedTransaction.signature!;

  const confirmationStrategy = await getConfirmationStrategy(
    connection,
    bs58.encode(signature),
  );
  const transactionHash = await sendAndConfirmRawTransaction(
    connection,
    new Uint8Array(signedTransaction.serialize()),
    confirmationStrategy,
    { commitment: "confirmed" },
  );

  return transactionHash;
}

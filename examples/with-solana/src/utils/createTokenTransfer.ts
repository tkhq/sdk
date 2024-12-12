import { PublicKey, Transaction, Connection } from "@solana/web3.js";
import { createTransferCheckedInstruction } from "@solana/spl-token";
import type { TurnkeySigner } from "@turnkey/solana";

import { solanaNetwork } from ".";

export async function createTokenTransfer(
  turnkeySigner: TurnkeySigner,
  connection: Connection,
  solAddress: string,
  tokenAccountPubkey: PublicKey,
  mintAuthority: PublicKey,
  ataRecipient: PublicKey
): Promise<any> {
  const fromKey = new PublicKey(solAddress);

  let transferTx = new Transaction().add(
    createTransferCheckedInstruction(
      tokenAccountPubkey, // from (should be a token account)
      mintAuthority, // mint
      ataRecipient, // to (should be a token account)
      fromKey, // from's owner
      1e4, // amount, if your deciamls is 8, send 10^8 for 1 token
      8 // decimals
    )
  );

  // Get a recent block hash
  transferTx.recentBlockhash = await solanaNetwork.recentBlockhash();
  // Set the signer
  transferTx.feePayer = fromKey;

  // const serializedTransaction = transferTx.serialize({
  //   requireAllSignatures: false,
  //   verifySignatures: false
  // });
  
  // const hexString = serializedTransaction.toString('hex');
  // console.log("Transaction hex:", hexString);

  await turnkeySigner.addSignature(transferTx, solAddress);

  console.log("Broadcasting token transfer transaction...");

  await solanaNetwork.broadcast(connection, transferTx);
}

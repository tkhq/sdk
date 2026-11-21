import { PublicKey, Transaction, Connection } from "@solana/web3.js";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import type { TurnkeySigner } from "@turnkey/solana";

import { solanaNetwork } from ".";

export type TokenTransferOptions = {
  amount?: number | bigint; // amount in base units, defaults to 1e4
  decimals?: number; // decimals of the mint, defaults to 8
  programId?: PublicKey; // token program of the mint (Token or Token-2022), defaults to Token
  recipientOwner?: PublicKey; // if set, the recipient's associated token account is created first (rent paid by the sender)
};

// This method creates, signs and broadcasts an SPL token transfer using Turnkey's Sign Raw Payload endpoint for signing
export async function createTokenTransferAddSignature(
  turnkeySigner: TurnkeySigner,
  connection: Connection,
  solAddress: string,
  tokenAccountPubkey: PublicKey,
  mint: PublicKey,
  ataRecipient: PublicKey,
): Promise<any> {
  const fromKey = new PublicKey(solAddress);

  let transferTx = new Transaction().add(
    createTransferCheckedInstruction(
      tokenAccountPubkey, // from (should be a token account)
      mint, // mint
      ataRecipient, // to (should be a token account)
      fromKey, // from's owner
      1e4, // amount, if your decimals is 8, send 10^8 for 1 token
      8, // decimals
    ),
  );

  // Get a recent block hash
  transferTx.recentBlockhash = await solanaNetwork.recentBlockhash(connection);
  // Set the signer
  transferTx.feePayer = fromKey;

  await turnkeySigner.addSignature(transferTx, solAddress);

  console.log("Broadcasting token transfer transaction...");

  await solanaNetwork.broadcast(connection, transferTx);
}

// This method creates, signs and broadcasts an SPL token transfer using Turnkey's Sign Transaction endpoint for signing
// Note: Sign Transaction passes the transaction through the policy engine, allowing Solana related policies to apply!
export async function createTokenTransferSignTransaction(
  turnkeySigner: TurnkeySigner,
  connection: Connection,
  solAddress: string,
  tokenAccountPubkey: PublicKey,
  mint: PublicKey,
  ataRecipient: PublicKey,
  options: TokenTransferOptions = {},
): Promise<any> {
  const transferTx = await constructTokenTransfer(
    connection,
    tokenAccountPubkey,
    mint,
    ataRecipient,
    solAddress,
    options,
  );

  // Use Turnkey's sign transaction endpoint that passes the created transaction through the policy engine
  let signedTx = await turnkeySigner.signTransaction(transferTx, solAddress);

  console.log("Broadcasting token transfer transaction...");

  await solanaNetwork.broadcast(connection, signedTx);
}

// This method creates an unsigned SPL token transfer
export async function constructTokenTransfer(
  connection: Connection,
  tokenAccountPubkey: PublicKey,
  mint: PublicKey,
  ataRecipient: PublicKey,
  solAddress: string,
  options: TokenTransferOptions = {},
): Promise<Transaction> {
  const fromKey = new PublicKey(solAddress);
  const {
    amount = 1e4,
    decimals = 8,
    programId = TOKEN_PROGRAM_ID,
    recipientOwner,
  } = options;

  let transferTx = new Transaction();

  if (recipientOwner) {
    transferTx.add(
      createAssociatedTokenAccountIdempotentInstruction(
        fromKey, // payer
        ataRecipient, // associated token account
        recipientOwner, // owner
        mint, // mint
        programId,
      ),
    );
  }

  transferTx.add(
    createTransferCheckedInstruction(
      tokenAccountPubkey, // from (should be a token account)
      mint, // mint
      ataRecipient, // to (should be a token account)
      fromKey, // from's owner
      amount, // amount, if your decimals is 8, send 10^8 for 1 token
      decimals, // decimals
      [], // multisig signers
      programId,
    ),
  );

  // Get a recent block hash
  transferTx.recentBlockhash = await solanaNetwork.recentBlockhash(connection);
  // Set the signer
  transferTx.feePayer = fromKey;

  return transferTx;
}

import { PublicKey, Transaction, Keypair, Connection } from "@solana/web3.js";
import { createAssociatedTokenAccountInstruction } from "@solana/spl-token";
import type { TurnkeySigner } from "@turnkey/solana";

import { solanaNetwork } from ".";

export async function createTokenAccount(
  turnkeySigner: TurnkeySigner,
  connection: Connection,
  solAddress: string,
  ata: PublicKey,
  owner: PublicKey,
  mintAuthority: Keypair
): Promise<any> {
  const fromKey = new PublicKey(solAddress);

  // For warchest
  const createTokenAccountTx = new Transaction().add(
    createAssociatedTokenAccountInstruction(
      fromKey, // payer
      ata, // ata
      owner, // owner
      mintAuthority.publicKey // mint
    )
  );

  // Get a recent block hash
  createTokenAccountTx.recentBlockhash = await solanaNetwork.recentBlockhash();
  // Set the signer
  createTokenAccountTx.feePayer = fromKey;

  await turnkeySigner.addSignature(createTokenAccountTx, solAddress);

  console.log("Broadcasting token account creation transaction...");

  await solanaNetwork.broadcast(connection, createTokenAccountTx);
}

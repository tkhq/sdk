import { PublicKey, Transaction, Keypair, Connection } from "@solana/web3.js";
import { createAssociatedTokenAccountInstruction } from "@solana/spl-token";
import type { TurnkeySigner } from "@turnkey/solana";

import { solanaNetwork, TURNKEY_WAR_CHEST } from "./";

export async function createTokenAccount(
  turnkeySigner: TurnkeySigner,
  connection: Connection,
  solAddress: string,
  ata: PublicKey,
  mintAuthority: Keypair
): Promise<any> {
  const fromKey = new PublicKey(solAddress);
  const turnkeyWarchest = new PublicKey(TURNKEY_WAR_CHEST);

  // For warchest
  const createTokenAccountTx = new Transaction().add(
    createAssociatedTokenAccountInstruction(
      fromKey, // payer
      ata, // ata
      turnkeyWarchest, // owner
      mintAuthority.publicKey // mint
    )
  );

  // Get a recent block hash
  createTokenAccountTx.recentBlockhash = await solanaNetwork.recentBlockhash();
  // Set the signer
  createTokenAccountTx.feePayer = fromKey;

  await turnkeySigner.addSignature(createTokenAccountTx, solAddress);

  await solanaNetwork.broadcast(connection, createTokenAccountTx);
}

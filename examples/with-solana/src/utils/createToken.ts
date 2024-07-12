import {
  PublicKey,
  SystemProgram,
  Transaction,
  Keypair,
  Connection,
} from "@solana/web3.js";
import {
  createInitializeMintInstruction,
  getMint,
  getMinimumBalanceForRentExemptMint,
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import type { TurnkeySigner } from "@turnkey/solana";

import { solanaNetwork } from ".";

export async function createToken(
  turnkeySigner: TurnkeySigner,
  connection: Connection,
  solAddress: string
): Promise<{ mintAuthority: Keypair }> {
  const fromKey = new PublicKey(solAddress);

  // Create a brand new SPL token using a separate mint authority
  const mintAuthority = Keypair.generate();

  let tx = new Transaction().add(
    // create mint account
    SystemProgram.createAccount({
      fromPubkey: fromKey,
      newAccountPubkey: mintAuthority.publicKey,
      space: MINT_SIZE,
      lamports: await getMinimumBalanceForRentExemptMint(connection),
      programId: TOKEN_PROGRAM_ID,
    }),
    // init mint account
    createInitializeMintInstruction(
      mintAuthority.publicKey, // mint pubkey
      8, // decimals
      fromKey, // mint authority
      fromKey // freeze authority (you can use `null` to disable it. when you disable it, you can't turn it on again)
    )
  );

  // Get a recent block hash
  tx.recentBlockhash = await solanaNetwork.recentBlockhash();
  // Set the signer
  tx.feePayer = fromKey;
  tx.partialSign(mintAuthority);

  await turnkeySigner.addSignature(tx, solAddress);

  console.log("Broadcasting token creation transaction...");

  await solanaNetwork.broadcast(connection, tx);
  await getMint(connection, mintAuthority.publicKey);

  return {
    mintAuthority,
  };
}

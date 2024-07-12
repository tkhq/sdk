import { PublicKey, Transaction, Connection } from "@solana/web3.js";
import { createMintToCheckedInstruction } from "@solana/spl-token";
import type { TurnkeySigner } from "@turnkey/solana";

import { solanaNetwork } from ".";

export async function createMint(
  turnkeySigner: TurnkeySigner,
  connection: Connection,
  solAddress: string,
  tokenAccountPubkey: PublicKey,
  mintAuthority: PublicKey
): Promise<any> {
  const fromKey = new PublicKey(solAddress);

  const mintTx = new Transaction().add(
    createMintToCheckedInstruction(
      mintAuthority, // mint
      tokenAccountPubkey, // receiver (should be a token account)
      fromKey, // mint authority
      1e8, // amount. if your decimals is 8, you mint 10^8 for 1 token.
      8 // decimals
      // [signer1, signer2 ...], // only multisig account will use
    )
  );

  // Get a recent block hash
  mintTx.recentBlockhash = await solanaNetwork.recentBlockhash();
  // Set the signer
  mintTx.feePayer = fromKey;

  await turnkeySigner.addSignature(mintTx, solAddress);

  console.log("Broadcasting mint transaction...");

  await solanaNetwork.broadcast(connection, mintTx);
}

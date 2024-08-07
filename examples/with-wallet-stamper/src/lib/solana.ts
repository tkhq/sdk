import {
  PublicKey,
  SystemProgram,
  Transaction,
  Connection,
} from "@solana/web3.js";
import { TurnkeyClient } from "@turnkey/http";

import { TurnkeySigner } from "@turnkey/solana";

export async function recentBlockhash(): Promise<string> {
  const connection = new Connection(
    "https://api.devnet.solana.com",
    "confirmed"
  );
  const blockhash = await connection.getLatestBlockhash();
  return blockhash.blockhash;
}

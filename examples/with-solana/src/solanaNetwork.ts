import {
  Connection,
  sendAndConfirmRawTransaction,
  PublicKey,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";

export function connect(endpoint?: string): Connection {
  if (endpoint === undefined) {
    endpoint = "https://api.devnet.solana.com";
  }
  return new Connection(endpoint, "confirmed");
}

export async function balance(
  connection: Connection,
  address: string
): Promise<number> {
  const publicKey = new PublicKey(address);

  return await connection.getBalance(publicKey);
}

export async function dropTokens(
  connection: Connection,
  solanaAddress: string
) {
  const publicKey = new PublicKey(solanaAddress);
  console.log(`${publicKey.toBuffer.toString()}`);
  console.log(`Dropping 1 SOL into ${solanaAddress}...`);

  const airdropSignature = await connection.requestAirdrop(
    publicKey,
    LAMPORTS_PER_SOL
  );

  // TODO: this is flagged as deprecated. Replace?
  await connection.confirmTransaction(airdropSignature);
  console.log(`Success! ✅`);
  console.log(
    `Explorer link: https://explorer.solana.com/address/${solanaAddress}?cluster=devnet`
  );
}

export async function broadcast(
  connection: Connection,
  rawTransaction: Buffer
) {
  // TODO: this API is deprecated. What's the alternative?
  const transactionHash = await sendAndConfirmRawTransaction(
    connection,
    rawTransaction,
    { commitment: "confirmed" }
  );
  console.log(
    `\nTransaction broadcast and confirmed! 🎉 \nhttps://explorer.solana.com/tx/${transactionHash}?cluster=devnet`
  );
}

export async function recentBlockhash(): Promise<string> {
  const connection = new Connection(
    "https://api.devnet.solana.com",
    "confirmed"
  );
  const blockhash = await connection.getLatestBlockhash();
  return blockhash.blockhash;
}

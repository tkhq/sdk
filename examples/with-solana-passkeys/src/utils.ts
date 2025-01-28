import {
  Connection,
  sendAndConfirmRawTransaction,
  PublicKey,
  LAMPORTS_PER_SOL,
  TransactionConfirmationStrategy,
  Transaction,
  VersionedTransaction,
} from "@solana/web3.js";
import bs58 from "bs58";

export function refineNonNull<T>(
  input: T | null | undefined,
  errorMessage?: string
): T {
  if (input == null) {
    throw new Error(errorMessage ?? `Unexpected ${JSON.stringify(input)}`);
  }

  return input;
}

export function print(header: string, body: string): void {
  console.log(`${header}\n\t${body}\n`);
}

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

  console.log(`Dropping 1 SOL into ${solanaAddress}...`);

  const airdropSignature = await connection.requestAirdrop(
    publicKey,
    LAMPORTS_PER_SOL
  );
  const confirmationStrategy = await getConfirmationStrategy(airdropSignature);

  await connection.confirmTransaction(confirmationStrategy);

  print(
    "\nSuccess! ✅",
    `Explorer link: https://explorer.solana.com/address/${solanaAddress}?cluster=devnet`
  );
}

export async function broadcast(
  connection: Connection,
  signedTransaction: Transaction | VersionedTransaction
) {
  const signature =
    signedTransaction instanceof Transaction
      ? signedTransaction.signature!
      : signedTransaction.signatures[0]!;
  const confirmationStrategy = await getConfirmationStrategy(
    bs58.encode(signature)
  );
  const transactionHash = await sendAndConfirmRawTransaction(
    connection,
    Buffer.from(signedTransaction.serialize()),
    confirmationStrategy,
    { commitment: "confirmed" }
  );
  print(
    "Transaction broadcast and confirmed! 🎉",
    `https://explorer.solana.com/tx/${transactionHash}?cluster=devnet`
  );

  return transactionHash;
}

export async function recentBlockhash(): Promise<string> {
  const connection = new Connection(
    "https://api.devnet.solana.com",
    "confirmed"
  );
  const blockhash = await connection.getLatestBlockhash();
  return blockhash.blockhash;
}

export async function getConfirmationStrategy(
  signature: string
): Promise<TransactionConfirmationStrategy> {
  const connection = new Connection(
    "https://api.devnet.solana.com",
    "confirmed"
  );
  const latestBlockHash = await connection.getLatestBlockhash();

  return {
    blockhash: latestBlockHash.blockhash,
    lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
    signature,
  };
}

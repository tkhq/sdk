import {
  Connection,
  sendAndConfirmRawTransaction,
  PublicKey,
  LAMPORTS_PER_SOL,
  TransactionConfirmationStrategy,
  Transaction,
  VersionedTransaction,
} from "@solana/web3.js";
import { bs58 } from "@turnkey/encoding";

import { print } from "./print";

export function connect(
  endpoint: string = "https://api.devnet.solana.com",
): Connection {
  return new Connection(endpoint, "confirmed");
}

export async function balance(
  connection: Connection,
  address: string,
): Promise<number> {
  const publicKey = new PublicKey(address);

  return await connection.getBalance(publicKey);
}

export async function dropTokens(
  connection: Connection,
  solanaAddress: string,
) {
  const publicKey = new PublicKey(solanaAddress);

  console.log(`Dropping 1 SOL into ${solanaAddress}...`);

  const airdropSignature = await connection.requestAirdrop(
    publicKey,
    LAMPORTS_PER_SOL,
  );
  const confirmationStrategy = await getConfirmationStrategy(
    connection,
    airdropSignature,
  );

  await connection.confirmTransaction(confirmationStrategy);

  print(
    "\nSuccess! ✅",
    `Explorer link: https://explorer.solana.com/address/${solanaAddress}?cluster=devnet`,
  );
}

export async function broadcast(
  connection: Connection,
  signedTransaction: Transaction | VersionedTransaction,
) {
  let signature: Uint8Array;

  if ("version" in signedTransaction) {
    // VersionedTransaction
    signature = signedTransaction.signatures[0]!;
  } else {
    // Legacy Transaction - signatures are stored as SignaturePubkeyPair objects
    const sig = signedTransaction.signatures[0];
    if (!sig || !sig.signature) {
      throw new Error("Transaction is not signed");
    }
    signature = sig.signature;
  }

  const confirmationStrategy = await getConfirmationStrategy(
    connection,
    bs58.encode(signature),
  );
  const transactionHash = await sendAndConfirmRawTransaction(
    connection,
    Buffer.from(signedTransaction.serialize()),
    confirmationStrategy,
    { commitment: "confirmed" },
  );
  print(
    "Transaction broadcast and confirmed! 🎉",
    `https://explorer.solana.com/tx/${transactionHash}?cluster=devnet`,
  );

  return transactionHash;
}

export async function recentBlockhash(connection: Connection): Promise<string> {
  const blockhash = await connection.getLatestBlockhash();
  return blockhash.blockhash;
}

export async function getConfirmationStrategy(
  connection: Connection,
  signature: string,
): Promise<TransactionConfirmationStrategy> {
  const latestBlockHash = await connection.getLatestBlockhash();

  return {
    blockhash: latestBlockHash.blockhash,
    lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
    signature,
  };
}

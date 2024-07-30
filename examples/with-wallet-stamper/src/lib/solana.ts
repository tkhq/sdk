import {
  PublicKey,
  SystemProgram,
  Transaction,
  Connection,
} from '@solana/web3.js';
import { TurnkeyClient } from '@turnkey/http';

import { TurnkeySigner } from '@turnkey/solana';

export async function recentBlockhash(): Promise<string> {
  const connection = new Connection(
    'https://api.devnet.solana.com',
    'confirmed'
  );
  const blockhash = await connection.getLatestBlockhash();
  return blockhash.blockhash;
}

/**
 * Creates a Solana transfer and signs it with Turnkey.
 * @param signer
 * @param fromAddress
 * @param toAddress
 * @param amount amount to send in LAMPORTS (one SOL = 1000000000 LAMPS)
 */
// export async function createAndSignTransfer(input: {
//   signer: TurnkeySigner;
//   fromAddress: string;
//   toAddress: string;
//   amount: number;
// }): Promise<Transaction> {
//   const { signer, fromAddress, toAddress, amount } = input;

//   const connection = solanaNetwork.connect();

//   const turnkeyClient = new TurnkeyClient(
//     { baseUrl: process.env.BASE_URL! },
//     new ApiKeyStamper({
//       apiPublicKey: process.env.API_PUBLIC_KEY!,
//       apiPrivateKey: process.env.API_PRIVATE_KEY!,
//     })
//   );

//   const turnkeySigner = new TurnkeySigner({
//     organizationId,
//     client: turnkeyClient,
//   });

//   const fromKey = new PublicKey(fromAddress);
//   const toKey = new PublicKey(toAddress);

//   const transferTransaction = new Transaction().add(
//     SystemProgram.transfer({
//       fromPubkey: fromKey,
//       toPubkey: toKey,
//       lamports: amount,
//     })
//   );

//   // Get a recent block hash
//   transferTransaction.recentBlockhash = await recentBlockhash();
//   // Set the signer
//   transferTransaction.feePayer = fromKey;

//   await signer.addSignature(transferTransaction, fromAddress);

//   return transferTransaction;
// }

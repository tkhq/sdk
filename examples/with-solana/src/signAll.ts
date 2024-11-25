import * as dotenv from "dotenv";
import * as path from "path";
import nacl from "tweetnacl";
import bs58 from "bs58";
import prompts from "prompts";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import {
  PublicKey,
  SystemProgram,
  VersionedTransaction,
  Transaction,
  TransactionMessage,
} from "@solana/web3.js";

import { Turnkey } from "@turnkey/sdk-server";
import { TurnkeySigner } from "@turnkey/solana";

import { solanaNetwork } from "./utils";

const TURNKEY_WAR_CHEST = "tkhqC9QX2gkqJtUFk2QKhBmQfFyyqZXSpr73VFRi35C";

async function main() {
  const organizationId = process.env.ORGANIZATION_ID!;

  const connection = solanaNetwork.connect();
  const blockhash = await solanaNetwork.recentBlockhash();

  const turnkeyClient = new Turnkey({
    apiBaseUrl: process.env.BASE_URL!,
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    defaultOrganizationId: organizationId,
  });

  const turnkeySigner = new TurnkeySigner({
    organizationId,
    client: turnkeyClient.apiClient(),
  });

  // Arbitrary number of transactions
  const numTxs = 3;

  // Each transaction will come from one address
  // Populate each of these values and fund them with sufficient SOL
  const addresses = [
    process.env.SOLANA_ADDRESS_1!,
    process.env.SOLANA_ADDRESS_2!,
    process.env.SOLANA_ADDRESS_3!,
  ];

  const requests = Array.from({ length: numTxs }, async (_, index) => {
    const solAddress = addresses[index]!;
    
    const { destination } = await prompts([
      {
        type: "text",
        name: "destination",
        message: `${index + 1} Destination address:`,
        initial: TURNKEY_WAR_CHEST,
      },
    ]);

    // Amount defaults to 100.
    // Any other amount is possible, so long as a sufficient balance remains for fees.
    const { amount } = await prompts([
      {
        type: "text",
        name: "amount",
        message: `${
          index + 1
        }. Amount (in Lamports) to send to ${TURNKEY_WAR_CHEST}:`,
        initial: "100",
        validate: function () {
          // Not checking balances; just assume valid
          return true;
        },
      },
    ]);

    const fromKey = new PublicKey(solAddress);
    const toKey = new PublicKey(destination);

    const txMessage = new TransactionMessage({
      payerKey: fromKey,
      recentBlockhash: blockhash,
      instructions: [
        SystemProgram.transfer({
          fromPubkey: fromKey,
          toPubkey: toKey,
          lamports: Number(amount),
        }),
      ],
    });

    const versionedTxMessage = txMessage.compileToV0Message();

    // Use VersionedTransaction
    const transferTransaction = new VersionedTransaction(versionedTxMessage);

    return turnkeySigner.signAllTransactions([transferTransaction], solAddress);
  });

  const promiseResults = await Promise.allSettled(requests);

  const successfulRequests = promiseResults
    .filter(
      (result): result is PromiseFulfilledResult<(Transaction | VersionedTransaction)[]> =>
        result.status === "fulfilled"
    )
    .map((result) => result.value);

  const signedTransactions = successfulRequests;

  // Iterate through all signed transactions, verify, and broadcast them
  for (let i = 0; i < signedTransactions.length; i++) {
    const signedTransaction = signedTransactions[i]![0]! as VersionedTransaction;
    const solAddress = addresses[i]!;

    const isValidSignature = nacl.sign.detached.verify(
      signedTransaction.message.serialize(),
      signedTransaction.signatures[0]!,
      bs58.decode(solAddress)
    );

    if (!isValidSignature) {
      throw new Error("unable to verify transaction signatures");
    }

    await solanaNetwork.broadcast(connection, signedTransaction);
  }

  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

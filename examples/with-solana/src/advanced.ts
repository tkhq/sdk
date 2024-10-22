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
  TransactionMessage,
} from "@solana/web3.js";

import { Turnkey } from "@turnkey/sdk-server";
import { TurnkeySigner } from "@turnkey/solana";

import { createNewSolanaWallet, solanaNetwork } from "./utils";

const TURNKEY_WAR_CHEST = "tkhqC9QX2gkqJtUFk2QKhBmQfFyyqZXSpr73VFRi35C";

async function main() {
  const organizationId = process.env.ORGANIZATION_ID!;

  const connection = solanaNetwork.connect();

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

  let solAddress = process.env.SOLANA_ADDRESS!;
  if (!solAddress) {
    solAddress = await createNewSolanaWallet(turnkeyClient.apiClient());
    console.log(`\nYour new Solana address: "${solAddress}"`);
  } else {
    console.log(`\nUsing existing Solana address from ENV: "${solAddress}"`);
  }

  let balance = await solanaNetwork.balance(connection, solAddress);
  while (balance === 0) {
    console.log(
      [
        `\n💸 Your onchain balance is at 0! To continue this demo you'll need devnet funds! You can use:`,
        `- The faucet in this example: \`pnpm run faucet\``,
        `- The official Solana CLI: \`solana airdrop 1 ${solAddress}\``,
        `- Any online faucet (e.g. https://faucet.solana.com)`,
        `\nTo check your balance: https://explorer.solana.com/address/${solAddress}?cluster=devnet`,
        `\n--------`,
      ].join("\n")
    );
    // Await user confirmation to continue
    await prompts([
      {
        type: "confirm",
        name: "ready",
        message: "Ready to Continue?",
      },
    ]);

    // refresh balance...
    balance = await solanaNetwork.balance(connection, solAddress);
  }

  const { numTxsStr } = await prompts([
    {
      type: "text",
      name: "numTxsStr",
      message: `Number of transactions:`,
      initial: "1",
    },
  ]);

  const numTxs = parseInt(numTxsStr);

  const unsignedTxs = new Array<VersionedTransaction>();

  for (let i = 0; i < numTxs; i++) {
    const destination = await prompts([
      {
        type: "text",
        name: "destination",
        message: `${i + 1}. Destination address:`,
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
          i + 1
        }. Amount (in Lamports) to send to ${TURNKEY_WAR_CHEST}:`,
        initial: "100",
        validate: function (str) {
          var n = Math.floor(Number(str));
          if (n !== Infinity && String(n) === str && n > 0) {
            // valid int was passed in
            if (n + 5000 > balance) {
              return `insufficient balance: current balance (${balance}) is less than ${
                n + 5000 * numTxs
              } (amount + 5000 lamports per tx for fee)`;
            }
            return true;
          } else {
            return "amount must be a strictly positive integer";
          }
        },
      },
    ]);

    const fromKey = new PublicKey(solAddress);
    const toKey = new PublicKey(destination);
    const blockhash = await solanaNetwork.recentBlockhash();

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

    unsignedTxs.push(transferTransaction);
  }

  const signedTransactions = (await turnkeySigner.signAllTransactions(
    unsignedTxs,
    solAddress
  )) as VersionedTransaction[];

  for (let i = 0; i < signedTransactions.length; i++) {
    const isValidSignature = nacl.sign.detached.verify(
      signedTransactions[i]!.message.serialize(),
      signedTransactions[i]!.signatures[0]!,
      bs58.decode(solAddress)
    );

    if (!isValidSignature) {
      throw new Error("unable to verify transaction signatures");
    }

    // 3. Broadcast the signed payload on devnet
    await solanaNetwork.broadcast(connection, signedTransactions[i]!);
  }

  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

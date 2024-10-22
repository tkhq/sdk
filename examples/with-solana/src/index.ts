import * as dotenv from "dotenv";
import * as path from "path";
import nacl from "tweetnacl";
import bs58 from "bs58";
import prompts from "prompts";
import { Transaction } from "@solana/web3.js";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import {
  getSignatureFromActivity,
  type TActivity,
  getSignedTransactionFromActivity,
} from "@turnkey/http";
import { Turnkey } from "@turnkey/sdk-server";
import { TurnkeySigner } from "@turnkey/solana";
import {
  createNewSolanaWallet,
  handleActivityError,
  solanaNetwork,
  signMessage,
  print,
} from "./utils";
import { createTransfer } from "./utils/createSolanaTransfer";

const TURNKEY_WAR_CHEST = "tkhqC9QX2gkqJtUFk2QKhBmQfFyyqZXSpr73VFRi35C";

async function main() {
  const organizationId = process.env.ORGANIZATION_ID!;

  const connection = solanaNetwork.connect();

  const turnkeyClient = new Turnkey({
    apiBaseUrl: process.env.BASE_URL!,
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    defaultOrganizationId: organizationId,
    // The following config is useful in contexts where an activity requires consensus.
    // By default, if the activity is not initially successful, it will poll a maximum
    // of 3 times with an interval of 1000 milliseconds. Otherwise, use the values below.
    //
    // -----
    //
    // activityPoller: {
    //   intervalMs: 5_000,
    //   numRetries: 10,
    // },
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
        `- Any online faucet (e.g. https://faucet.solana.com/)`,
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

  print("SOL balance:", `${balance} Lamports`);

  // 1. Sign and verify a message
  const { message } = await prompts([
    {
      type: "text",
      name: "message",
      message: "Message to sign",
      initial: "Hello Turnkey",
    },
  ]);
  const messageAsUint8Array = Buffer.from(message);

  let signature;
  try {
    signature = await signMessage({
      signer: turnkeySigner,
      fromAddress: solAddress,
      message,
    });
  } catch (error: any) {
    signature = await handleActivityError(turnkeyClient, error).then(
      (activity?: TActivity) => {
        if (!activity) {
          throw error;
        }

        const { r, s } = getSignatureFromActivity(activity);
        return Buffer.from(`${r}${s}`, "hex");
      }
    );
  }

  const isValidSignature = nacl.sign.detached.verify(
    messageAsUint8Array,
    signature,
    bs58.decode(solAddress)
  );

  if (!isValidSignature) {
    throw new Error("unable to verify signed message");
  }

  print("Turnkey-powered signature:", `${bs58.encode(signature)}`);

  // 2. Create, sign, and verify a transfer transaction
  const { destination } = await prompts([
    {
      name: "destination",
      type: "text",
      message: `Destination address:`,
      initial: TURNKEY_WAR_CHEST,
    },
  ]);

  // Amount defaults to 100.
  // Any other amount is possible.
  const { amount } = await prompts([
    {
      name: "amount",
      type: "text",
      message: `Amount (in Lamports) to send to ${TURNKEY_WAR_CHEST}:`,
      initial: "100",
      validate: function (str) {
        var n = Math.floor(Number(str));
        if (n !== Infinity && String(n) === str && n > 0) {
          // valid int was passed in
          if (n + 5000 > balance) {
            return `insufficient balance: current balance (${balance}) is less than ${
              n + 5000
            } (amount + 5000 for fee)`;
          }
          return true;
        } else {
          return "amount must be a strictly positive integer";
        }
      },
    },
  ]);

  const transaction = await createTransfer({
    fromAddress: solAddress,
    toAddress: destination,
    amount: Number(amount),
    version: "legacy",
  });

  let signedTransaction: Transaction | undefined = undefined; // legacy
  try {
    signedTransaction = (await turnkeySigner.signTransaction(
      transaction,
      solAddress
    )) as Transaction;
  } catch (error: any) {
    await handleActivityError(turnkeyClient, error).then(
      (activity?: TActivity) => {
        if (!activity) {
          throw error;
        }

        const decodedTransaction = Buffer.from(
          getSignedTransactionFromActivity(activity),
          "hex"
        );
        signedTransaction = Transaction.from(decodedTransaction);
      }
    );
  }

  const verified = signedTransaction!.verifySignatures();

  if (!verified) {
    throw new Error("unable to verify transaction signatures");
  }

  // 3. Broadcast the signed payload on devnet
  await solanaNetwork.broadcast(connection, signedTransaction!);

  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

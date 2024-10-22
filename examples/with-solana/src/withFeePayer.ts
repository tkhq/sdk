import * as dotenv from "dotenv";
import * as path from "path";
import prompts from "prompts";
import { VersionedTransaction } from "@solana/web3.js";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import {
  type TActivity,
  getSignedTransactionFromActivity,
} from "@turnkey/http";
import { Turnkey } from "@turnkey/sdk-server";
import { TurnkeySigner } from "@turnkey/solana";
import {
  createNewSolanaWallet,
  createTransfer,
  handleActivityError,
  solanaNetwork,
  print,
} from "./utils";

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

  let feePayerAddress = process.env.SOLANA_ADDRESS_FEE_PAYER!;
  if (!feePayerAddress) {
    feePayerAddress = await createNewSolanaWallet(turnkeyClient.apiClient());
    console.log(`\nYour new Solana address: "${feePayerAddress}"`);
  } else {
    console.log(
      `\nUsing existing Solana address from ENV: "${feePayerAddress}"`
    );
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

  // 1. Create, sign, and verify a transfer transaction
  const { destination } = await prompts([
    {
      type: "text",
      name: "destination",
      message: `Destination address:`,
      initial: TURNKEY_WAR_CHEST,
    },
  ]);

  // Amount defaults to 100.
  // Any other amount is possible.
  const { amount } = await prompts([
    {
      type: "text",
      name: "amount",
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
    version: "v0",
    feePayerAddress,
  });

  let signedTransaction: VersionedTransaction | undefined = undefined; // v0

  // First, sign with sender
  try {
    signedTransaction = (await turnkeySigner.signTransaction(
      transaction,
      solAddress
    )) as VersionedTransaction;
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
        signedTransaction =
          VersionedTransaction.deserialize(decodedTransaction);
      }
    );
  }

  // Next, sign with fee payer
  try {
    signedTransaction = (await turnkeySigner.signTransaction(
      signedTransaction!,
      feePayerAddress
    )) as VersionedTransaction;
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
        signedTransaction =
          VersionedTransaction.deserialize(decodedTransaction);
      }
    );
  }

  // 3. Broadcast the signed payload on devnet
  await solanaNetwork.broadcast(connection, signedTransaction!);

  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

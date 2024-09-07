import * as dotenv from "dotenv";
import * as path from "path";
import { input, confirm } from "@inquirer/prompts";
import type { Transaction } from "@solana/web3.js";

import { Turnkey } from "@turnkey/sdk-server";
import { TurnkeySigner } from "@turnkey/solana";

const TURNKEY_WAR_CHEST = "tkhqC9QX2gkqJtUFk2QKhBmQfFyyqZXSpr73VFRi35C";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { createNewSolanaWallet, solanaNetwork } from "./utils";
import { createTransfer } from "./utils/createSolanaTransfer";

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
    // of 3 times with an interval of 1000 milliseconds.
    //
    // -----
    //
    activityPoller: {
      intervalMs: 10_000,
      numRetries: 5,
    },
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
    await confirm({ message: "Ready to Continue?" });
    // refresh balance...
    balance = await solanaNetwork.balance(connection, solAddress);
  }

  const destination = await input({
    message: `Destination address:`,
    default: TURNKEY_WAR_CHEST,
  });

  // Amount defaults to current balance - 5000
  // Any other amount is possible.
  const amount = await input({
    message: `Amount (in Lamports) to send to ${TURNKEY_WAR_CHEST}:`,
    default: `${balance - 5000}`,
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
  });

  // 1. Create, sign, and verify a transfer transaction
  const transaction = await createTransfer({
    fromAddress: solAddress,
    toAddress: destination,
    amount: Number(amount),
    version: "legacy",
  });

  await turnkeySigner.addSignature(transaction, solAddress);

  const verified = (transaction as Transaction).verifySignatures();

  if (!verified) {
    throw new Error("unable to verify transaction signatures");
  }

  // 2. Broadcast the signed payload on devnet
  await solanaNetwork.broadcast(connection, transaction);

  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

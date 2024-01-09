import * as dotenv from "dotenv";
import * as path from "path";
import { TurnkeyClient } from "@turnkey/http";
import { ApiKeyStamper } from "@turnkey/api-key-stamper";

const TURNKEY_WAR_CHEST = "tkhqC9QX2gkqJtUFk2QKhBmQfFyyqZXSpr73VFRi35C";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { createNewSolanaWallet } from "./createSolanaWallet";
import * as solanaNetwork from "./solanaNetwork";
import { createAndSignTransfer } from "./createSolanaTransfer";
import { input, confirm } from "@inquirer/prompts";

async function main() {
  const organizationId = process.env.ORGANIZATION_ID!;

  const connection = solanaNetwork.connect();

  const turnkeyClient = new TurnkeyClient(
    { baseUrl: process.env.BASE_URL! },
    new ApiKeyStamper({
      apiPublicKey: process.env.API_PUBLIC_KEY!,
      apiPrivateKey: process.env.API_PRIVATE_KEY!,
    })
  );

  let solAddress = process.env.SOLANA_ADDRESS;
  if (!solAddress) {
    solAddress = await createNewSolanaWallet(
      turnkeyClient,
      organizationId
    );
    console.log(`\nYour new Solana address: "${solAddress}"`);
  } else {
    console.log(`\nUsing existing Solana address from ENV: "${solAddress}"`);
  }

  let balance = await solanaNetwork.balance(connection, solAddress);
  while (balance === 0) {
    console.log(
      `\n💸 Your onchain balance is at 0! To continue this demo you'll need devnet funds! You can use:`
    );
    console.log(`- The faucet in this example: \`pnpm run faucet\``);
    console.log(
      `- The official Solana CLI: \`solana airdrop 1 ${solAddress}\``
    );
    console.log(
      `- Any online faucet (e.g. https://faucet.triangleplatform.com/solana/devnet)`
    );
    console.log(
      `\nTo check your balance: https://explorer.solana.com/address/${solAddress}?cluster=devnet`
    );
    console.log("\n--------");
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

  // Create a transfer transaction
  const signedTransaction = await createAndSignTransfer({
    client: turnkeyClient,
    fromAddress: solAddress,
    toAddress: destination,
    amount: Number(amount),
    turnkeyOrganizationId: organizationId,
    turnkeySolAddress: solAddress,
  });

  // Broadcast the signed payload on devnet
  await solanaNetwork.broadcast(connection, signedTransaction);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

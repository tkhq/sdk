import * as dotenv from "dotenv";
import * as path from "path";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { input, confirm } from "@inquirer/prompts";

import { TurnkeyClient } from "@turnkey/http";
import { ApiKeyStamper } from "@turnkey/api-key-stamper";
import { TurnkeySigner } from "@turnkey/solana";

const TURNKEY_WAR_CHEST = "tkhqC9QX2gkqJtUFk2QKhBmQfFyyqZXSpr73VFRi35C";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import {
  createNewSolanaWallet,
  solanaNetwork,
  createAndSignTransfer,
  signMessage,
  print,
} from "./utils";

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

  const turnkeySigner = new TurnkeySigner({
    organizationId,
    client: turnkeyClient,
  });

  let solAddress = process.env.SOLANA_ADDRESS!;
  if (!solAddress) {
    solAddress = await createNewSolanaWallet(turnkeyClient, organizationId);
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
        `- Any online faucet (e.g. https://faucet.triangleplatform.com/solana/devnet)`,
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

  // 1. Sign and verify a message
  const message = "Hello world!";
  const messageAsUint8Array = Buffer.from(message);

  const signature = await signMessage({
    signer: turnkeySigner,
    fromAddress: solAddress,
    message,
  });

  const isValidSignature = nacl.sign.detached.verify(
    messageAsUint8Array,
    signature,
    bs58.decode(solAddress)
  );

  if (!isValidSignature) {
    throw new Error("unable to verify signed message");
  }

  print("\nTurnkey-powered signature:", `${bs58.encode(signature)}`);

  // 2. Create, sign, and verify a transfer transaction
  const signedTransaction = await createAndSignTransfer({
    signer: turnkeySigner,
    fromAddress: solAddress,
    toAddress: destination,
    amount: Number(amount),
  });

  const verified = signedTransaction.verifySignatures();

  if (!verified) {
    throw new Error("unable to verify transaction signatures");
  }

  // 3. Broadcast the signed payload on devnet
  await solanaNetwork.broadcast(connection, signedTransaction);

  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

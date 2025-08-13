import * as dotenv from "dotenv";
import * as path from "path";
import nacl from "tweetnacl";
import bs58 from "bs58";
import prompts from "prompts";

import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";

import {
  Actions,
  createEd25519AuthorityInfo,
  findSwigPda,
  getCreateSwigInstruction,
  fetchSwig,
  getAddAuthorityInstructions,
} from "@swig-wallet/classic";

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
  const defaultDestination = TURNKEY_WAR_CHEST;

  // Create a node connection; if no env var is found, default to public devnet RPC
  const nodeEndpoint =
    process.env.SOLANA_NODE || "https://api.devnet.solana.com";
  const connection = solanaNetwork.connect(nodeEndpoint);
  const network: "devnet" | "mainnet" = "devnet";

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
        `\n💸 Your onchain balance is at 0! To continue this demo you'll need funds! You can use:`,
        `- The faucet in this example: \`pnpm run faucet\``,
        `- The official Solana CLI: \`solana airdrop 1 ${solAddress}\``,
        `- Any online faucet (e.g. https://faucet.solana.com/)`,
        `\nTo check your balance: https://explorer.solana.com/address/${solAddress}?cluster=${network}`,
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
      initial: defaultDestination,
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
    connection,
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

  // 3. Broadcast the signed payload
  await solanaNetwork.broadcast(connection, signedTransaction!);

  process.exit(0);
}

async function createSwigAccount(connection: Connection, user: Keypair) {
  try {
    const id = new Uint8Array(32); // this should probably be tied to the suborg key / some identifier
    crypto.getRandomValues(id);
    const swigAddress = findSwigPda(id);
    const rootAuthorityInfo = createEd25519AuthorityInfo(user.publicKey); // this is the end-user suborg wallet key (for now)
    const rootActions = Actions.set().manageAuthority().get(); // TODO: investigate manageAuthority

    const createSwigIx = await getCreateSwigInstruction({
      payer: user.publicKey,
      id,
      actions: rootActions,
      authorityInfo: rootAuthorityInfo,
    });

    const transaction = new Transaction().add(createSwigIx);
    const signature = await sendAndConfirmTransaction(connection, transaction, [
      user,
    ]);

    console.log("✓ Swig account created at:", swigAddress.toBase58());
    console.log("Transaction signature:", signature);
    return swigAddress;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

async function addNewAuthority(
  connection: Connection,
  rootUser: Keypair, // end-user suborg key
  newAuthority: Keypair,
  swigAddress: PublicKey,
  actions: any,
  description: string
) {
  try {
    const swig = await fetchSwig(connection, swigAddress);

    const rootRole = swig.findRolesByEd25519SignerPk(rootUser.publicKey)[0];
    if (!rootRole) {
      throw new Error("Root role not found for authority");
    }

    const addAuthorityInstructions = await getAddAuthorityInstructions(
      swig,
      rootRole.id,
      createEd25519AuthorityInfo(newAuthority.publicKey), // in-browser session key
      actions
    );

    const transaction = new Transaction().add(...addAuthorityInstructions);
    await sendAndConfirmTransaction(connection, transaction, [rootUser]);
    console.log(
      "done"
      // chalk.green(`✓ New ${description} authority added:`),
      // chalk.cyan(newAuthority.publicKey.toBase58())
    );
  } catch (error) {
    console.error(
      "error"
      // chalk.red(`✗ Error adding ${description} authority:`),
      // chalk.red(error)
    );
    throw error;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

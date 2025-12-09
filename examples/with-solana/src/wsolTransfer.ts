import * as dotenv from "dotenv";
import * as path from "path";
import prompts from "prompts";
import {
  Transaction,
  SystemProgram,
  PublicKey,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  createAssociatedTokenAccountInstruction,
  createSyncNativeInstruction,
  createTransferInstruction,
  getAssociatedTokenAddress,
  NATIVE_MINT,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import {
  getSignedTransactionFromActivity,
  type TActivity,
} from "@turnkey/http";
import { Turnkey } from "@turnkey/sdk-server";
import { TurnkeySigner } from "@turnkey/solana";
import {
  createNewSolanaWallet,
  handleActivityError,
  solanaNetwork,
  print,
} from "./utils";

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
      ].join("\n"),
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

  const fromPubkey = new PublicKey(solAddress);

  // Get the associated token account address for WSOL
  const wsolTokenAccount = await getAssociatedTokenAddress(
    NATIVE_MINT,
    fromPubkey,
  );

  console.log(`\nWrapped SOL token account: ${wsolTokenAccount.toBase58()}`);

  // Amount to wrap (in Lamports)
  const { wrapAmount } = await prompts([
    {
      name: "wrapAmount",
      type: "text",
      message: "Amount of SOL to wrap (in Lamports):",
      initial: "1000000", // 0.001 SOL
      validate: function (str) {
        var n = Math.floor(Number(str));
        if (n !== Infinity && String(n) === str && n > 0) {
          // valid int was passed in
          if (n + 10000 > balance) {
            return `insufficient balance: current balance (${balance}) is less than ${
              n + 10000
            } (amount + 10000 for fees)`;
          }
          return true;
        } else {
          return "amount must be a strictly positive integer";
        }
      },
    },
  ]);

  // Step 1: Create and wrap SOL to WSOL
  console.log(
    `\n📦 Wrapping ${Number(wrapAmount) / LAMPORTS_PER_SOL} SOL to WSOL...`,
  );

  const wrapTransaction = new Transaction();

  // Check if the WSOL token account already exists
  const accountInfo = await connection.getAccountInfo(wsolTokenAccount);

  if (!accountInfo) {
    console.log("Creating associated token account for WSOL...");
    // Create the associated token account
    wrapTransaction.add(
      createAssociatedTokenAccountInstruction(
        fromPubkey, // payer
        wsolTokenAccount, // associated token account
        fromPubkey, // owner
        NATIVE_MINT, // mint
      ),
    );
  } else {
    console.log("WSOL token account already exists");
  }

  // Transfer SOL to the WSOL account
  wrapTransaction.add(
    SystemProgram.transfer({
      fromPubkey,
      toPubkey: wsolTokenAccount,
      lamports: Number(wrapAmount),
    }),
  );

  // Sync the native account (this converts the SOL to WSOL)
  wrapTransaction.add(createSyncNativeInstruction(wsolTokenAccount));

  // Set transaction properties
  const { blockhash } = await connection.getLatestBlockhash();
  wrapTransaction.recentBlockhash = blockhash;
  wrapTransaction.feePayer = fromPubkey;

  // Sign the wrap transaction
  let signedWrapTransaction: Transaction | undefined = undefined;
  try {
    signedWrapTransaction = (await turnkeySigner.signTransaction(
      wrapTransaction,
      solAddress,
    )) as Transaction;
  } catch (error: any) {
    await handleActivityError(turnkeyClient, error).then(
      (activity?: TActivity) => {
        if (!activity) {
          throw error;
        }

        const decodedTransaction = Buffer.from(
          getSignedTransactionFromActivity(activity),
          "hex",
        );
        signedWrapTransaction = Transaction.from(decodedTransaction);
      },
    );
  }

  if (!signedWrapTransaction) {
    throw new Error("Failed to sign wrap transaction");
  }

  const verified = signedWrapTransaction.verifySignatures();
  if (!verified) {
    throw new Error("unable to verify wrap transaction signatures");
  }

  // Broadcast the wrap transaction
  await solanaNetwork.broadcast(connection, signedWrapTransaction);
  console.log("✅ Successfully wrapped SOL to WSOL");

  // Step 2: Transfer WSOL
  const { destination } = await prompts([
    {
      name: "destination",
      type: "text",
      message: `Destination address for WSOL transfer:`,
      initial: defaultDestination,
    },
  ]);

  const { transferAmount } = await prompts([
    {
      name: "transferAmount",
      type: "text",
      message: `Amount of WSOL to transfer (in Lamports):`,
      initial: wrapAmount, // Default to the wrapped amount
      validate: function (str) {
        var n = Math.floor(Number(str));
        if (n !== Infinity && String(n) === str && n > 0) {
          if (n > Number(wrapAmount)) {
            return `insufficient WSOL balance: you wrapped ${wrapAmount} Lamports`;
          }
          return true;
        } else {
          return "amount must be a strictly positive integer";
        }
      },
    },
  ]);

  console.log(
    `\n💸 Transferring ${Number(transferAmount) / LAMPORTS_PER_SOL} WSOL to ${destination}...`,
  );

  const destinationPubkey = new PublicKey(destination);

  // Get or create the destination's WSOL token account
  const destinationWsolAccount = await getAssociatedTokenAddress(
    NATIVE_MINT,
    destinationPubkey,
  );

  const transferTransaction = new Transaction();

  // Check if destination's WSOL account exists
  const destAccountInfo = await connection.getAccountInfo(
    destinationWsolAccount,
  );

  if (!destAccountInfo) {
    console.log(
      "Creating associated token account for destination address...",
    );
    transferTransaction.add(
      createAssociatedTokenAccountInstruction(
        fromPubkey, // payer
        destinationWsolAccount, // associated token account
        destinationPubkey, // owner
        NATIVE_MINT, // mint
      ),
    );
  }

  // Add the transfer instruction
  transferTransaction.add(
    createTransferInstruction(
      wsolTokenAccount, // from
      destinationWsolAccount, // to
      fromPubkey, // owner of source account
      Number(transferAmount), // amount
      [], // multisig signers
      TOKEN_PROGRAM_ID,
    ),
  );

  // Set transaction properties
  const { blockhash: transferBlockhash } =
    await connection.getLatestBlockhash();
  transferTransaction.recentBlockhash = transferBlockhash;
  transferTransaction.feePayer = fromPubkey;

  // Sign the transfer transaction
  let signedTransferTransaction: Transaction | undefined = undefined;
  try {
    signedTransferTransaction = (await turnkeySigner.signTransaction(
      transferTransaction,
      solAddress,
    )) as Transaction;
  } catch (error: any) {
    await handleActivityError(turnkeyClient, error).then(
      (activity?: TActivity) => {
        if (!activity) {
          throw error;
        }

        const decodedTransaction = Buffer.from(
          getSignedTransactionFromActivity(activity),
          "hex",
        );
        signedTransferTransaction = Transaction.from(decodedTransaction);
      },
    );
  }

  if (!signedTransferTransaction) {
    throw new Error("Failed to sign transfer transaction");
  }

  const transferVerified = signedTransferTransaction.verifySignatures();
  if (!transferVerified) {
    throw new Error("unable to verify transfer transaction signatures");
  }

  // Broadcast the transfer transaction
  await solanaNetwork.broadcast(connection, signedTransferTransaction);
  console.log("✅ Successfully transferred WSOL");

  console.log(
    `\n🔍 View your transaction on Solana Explorer: https://explorer.solana.com/address/${solAddress}?cluster=${network}`,
  );

  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

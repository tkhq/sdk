import * as dotenv from "dotenv";
import * as path from "path";
import prompts from "prompts";
import { Connection, Transaction, PublicKey } from "@solana/web3.js";
import {
  getAccount,
  getAssociatedTokenAddress,
  getMint,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  TokenAccountNotFoundError,
} from "@solana/spl-token";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { Turnkey, v1Activity } from "@turnkey/sdk-server";
import { TurnkeySigner } from "@turnkey/solana";
import {
  constructTokenTransfer,
  createNewSolanaWallet,
  handleActivityError,
  solanaNetwork,
  print,
  TURNKEY_WAR_CHEST,
} from "./utils";

// Circle's USDC on devnet, used when SPL_MINT isn't set
const DEFAULT_DEVNET_MINT = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";

async function main() {
  const organizationId = process.env.ORGANIZATION_ID!;
  const defaultDestination = TURNKEY_WAR_CHEST;

  // Create a node connection; if no env var is found, default to public devnet RPC
  const nodeEndpoint =
    process.env.SOLANA_NODE || "https://api.devnet.solana.com";
  const connection = solanaNetwork.connect(nodeEndpoint);
  // Used for explorer links: set SOLANA_NODE to a mainnet RPC to send on mainnet
  const network: "devnet" | "mainnet" = nodeEndpoint.includes("mainnet")
    ? "mainnet"
    : "devnet";
  const clusterParam = network === "mainnet" ? "" : "?cluster=devnet";

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

  // The sender pays the network fee (and the rent for any new token account) in SOL
  let balance = await solanaNetwork.balance(connection, solAddress);
  while (balance === 0) {
    console.log(
      [
        `\n💸 Your onchain balance is at 0! To continue this demo you'll need funds! You can use:`,
        `- The faucet in this example: \`pnpm run faucet\``,
        `- The official Solana CLI: \`solana airdrop 1 ${solAddress}\``,
        `- Any online faucet (e.g. https://faucet.solana.com/)`,
        `\nTo check your balance: https://explorer.solana.com/address/${solAddress}${clusterParam}`,
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

  // Look up the token: its mint account tells us which token program it uses and its decimals
  const mint = new PublicKey(process.env.SPL_MINT || DEFAULT_DEVNET_MINT);
  const mintAccountInfo = await connection.getAccountInfo(mint);
  if (!mintAccountInfo) {
    throw new Error(`mint ${mint.toBase58()} not found on ${network}`);
  }

  const programId = mintAccountInfo.owner;
  if (
    !programId.equals(TOKEN_PROGRAM_ID) &&
    !programId.equals(TOKEN_2022_PROGRAM_ID)
  ) {
    throw new Error(`${mint.toBase58()} is not an SPL token mint`);
  }

  const { decimals } = await getMint(connection, mint, undefined, programId);
  print(
    "Token mint:",
    `${mint.toBase58()} (${decimals} decimals, ${
      programId.equals(TOKEN_2022_PROGRAM_ID) ? "Token-2022" : "Token"
    } program)`,
  );

  const fromPubkey = new PublicKey(solAddress);

  // A wallet holds a token in its associated token account (ATA), derived from the wallet and the mint
  const fromTokenAccount = await getAssociatedTokenAddress(
    mint,
    fromPubkey,
    false,
    programId,
  );

  let tokenBalance = await getTokenBalance(
    connection,
    fromTokenAccount,
    programId,
  );
  while (tokenBalance === 0n) {
    console.log(
      [
        `\n💸 Your balance of this token is at 0! To continue this demo you'll need some! You can:`,
        `- For devnet USDC (the default mint), use Circle's faucet: https://faucet.circle.com/`,
        `- Or run \`pnpm token-transfer\` and set SPL_MINT to the mint it creates (see its token creation transaction in the explorer)`,
        `\nTo check your balance: https://explorer.solana.com/address/${solAddress}${clusterParam}`,
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
    tokenBalance = await getTokenBalance(
      connection,
      fromTokenAccount,
      programId,
    );
  }

  print("Token balance:", formatAmount(tokenBalance, decimals));

  const { destination } = await prompts([
    {
      name: "destination",
      type: "text",
      message: `Destination address:`,
      initial: defaultDestination,
      validate: function (str) {
        let pubkey: PublicKey;
        try {
          pubkey = new PublicKey(str);
        } catch {
          return "destination must be a valid Solana address";
        }
        // Token accounts are off-curve addresses: tokens must be sent to the wallet that owns them
        if (!PublicKey.isOnCurve(pubkey.toBytes())) {
          return "enter the wallet address, not a token account";
        }
        return true;
      },
    },
  ]);

  const { amount } = await prompts([
    {
      name: "amount",
      type: "text",
      message: `Amount of tokens to transfer:`,
      initial: "1",
      validate: function (str) {
        // Tokens with 0 decimals (e.g. NFTs) only accept whole numbers
        const amountRegex =
          decimals > 0 ? new RegExp(`^\\d+(\\.\\d{1,${decimals}})?$`) : /^\d+$/;
        if (!amountRegex.test(str) || parseAmount(str, decimals) === 0n) {
          return decimals > 0
            ? `amount must be a positive number with at most ${decimals} decimals`
            : "amount must be a positive whole number";
        }
        if (parseAmount(str, decimals) > tokenBalance) {
          return `insufficient balance: current balance is ${formatAmount(tokenBalance, decimals)}`;
        }
        return true;
      },
    },
  ]);

  const destinationPubkey = new PublicKey(destination);

  // Get the destination's associated token account address
  const destinationTokenAccount = await getAssociatedTokenAddress(
    mint,
    destinationPubkey,
    false,
    programId,
  );

  // Check if the destination's token account exists
  const destAccountInfo = await connection.getAccountInfo(
    destinationTokenAccount,
  );

  if (!destAccountInfo) {
    // The sender pays a one-time rent deposit (in SOL) to open the recipient's token account
    console.log(
      "Creating associated token account for destination address (rent paid by sender)...",
    );
  } else {
    console.log("Destination token account already exists");
  }

  // Confirm before building and signing, so nothing is signed if you cancel
  // (a transaction's blockhash expires after about a minute, so it's built right before sending)
  const { confirm } = await prompts([
    {
      type: "confirm",
      name: "confirm",
      message: `Send ${amount} tokens to ${destination}?`,
      initial: true,
    },
  ]);

  if (!confirm) {
    console.log("Transfer cancelled.");
    process.exit(0);
  }

  const transferTransaction = await constructTokenTransfer(
    connection,
    fromTokenAccount,
    mint,
    destinationTokenAccount,
    solAddress,
    {
      amount: parseAmount(amount, decimals),
      decimals,
      programId,
      ...(destAccountInfo ? {} : { recipientOwner: destinationPubkey }),
    },
  );

  // Sign the transfer transaction
  // Sign Transaction passes the transaction through the policy engine, allowing Solana related policies to apply
  let signedTransferTransaction: Transaction | undefined = undefined;
  try {
    signedTransferTransaction = (await turnkeySigner.signTransaction(
      transferTransaction,
      solAddress,
    )) as Transaction;
  } catch (error: any) {
    await handleActivityError(turnkeyClient, error).then(
      (activity?: v1Activity) => {
        if (!activity) {
          throw error;
        }

        const decodedTransaction = Buffer.from(
          activity.result!.signTransactionResult!.signedTransaction,
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
  console.log(`\n💸 Transferring ${amount} tokens to ${destination}...`);
  await solanaNetwork.broadcast(connection, signedTransferTransaction, network);
  console.log("✅ Successfully transferred tokens");

  process.exit(0);
}

// Returns the balance (in base units) of a token account, or 0 if the account doesn't exist yet
async function getTokenBalance(
  connection: Connection,
  tokenAccount: PublicKey,
  programId: PublicKey,
): Promise<bigint> {
  try {
    const account = await getAccount(
      connection,
      tokenAccount,
      undefined,
      programId,
    );
    return account.amount;
  } catch (error) {
    if (error instanceof TokenAccountNotFoundError) {
      return 0n;
    }
    throw error;
  }
}

// Converts a token amount string (e.g. "1.5") to base units (e.g. 1_500_000n for 6 decimals)
function parseAmount(amount: string, decimals: number): bigint {
  const [whole = "0", fraction = ""] = amount.split(".");
  return BigInt(whole + fraction.padEnd(decimals, "0"));
}

// Converts base units (e.g. 1_500_000n for 6 decimals) to a token amount string (e.g. "1.5")
function formatAmount(amount: bigint, decimals: number): string {
  const base = 10n ** BigInt(decimals);
  const whole = amount / base;
  const fraction = (amount % base)
    .toString()
    .padStart(decimals, "0")
    .replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : `${whole}`;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

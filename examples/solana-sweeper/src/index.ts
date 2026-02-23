import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import {
  Connection,
  PublicKey,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  getAccount,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  TokenAccountNotFoundError,
} from "@solana/spl-token";
import prompts from "prompts";
import { getTurnkeyClient, pollTransactionStatus } from "./turnkey";
import { toReadableAmount, lamportsToSol } from "./utils";
import { type SplToken, USDC_DEVNET, USDC_MAINNET } from "./tokens";

const SOLANA_NETWORKS = {
  mainnet: {
    rpc: "https://api.mainnet-beta.solana.com",
    caip2: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
    tokens: [USDC_MAINNET],
    explorerBase: "https://explorer.solana.com/tx",
    explorerSuffix: "",
  },
  devnet: {
    rpc: "https://api.devnet.solana.com",
    caip2: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
    tokens: [USDC_DEVNET],
    explorerBase: "https://explorer.solana.com/tx",
    explorerSuffix: "?cluster=devnet",
  },
} as const;

type SolanaNetwork = keyof typeof SOLANA_NETWORKS;

async function main() {
  const organizationId = process.env.ORGANIZATION_ID!;
  const signWith = process.env.SIGN_WITH!;
  const destination = process.env.DESTINATION_ADDRESS!;
  const networkEnv = (process.env.SOLANA_NETWORK ?? "mainnet").toLowerCase();

  if (networkEnv !== "mainnet" && networkEnv !== "devnet") {
    console.error(
      `Invalid SOLANA_NETWORK "${networkEnv}". Must be "mainnet" or "devnet".`,
    );
    process.exit(1);
  }

  const network = SOLANA_NETWORKS[networkEnv as SolanaNetwork];

  if (!organizationId || !signWith || !destination) {
    console.error(
      "Missing required environment variables. Please check your .env.local file.",
    );
    console.error("Required: ORGANIZATION_ID, SIGN_WITH, DESTINATION_ADDRESS");
    console.error("Optional: SOLANA_NETWORK (mainnet|devnet)");
    process.exit(1);
  }

  const turnkey = getTurnkeyClient();
  const connection = new Connection(network.rpc, "confirmed");

  const balance = await connection.getBalance(new PublicKey(signWith));

  console.log("Address:", signWith);
  console.log("SOL Balance:", lamportsToSol(balance));

  let sponsor = false;
  const { useSponsor } = await prompts({
    type: "confirm",
    name: "useSponsor",
    message: "Use Turnkey gas sponsorship for sweep transactions?",
    initial: false,
  });
  sponsor = !!useSponsor;

  if (!sponsor && balance === 0) {
    console.warn("Not enough SOL for transaction fees.");
    return;
  }

  await sweepTokens(
    turnkey,
    organizationId,
    signWith,
    destination,
    [...network.tokens],
    sponsor,
    connection,
    network,
  );
  await sweepSol(
    turnkey,
    organizationId,
    signWith,
    destination,
    sponsor,
    connection,
    network,
  );
}

async function sweepTokens(
  turnkey: any,
  organizationId: string,
  signWith: string,
  destination: string,
  tokens: SplToken[],
  sponsor: boolean,
  connection: Connection,
  network: (typeof SOLANA_NETWORKS)[SolanaNetwork],
) {
  const ownerPubkey = new PublicKey(signWith);
  const destPubkey = new PublicKey(destination);

  for (const token of tokens) {
    const mintPubkey = new PublicKey(token.mint);
    const sourceAta = getAssociatedTokenAddressSync(mintPubkey, ownerPubkey);

    let balance: bigint;
    try {
      const account = await getAccount(connection, sourceAta);
      balance = account.amount;
    } catch (err) {
      if (err instanceof TokenAccountNotFoundError) {
        console.log(`No ${token.symbol} account found. Skipping...`);
        continue;
      }
      throw err;
    }

    if (balance === 0n) {
      console.log(`No ${token.symbol}. Skipping...`);
      continue;
    }

    const { confirmed } = await prompts({
      type: "confirm",
      name: "confirmed",
      message: `Transfer ${toReadableAmount(balance, token.decimals)} ${token.symbol} to ${destination}?`,
    });

    if (!confirmed) continue;

    const destAta = getAssociatedTokenAddressSync(mintPubkey, destPubkey);

    const instructions = [];

    // Create destination ATA if it doesn't exist
    const destAccountInfo = await connection.getAccountInfo(destAta);
    if (!destAccountInfo) {
      instructions.push(
        createAssociatedTokenAccountInstruction(
          ownerPubkey,
          destAta,
          destPubkey,
          mintPubkey,
        ),
      );
    }

    instructions.push(
      createTransferInstruction(sourceAta, destAta, ownerPubkey, balance),
    );

    const { blockhash } = await connection.getLatestBlockhash();

    const txMessage = new TransactionMessage({
      payerKey: ownerPubkey,
      recentBlockhash: blockhash,
      instructions,
    });

    const versionedTx = new VersionedTransaction(
      txMessage.compileToV0Message(),
    );
    const unsignedTransaction = Buffer.from(versionedTx.serialize()).toString(
      "hex",
    );

    const { sendTransactionStatusId } = await turnkey
      .apiClient()
      .solSendTransaction({
        organizationId,
        unsignedTransaction,
        signWith,
        caip2: network.caip2,
        sponsor,
      });

    const status = await pollTransactionStatus({
      apiClient: turnkey.apiClient(),
      organizationId,
      sendTransactionStatusId,
    });

    if (status.txStatus !== "INCLUDED" && status.txStatus !== "COMPLETED") {
      throw new Error(
        `${token.symbol} sweep failed with status: ${status.txStatus}`,
      );
    }

    console.log(
      `Sent ${token.symbol}: ${network.explorerBase}/${status.eth?.txHash}${network.explorerSuffix}`,
    );
  }
}

async function sweepSol(
  turnkey: any,
  organizationId: string,
  signWith: string,
  destination: string,
  sponsor: boolean,
  connection: Connection,
  network: (typeof SOLANA_NETWORKS)[SolanaNetwork],
) {
  const ownerPubkey = new PublicKey(signWith);
  const balance = BigInt(await connection.getBalance(ownerPubkey));

  // Reserve ~5000 lamports for the transaction fee when not sponsored
  const fee = sponsor ? 0n : 5000n;
  const value = balance - fee;

  if (value <= 0n) {
    console.warn("Not enough SOL to sweep.");
    return;
  }

  const { confirmed } = await prompts({
    type: "confirm",
    name: "confirmed",
    message: `Sweep ${lamportsToSol(value)} SOL to ${destination}?`,
  });

  if (!confirmed) return;

  const { blockhash } = await connection.getLatestBlockhash();

  const txMessage = new TransactionMessage({
    payerKey: ownerPubkey,
    recentBlockhash: blockhash,
    instructions: [
      SystemProgram.transfer({
        fromPubkey: ownerPubkey,
        toPubkey: new PublicKey(destination),
        lamports: value,
      }),
    ],
  });

  const versionedTx = new VersionedTransaction(txMessage.compileToV0Message());
  const unsignedTransaction = Buffer.from(versionedTx.serialize()).toString(
    "hex",
  );

  const { sendTransactionStatusId } = await turnkey
    .apiClient()
    .solSendTransaction({
      organizationId,
      unsignedTransaction,
      signWith,
      caip2: network.caip2,
      sponsor,
    });

  const status = await pollTransactionStatus({
    apiClient: turnkey.apiClient(),
    organizationId,
    sendTransactionStatusId,
  });

  if (status.txStatus !== "INCLUDED" && status.txStatus !== "COMPLETED") {
    throw new Error(`SOL sweep failed with status: ${status.txStatus}`);
  }

  console.log(
    `Sent SOL: ${network.explorerBase}/${status.eth?.txHash}${network.explorerSuffix}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

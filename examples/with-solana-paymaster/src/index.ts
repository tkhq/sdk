import * as path from "path";
import * as dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import {
  Connection,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  TokenAccountNotFoundError,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import prompts from "prompts";
import { getTurnkeyClient, pollTransactionStatus } from "./turnkey";
import { parseTokenAmount, toReadableAmount } from "./utils";
import { type SplToken, USDC_DEVNET, USDC_MAINNET } from "./tokens";

const SOLANA_NETWORKS = {
  mainnet: {
    rpc: "https://api.mainnet-beta.solana.com",
    caip2: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
    token: USDC_MAINNET,
    explorerSuffix: "",
  },
  devnet: {
    rpc: "https://api.devnet.solana.com",
    caip2: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG",
    token: USDC_DEVNET,
    explorerSuffix: "?cluster=devnet",
  },
} as const;

type SolanaNetwork = keyof typeof SOLANA_NETWORKS;

async function main() {
  const organizationId = process.env.ORGANIZATION_ID!;
  const signWith = process.env.SIGN_WITH!;
  const networkEnv = (process.env.SOLANA_NETWORK ?? "mainnet").toLowerCase();

  if (networkEnv !== "mainnet" && networkEnv !== "devnet") {
    throw new Error(
      `Invalid SOLANA_NETWORK "${networkEnv}". Must be "mainnet" or "devnet".`,
    );
  }
  if (!organizationId || !signWith) {
    throw new Error("Missing ORGANIZATION_ID or SIGN_WITH");
  }

  const network = SOLANA_NETWORKS[networkEnv as SolanaNetwork];
  const connection = new Connection(network.rpc, "confirmed");

  const senderAddress = new PublicKey(signWith);
  const turnkey = getTurnkeyClient();
  const mintPubkey = new PublicKey(network.token.mint);

  const transferParams = await getTransferParams(network.token);
  if (!transferParams) {
    console.log("Transfer cancelled.");
    return;
  }

  const { recipientAddress, amount, amountInput } = transferParams;
  const recipient = new PublicKey(recipientAddress);

  console.log(`\nSender: ${senderAddress.toBase58()}`);
  console.log(`Recipient: ${recipient.toBase58()}`);
  console.log(`Amount: ${amountInput} ${network.token.symbol}`);
  console.log("Sponsored: yes\n");

  const sourceAta = getAssociatedTokenAddressSync(mintPubkey, senderAddress);
  const destinationAta = getAssociatedTokenAddressSync(mintPubkey, recipient);

  let sourceBalance: bigint;
  try {
    sourceBalance = (await getAccount(connection, sourceAta)).amount;
  } catch (error) {
    if (error instanceof TokenAccountNotFoundError) {
      throw new Error(
        `Sender does not have a ${network.token.symbol} token account.`,
      );
    }
    throw error;
  }

  if (sourceBalance < amount) {
    throw new Error(
      `Insufficient ${network.token.symbol} balance. Available: ${toReadableAmount(sourceBalance, network.token.decimals, 6)}`,
    );
  }

  const { proceed } = await prompts({
    type: "confirm",
    name: "proceed",
    message: `Send ${amountInput} ${network.token.symbol} to ${recipientAddress} with sponsorship?`,
    initial: true,
  });
  if (!proceed) {
    console.log("Transfer cancelled.");
    return;
  }

  const instructions = [];
  const destinationAccountInfo =
    await connection.getAccountInfo(destinationAta);
  if (!destinationAccountInfo) {
    instructions.push(
      createAssociatedTokenAccountInstruction(
        senderAddress,
        destinationAta,
        recipient,
        mintPubkey,
      ),
    );
  }
  instructions.push(
    createTransferInstruction(sourceAta, destinationAta, senderAddress, amount),
  );

  const { blockhash } = await connection.getLatestBlockhash();
  const txMessage = new TransactionMessage({
    payerKey: senderAddress,
    recentBlockhash: blockhash,
    instructions,
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
      signWith: senderAddress.toBase58(),
      caip2: network.caip2,
      sponsor: true,
    });

  const status = await pollTransactionStatus({
    apiClient: turnkey.apiClient(),
    organizationId,
    sendTransactionStatusId,
  });

  console.log("Transfer sent.");
  console.log(
    `Tx: https://explorer.solana.com/tx/${status.eth?.txHash}${network.explorerSuffix}`,
  );
}

async function getTransferParams(token: SplToken): Promise<
  | {
      recipientAddress: string;
      amountInput: string;
      amount: bigint;
    }
  | undefined
> {
  const { recipient, amountInput } = await prompts([
    {
      type: "text",
      name: "recipient",
      message: "Recipient address:",
    },
    {
      type: "text",
      name: "amountInput",
      message: `Amount of ${token.symbol} to send:`,
      initial: "0.1",
    },
  ]);

  if (!recipient || !amountInput) {
    return undefined;
  }

  return {
    recipientAddress: new PublicKey(recipient).toBase58(),
    amountInput,
    amount: parseTokenAmount(amountInput, token.decimals),
  };
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

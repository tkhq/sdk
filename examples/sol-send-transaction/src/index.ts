import * as path from "path";
import * as dotenv from "dotenv";
import * as crypto from "crypto";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import {
  Connection,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { getTurnkeyClient, pollTransactionStatus } from "./turnkey";

const SOLANA_MAINNET_RPC = "https://api.mainnet-beta.solana.com";
const SOLANA_MAINNET_CAIP2 = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";

// USDC on Solana mainnet
const DEFAULT_TOKEN_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

async function main() {
  const organizationId = process.env.ORGANIZATION_ID!;
  const signWith = process.env.SIGN_WITH!;
  const tokenMintAddress = process.env.TOKEN_MINT_ADDRESS ?? DEFAULT_TOKEN_MINT;

  if (!organizationId || !signWith) {
    console.error(
      "Missing required environment variables. Please check your .env.local file."
    );
    console.error("Required: ORGANIZATION_ID, SIGN_WITH");
    console.error("Optional: TOKEN_MINT_ADDRESS (defaults to USDC)");
    process.exit(1);
  }

  const client = getTurnkeyClient();
  const connection = new Connection(SOLANA_MAINNET_RPC, "confirmed");

  // Create a fresh Solana wallet via Turnkey so the ATA owner is a new address every time
  const walletName = `SOL ATA Owner ${crypto.randomBytes(2).toString("hex")}`;
  console.log(`Creating new Solana wallet "${walletName}" via Turnkey...`);

  const { activity } = await client.createWallet({
    type: "ACTIVITY_TYPE_CREATE_WALLET",
    timestampMs: String(Date.now()),
    organizationId,
    parameters: {
      walletName,
      accounts: [
        {
          pathFormat: "PATH_FORMAT_BIP32",
          path: "m/44'/501'/0'/0'",
          curve: "CURVE_ED25519",
          addressFormat: "ADDRESS_FORMAT_SOLANA",
        },
      ],
    },
  });

  const walletResult = activity.result.createWalletResult;
  if (!walletResult?.walletId || !walletResult.addresses?.[0]) {
    throw new Error("Failed to create wallet — missing walletId or address");
  }

  const newAddress = walletResult.addresses[0];
  console.log(`New wallet created: ${newAddress} (wallet ID: ${walletResult.walletId})\n`);

  const owner = new PublicKey(newAddress);
  const payer = new PublicKey(signWith);
  const mint = new PublicKey(tokenMintAddress);

  // Derive the ATA address for this new owner + mint
  const ata = getAssociatedTokenAddressSync(mint, owner);

  console.log("Solana Sponsored ATA Creation Example");
  console.log("======================================");
  console.log(`Payer:       ${payer.toBase58()} (signs the tx)`);
  console.log(`ATA Owner:   ${owner.toBase58()} (fresh address)`);
  console.log(`Token Mint:  ${mint.toBase58()}`);
  console.log(`ATA Address: ${ata.toBase58()}`);
  console.log("");

  const balance = await connection.getBalance(payer);
  console.log(`Payer SOL balance: ${balance / LAMPORTS_PER_SOL} SOL`);
  console.log("Using sponsored transaction (fees + rent paid by paymaster)");

  // Build unsigned transaction with createAssociatedTokenAccountInstruction
  console.log("\nBuilding unsigned ATA creation transaction...");

  const { blockhash } = await connection.getLatestBlockhash();

  const txMessage = new TransactionMessage({
    payerKey: payer,
    recentBlockhash: blockhash,
    instructions: [
      createAssociatedTokenAccountInstruction(
        payer, // payer (will be replaced by paymaster)
        ata,   // associated token account to create
        owner, // owner of the new ATA (fresh address)
        mint   // token mint
      ),
    ],
  });

  const versionedTx = new VersionedTransaction(txMessage.compileToV0Message());

  // Serialize to hex for the API
  const unsignedTransaction = Buffer.from(versionedTx.serialize()).toString(
    "hex"
  );

  console.log("Transaction built successfully.");
  console.log(`Blockhash: ${blockhash}`);

  // Send via Turnkey with sponsorship
  console.log("\nSending sponsored transaction via Turnkey...");

  const result = await client.solSendTransaction({
    type: "ACTIVITY_TYPE_SOL_SEND_TRANSACTION",
    timestampMs: String(Date.now()),
    organizationId,
    parameters: {
      unsignedTransaction,
      signWith,
      caip2: SOLANA_MAINNET_CAIP2,
      sponsor: true,
    },
  });

  const sendTransactionStatusId =
    result.activity.result.solSendTransactionResult?.sendTransactionStatusId;

  if (!sendTransactionStatusId) {
    throw new Error("No sendTransactionStatusId returned");
  }

  console.log(`Transaction submitted. Status ID: ${sendTransactionStatusId}`);

  // Poll for confirmation
  const status = await pollTransactionStatus({
    client,
    organizationId,
    sendTransactionStatusId,
  });

  console.log(`\nTransaction ${status.txStatus}!`);
  if (status.txHash) {
    console.log(`Explorer: https://explorer.solana.com/tx/${status.txHash}`);
  }

  // Verify the ATA was created
  const newAtaInfo = await connection.getAccountInfo(ata);
  if (newAtaInfo) {
    console.log(`\nATA created successfully at ${ata.toBase58()}`);
    console.log(`ATA account size: ${newAtaInfo.data.length} bytes`);
  }

  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

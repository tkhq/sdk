import * as dotenv from "dotenv";
import * as path from "path";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { confirm } from "@inquirer/prompts";
import { PublicKey, Transaction } from "@solana/web3.js";
import {
  getAccount,
  createMintToCheckedInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddress,
} from "@solana/spl-token";

import { TurnkeyClient } from "@turnkey/http";
import { ApiKeyStamper } from "@turnkey/api-key-stamper";
import { TurnkeySigner } from "@turnkey/solana";

import {
  createNewSolanaWallet,
  createToken,
  createTokenAccount,
  solanaNetwork,
  TURNKEY_WAR_CHEST,
} from "./utils";

async function main() {
  const turnkeyWarchest = new PublicKey(TURNKEY_WAR_CHEST);

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

  const fromKey = new PublicKey(solAddress);

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

  // Create SPL token
  const { mintAuthority } = await createToken(
    turnkeySigner,
    connection,
    solAddress
  );

  // Now mint
  // calculate ATA
  let ata = await getAssociatedTokenAddress(
    mintAuthority.publicKey, // mint
    fromKey // owner
  );
  console.log(`ATA: ${ata.toBase58()}`);

  // calculate ATA for warchest as well
  let ataWarchest = await getAssociatedTokenAddress(
    mintAuthority.publicKey, // mint
    turnkeyWarchest // owner
  );
  console.log(`ATA Warchest: ${ataWarchest.toBase58()}`);

  // For warchest
  await createTokenAccount(
    turnkeySigner,
    connection,
    solAddress,
    ataWarchest,
    mintAuthority
  );

  const tokenAccountWarchest = await getAccount(connection, ataWarchest);
  console.log("Token account created for Warchest");

  // For self
  await createTokenAccount(
    turnkeySigner,
    connection,
    solAddress,
    ata,
    mintAuthority
  );

  const tokenAccount = await getAccount(connection, ata);
  console.log("Token account created for self");

  const mintTx = new Transaction().add(
    createMintToCheckedInstruction(
      mintAuthority.publicKey, // mint
      tokenAccount.address, // receiver (should be a token account)
      fromKey, // mint authority
      1e8, // amount. if your decimals is 8, you mint 10^8 for 1 token.
      8 // decimals
      // [signer1, signer2 ...], // only multisig account will use
    )
  );

  // Get a recent block hash
  mintTx.recentBlockhash = await solanaNetwork.recentBlockhash();
  // Set the signer
  mintTx.feePayer = fromKey;

  const _signedMintTx = await turnkeySigner.addSignature(mintTx, solAddress);

  await solanaNetwork.broadcast(connection, mintTx);

  let transferTx = new Transaction().add(
    createTransferCheckedInstruction(
      tokenAccount.address, // from (should be a token account)
      mintAuthority.publicKey, // mint
      tokenAccountWarchest.address, // to (should be a token account)
      fromKey, // from's owner
      1e4, // amount, if your deciamls is 8, send 10^8 for 1 token
      8 // decimals
    )
  );

  // Get a recent block hash
  transferTx.recentBlockhash = await solanaNetwork.recentBlockhash();
  // Set the signer
  transferTx.feePayer = fromKey;

  const _signedTransferTx = await turnkeySigner.addSignature(
    transferTx,
    solAddress
  );

  await solanaNetwork.broadcast(connection, transferTx);

  const tokenAmount = await connection.getTokenAccountBalance(
    tokenAccount.address
  );
  console.log("Token amount", tokenAmount);

  const tokenAmountWarchest = await connection.getTokenAccountBalance(
    ataWarchest
  );
  console.log("Token amount warchest", tokenAmountWarchest);

  // ideally, send back to TURNKEY_WAR_CHEST

  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

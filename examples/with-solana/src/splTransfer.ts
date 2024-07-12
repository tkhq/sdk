import * as dotenv from "dotenv";
import * as path from "path";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { input, confirm } from "@inquirer/prompts";
import {
  PublicKey,
  SystemProgram,
  Transaction,
  Keypair,
} from "@solana/web3.js";
// import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  getAccount,
  createMint,
  getOrCreateAssociatedTokenAccount,
  createMintToCheckedInstruction,
  createTransferCheckedInstruction,
  createInitializeMintInstruction,
  mintTo,
  getMint,
  createTransferInstruction,
  getMinimumBalanceForRentExemptMint,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

import { TurnkeyClient } from "@turnkey/http";
import { ApiKeyStamper } from "@turnkey/api-key-stamper";
import { TurnkeySigner } from "@turnkey/solana";

import { createNewSolanaWallet } from "./createSolanaWallet";
import * as solanaNetwork from "./solanaNetwork";
// import { signTransfers } from "./createSolanaTransfer";

const TURNKEY_WAR_CHEST = "tkhqC9QX2gkqJtUFk2QKhBmQfFyyqZXSpr73VFRi35C";

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

  // 2) compose by yourself
  const mint = Keypair.generate();
  console.log(`mint: ${mint.publicKey.toBase58()}`);

  const alice = Keypair.generate();
  console.log(`another party: ${alice.publicKey.toBase58()}`);

  let tx = new Transaction().add(
    // create mint account
    SystemProgram.createAccount({
      fromPubkey: fromKey,
      newAccountPubkey: mint.publicKey,
      space: MINT_SIZE,
      lamports: await getMinimumBalanceForRentExemptMint(connection),
      programId: TOKEN_PROGRAM_ID,
    }),
    // init mint account
    createInitializeMintInstruction(
      mint.publicKey, // mint pubkey
      8, // decimals
      fromKey, // mint authority
      fromKey // freeze authority (you can use `null` to disable it. when you disable it, you can't turn it on again)
    )
  );

  // Get a recent block hash
  tx.recentBlockhash = await solanaNetwork.recentBlockhash();
  // Set the signer
  tx.feePayer = fromKey;

  tx.partialSign(mint);

  console.log("Transaction", tx);

  const _signedTransaction = await turnkeySigner.addSignature(tx, solAddress);
  await solanaNetwork.broadcast(connection, tx);

  let mintAccount = await getMint(connection, mint.publicKey);
  console.log("Mint Account", mintAccount);

  // Now mint
  // calculate ATA
  let ata = await getAssociatedTokenAddress(
    mint.publicKey, // mint
    fromKey // owner
  );
  console.log(`ATA: ${ata.toBase58()}`);

  // calculate ATA for alice as well
  let ataAlice = await getAssociatedTokenAddress(
    mint.publicKey, // mint
    alice.publicKey // owner
  );
  console.log(`ATA Alice: ${ataAlice.toBase58()}`);

  // For Alice
  const createTokenAccountTxAlice = new Transaction().add(
    createAssociatedTokenAccountInstruction(
      fromKey, // payer
      ataAlice, // ata
      alice.publicKey, // owner
      mint.publicKey // mint
    )
  );

  // Get a recent block hash
  createTokenAccountTxAlice.recentBlockhash =
    await solanaNetwork.recentBlockhash();
  // Set the signer
  createTokenAccountTxAlice.feePayer = fromKey;

  const _signedCreateTokenAccountTxAlice = await turnkeySigner.addSignature(
    createTokenAccountTxAlice,
    solAddress
  );

  // Takes care of broadcasting
  //   const broadcastedCreateTokenAccountTxAlice = await connection.sendTransaction(
  //     createTokenAccountTxAlice,
  //     [alice]
  //   );
  await solanaNetwork.broadcast(connection, createTokenAccountTxAlice);
  console.log(
    "Broadcasted token account creation",
    // broadcastedCreateTokenAccountTxAlice
  );

  const tokenAccountAlice = await getAccount(connection, ataAlice);
  console.log("Token account Alice", tokenAccountAlice);

  // if your wallet is off-curve, you should use
  // let ata = await getAssociatedTokenAddress(
  //   mintPubkey, // mint
  //   alice.publicKey // owner
  //   true, // allowOwnerOffCurve
  // );

  const createTokenAccountTx = new Transaction().add(
    createAssociatedTokenAccountInstruction(
      fromKey, // payer
      ata, // ata
      fromKey, // owner
      mint.publicKey // mint
    )
  );

  // Get a recent block hash
  createTokenAccountTx.recentBlockhash = await solanaNetwork.recentBlockhash();
  // Set the signer
  createTokenAccountTx.feePayer = fromKey;

  const _signedCreateTokenAccountTx = await turnkeySigner.addSignature(
    createTokenAccountTx,
    solAddress
  );

  await solanaNetwork.broadcast(connection, createTokenAccountTx);

  const tokenAccount = await getAccount(connection, ata);
  console.log("Token account", tokenAccount);

  const mintTx = new Transaction().add(
    createMintToCheckedInstruction(
      mint.publicKey, // mint
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
      mint.publicKey, // mint
      tokenAccountAlice.address, // to (should be a token account)
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

  const tokenAmountAlice = await connection.getTokenAccountBalance(
    tokenAccountAlice.address
  );
  console.log("Token amount Alice", tokenAmountAlice);

  // ideally, send back to TURNKEY_WAR_CHEST

  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

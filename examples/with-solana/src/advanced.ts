import * as dotenv from "dotenv";
import * as path from "path";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { input, confirm } from "@inquirer/prompts";
import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
// import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  createTransferInstruction,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

import { TurnkeyClient } from "@turnkey/http";
import { ApiKeyStamper } from "@turnkey/api-key-stamper";
import { TurnkeySigner } from "@turnkey/solana";

import { createNewSolanaWallet } from "./createSolanaWallet";
import * as solanaNetwork from "./solanaNetwork";
import { signTransfers } from "./createSolanaTransfer";

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

  const numTxs = parseInt(
    await input({
      message: `Number of transactions:`,
      default: "1",
    })
  );

  const unsignedTxs = new Array<Transaction>();

  for (let i = 0; i < numTxs; i++) {
    const destination = await input({
      message: `${i + 1}. Destination address:`,
      default: TURNKEY_WAR_CHEST,
    });

    // Amount defaults to current balance - (5000 * numTxs)
    // Any other amount is possible, so long as a sufficient balance remains for fees.
    const amount = await input({
      message: `${
        i + 1
      }. Amount (in Lamports) to send to ${TURNKEY_WAR_CHEST}:`,
      default: `${balance - 5000 * numTxs}`,
      validate: function (str) {
        var n = Math.floor(Number(str));
        if (n !== Infinity && String(n) === str && n > 0) {
          // valid int was passed in
          if (n + 5000 > balance) {
            return `insufficient balance: current balance (${balance}) is less than ${
              n + 5000 * numTxs
            } (amount + 5000 lamports per tx for fee)`;
          }
          return true;
        } else {
          return "amount must be a strictly positive integer";
        }
      },
    });

    const toKey = new PublicKey(destination);

    const transferTransaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: fromKey,
        toPubkey: toKey,
        lamports: Number(amount),
      })
    );

    // Get a recent block hash
    transferTransaction.recentBlockhash = await solanaNetwork.recentBlockhash();
    // Set the signer
    transferTransaction.feePayer = fromKey;

    unsignedTxs.push(transferTransaction);
  }

  // 2. Create, sign, and verify multiple transfer transactions
  const signedTransactions = await signTransfers({
    signer: turnkeySigner,
    fromAddress: solAddress,
    unsignedTxs,
  });

  for (let i = 0; i < signedTransactions.length; i++) {
    const verified = signedTransactions[i]!.verifySignatures();

    if (!verified) {
      throw new Error("unable to verify transaction signatures");
    }

    // 3. Broadcast each signed payload on devnet
    await solanaNetwork.broadcast(connection, signedTransactions[i]!);
  }

  // 4. Create, sign, and verify a SPL token transfer
  // Create new token mint
  const mint = await createMint(
    connection,
    turnkeySigner,
    fromKey,
    null,
    9,
  );
 
  // Get the token account of the fromWallet Solana address, if it does not exist, create it
  const fromTokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    fromWallet,
    mint,
    fromWallet.publicKey,
  );
 
  //get the token account of the toWallet Solana address, if it does not exist, create it
  const toTokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    fromWallet,
    mint,
    toWallet.publicKey,
  );
 
  // Minting 1 new token to the "fromTokenAccount" account we just returned/created
  await mintTo(
    connection,
    fromWallet,
    mint,
    fromTokenAccount.address,
    fromWallet.publicKey,
    1000000000, // it's 1 token, but in lamports
    [],
  );
 
  // Add token transfer instructions to transaction
  const transaction = new Transaction().add(
    createTransferInstruction(
      fromTokenAccount.address,
      toTokenAccount.address,
      fromWallet.publicKey,
      1,
    ),
  );
 
  // Sign transaction, broadcast, and confirm
  await sendAndConfirmTransaction(connection, transaction, [fromWallet]);

  process.exit(0);
}

async function createMint(
  connection: Connection,
  payer: Signer,
  mintAuthority: PublicKey,
  freezeAuthority: PublicKey | null,
  decimals: number,
  keypair = Keypair.generate(),
  confirmOptions?: ConfirmOptions,
  programId = TOKEN_PROGRAM_ID
): Promise<PublicKey> {
  const lamports = await getMinimumBalanceForRentExemptMint(connection);

  const transaction = new Transaction().add(
      SystemProgram.createAccount({
          fromPubkey: payer.publicKey,
          newAccountPubkey: keypair.publicKey,
          space: MINT_SIZE,
          lamports,
          programId,
      }),
      createInitializeMint2Instruction(keypair.publicKey, decimals, mintAuthority, freezeAuthority, programId)
  );

  await sendAndConfirmTransaction(connection, transaction, [payer, keypair], confirmOptions);

  return keypair.publicKey;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

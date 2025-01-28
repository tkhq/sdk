import * as dotenv from "dotenv";
import * as path from "path";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import prompts, { PromptType } from "prompts";
import { PublicKey } from "@solana/web3.js";
import { getAccount, getAssociatedTokenAddress } from "@solana/spl-token";

import { Turnkey } from "@turnkey/sdk-server";
import { TurnkeySigner } from "@turnkey/solana";

import {
  isKeyOfObject,
  createMint,
  createNewSolanaWallet,
  createToken,
  createTokenAccount,
  createTokenTransferSignTransaction,
  solanaNetwork,
  TURNKEY_WAR_CHEST,
} from "./utils";

import keys from "./keys";

import { createUser, createPolicy } from "./requests";

const commands: { [key: string]: {} } = {
  setup: {},
  "attempt-transfer": {},
  "create-token-policy": {},
};

async function main() {
  const args = process.argv.slice(2);
  if (!args.length) {
    throw new Error("Command is required");
  }

  const command = args[0];

  if (!isKeyOfObject(command!, commands)) {
    throw new Error(`Unknown command: ${command}`);
  }

  if (command == "setup") {
    if (args.length != 1) {
      throw new Error(`setup command should have no arguments`);
    }
    await setup();
  } else if (command == "attempt-transfer") {
    if (args.length != 1) {
      throw new Error(
        `attempt-transfer comand should have no initial arguments -- you will be prompted`,
      );
    }
    await attemptTransferToken();
  } else if (command == "create-token-policy") {
    if (args.length != 1) {
      throw new Error(
        `create-token-policy comand should have no initial arguments -- you will be prompted`,
      );
    }
    await createTokenPolicy();
  }
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

/*
 * The setup command creates the onchain state (new token mint, sending and receiving token address etc) required for this example
 * It also creates SOME of the Turnkey setup state required (new Turnkey managed Solana wallet (owner of the sending token address) and non-root user
 * NOTE: The setup command DOES NOT create the policy that allows the non root user to send SPL tokens to the correct associated token address
 * ^ the policy is created when you call create-token-policy
 */
async function setup() {
  const turnkeyWarchest = new PublicKey(TURNKEY_WAR_CHEST);
  const organizationId = process.env.ORGANIZATION_ID!;
  const connection = solanaNetwork.connect();

  // Root user API Client
  const rootUserClient = new Turnkey({
    apiBaseUrl: process.env.BASE_URL!,
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    defaultOrganizationId: organizationId,
  });

  // Root user Turnkey signer
  const rootUserSigner = new TurnkeySigner({
    organizationId,
    client: rootUserClient.apiClient(),
  });

  let solAddress = process.env.SOLANA_ADDRESS!;
  if (!solAddress) {
    solAddress = await createNewSolanaWallet(rootUserClient.apiClient());
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
        `- Any online faucet (e.g. https://faucet.solana.com/)`,
        `\nTo check your balance: https://explorer.solana.com/address/${solAddress}?cluster=devnet`,
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

  // Create SPL token
  const { mintAuthority } = await createToken(
    rootUserSigner,
    connection,
    solAddress,
  );

  // Create token accounts
  const ataPrimary = await getAssociatedTokenAddress(
    mintAuthority.publicKey, // mint
    fromKey, // owner
  );

  const ataWarchest = await getAssociatedTokenAddress(
    mintAuthority.publicKey, // mint
    turnkeyWarchest, // owner
  );

  // For warchest
  await createTokenAccount(
    rootUserSigner,
    connection,
    solAddress,
    ataWarchest,
    turnkeyWarchest,
    mintAuthority,
  );

  // For self
  await createTokenAccount(
    rootUserSigner,
    connection,
    solAddress,
    ataPrimary,
    fromKey,
    mintAuthority,
  );

  const tokenAccount = await getAccount(connection, ataPrimary);

  // Mint token
  await createMint(
    rootUserSigner,
    connection,
    solAddress,
    tokenAccount.address,
    mintAuthority.publicKey,
  );

  // Create non-root user
  let nonRootUserID = await createUser(
    rootUserClient.apiClient(),
    "Non Root User",
    "Non Root User Key",
    keys!.nonRootUser!.publicKey!,
  );

  console.log(
    "Setup complete -- token mint and token accounts created, non root user created",
  );
  console.log(`Turnkey Solana wallet address: ${solAddress}`);
  console.log(`Token Mint public key: ${mintAuthority.publicKey}`);
  console.log(`Non root user created with user id: ${nonRootUserID}`);
}

/*
 * The attemptTransferToken function runs the attempt-transfer command will attempt to make a token transfer using the created non-root user's API key credentials
 * It will prompt you for the following information:
 * - The originating Solana wallet address (not token address) that was created and printed out during the setup stage
 * - The token mint account address of the token being transferred, also created and printed out during the setup stage
 *
 * NOTE: This command IS EXPECTED TO FAIL IF the create-token-policy command has NOT been run to create the policy with the correct non-root user ID, and the correct token mint
 *
 * To best illustrate what is going on in this example, run this command once before and once after running the create-token-policy command
 */
async function attemptTransferToken() {
  let { solAddress } = await prompts([
    {
      type: "text" as PromptType,
      name: "solAddress",
      message:
        "Enter Solana wallet address originating transfer (created during setup stage):",
    },
  ]);
  solAddress = solAddress.trim();

  let { tokenMint } = await prompts([
    {
      type: "text" as PromptType,
      name: "tokenMint",
      message:
        "Enter Mint account address of token being transferred (created during setup stage):",
    },
  ]);
  tokenMint = tokenMint.trim();

  const turnkeyWarchest = new PublicKey(TURNKEY_WAR_CHEST);
  const organizationId = process.env.ORGANIZATION_ID!;
  const connection = solanaNetwork.connect();
  const tokenMintPublicKey = new PublicKey(tokenMint);
  const fromKey = new PublicKey(solAddress);

  // Create token accounts
  const ataPrimary = await getAssociatedTokenAddress(
    tokenMintPublicKey, // mint
    fromKey, // owner
  );

  const tokenAccountFrom = await getAccount(connection, ataPrimary);

  const ataWarchest = await getAssociatedTokenAddress(
    tokenMintPublicKey, // mint
    turnkeyWarchest, // owner
  );

  const tokenAccountWarchest = await getAccount(connection, ataWarchest);

  // Create non root user API Client
  const nonRootUserClient = new Turnkey({
    apiBaseUrl: process.env.BASE_URL!,
    apiPublicKey: keys!.nonRootUser!.publicKey!,
    apiPrivateKey: keys!.nonRootUser!.privateKey!,
    defaultOrganizationId: organizationId,
  });

  const nonRootUserSigner = new TurnkeySigner({
    organizationId,
    client: nonRootUserClient.apiClient(),
  });

  // Transfer token from primary to Warchest associated token account\
  // This call uses Turnkey's sign transaction endpoint which passes the transaction through the policy engine
  await createTokenTransferSignTransaction(
    nonRootUserSigner,
    connection,
    solAddress,
    tokenAccountFrom.address,
    tokenMintPublicKey,
    tokenAccountWarchest.address,
  );

  const tokenBalance = await connection.getTokenAccountBalance(ataPrimary);
  console.log("Token balance for user:", tokenBalance.value.uiAmountString);

  const tokenBalanceWarchest =
    await connection.getTokenAccountBalance(ataWarchest);
  console.log(
    "Token balance for warchest:",
    tokenBalanceWarchest.value.uiAmountString,
  );
}

/*
 * The createTokenPolicy function runs the create-token-policy command which creates the policy to allow the non root user to transfer the SPL token for this example
 * This command will prompt you for the following information:
 * - The non root user ID that was created and printed out during the setup stage
 * - The token mint account address of the token being transferred, also created and printed out during the setup stage
 *
 * NOTE: After running this command correctly, attempt-transfer (with the correct parameters) will work!
 *
 * To best illustrate what is going on in this example, run attemp-transfer once without running this command to see it fail, then run this command and run attempt-transfer AGAIN
 */
async function createTokenPolicy() {
  // Prompt user for the Non-root user created during setup
  let { nonRootUserID } = await prompts([
    {
      type: "text" as PromptType,
      name: "nonRootUserID",
      message:
        "Enter non-root user ID originating the transfer (created during setup stage):",
    },
  ]);
  nonRootUserID = nonRootUserID.trim();

  // Prompt user
  let { tokenMint } = await prompts([
    {
      type: "text" as PromptType,
      name: "tokenMint",
      message:
        "Enter Mint account address of token being transferred (created during setup stage):",
    },
  ]);
  tokenMint = tokenMint.trim();

  const organizationId = process.env.ORGANIZATION_ID!;
  const turnkeyWarchest = new PublicKey(TURNKEY_WAR_CHEST);
  const tokenMintPublicKey = new PublicKey(tokenMint);

  // IMPORTANT STEP
  // Here, given the mint address of the token being transferred, we calculate the Associated Token Address for the RECEIVING address (in this case, Warchest)
  // This is associated token address is what will be used to create the policy that allows transfers to the expected wallet address
  const ataWarchest = await getAssociatedTokenAddress(
    tokenMintPublicKey, // mint
    turnkeyWarchest, // owner
  );

  // Root user API Client
  const rootUserClient = new Turnkey({
    apiBaseUrl: process.env.BASE_URL!,
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    defaultOrganizationId: organizationId,
  });

  // Create policy to allow non root user to send a Solana transaction that only conains a SINGLE instruction --> one SPL token transfer to the Token account address for Warchest
  await createPolicy(
    rootUserClient.apiClient(),
    `Let non root user send SPL transfers to the associated token account of WARCHEST: ${ataWarchest.toString()} given the mint address for the token just created`,
    "EFFECT_ALLOW",
    `approvers.any(user, user.id == '${nonRootUserID}')`,
    `solana.tx.instructions.count() == 1 && solana.tx.spl_transfers.any(transfer, transfer.to == '${ataWarchest.toString()}')`,
    "",
  );
}

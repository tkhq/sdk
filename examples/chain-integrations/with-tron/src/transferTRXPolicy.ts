import { Turnkey } from "@turnkey/sdk-server";
import { TronWeb } from "tronweb";
import * as dotenv from "dotenv";
import * as path from "path";
import { generateP256KeyPair } from "@turnkey/crypto";

import createPolicy from "./requests/createPolicy";
import createUser from "./requests/createUser";

// load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  // initialize Turnkey client
  const turnkeyClient = new Turnkey({
    apiBaseUrl: "https://api.turnkey.com",
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    defaultOrganizationId: process.env.ORGANIZATION_ID!,
  });

  // create a policy allowing for transactions of at most 100 sun
  const policyName = "Tron Limit Amount Policy";
  const effect = "EFFECT_ALLOW";
  const consensus = `approvers.count() == 1`;
  const condition = "tron.tx.contract[0].amount <= 100";
  const notes = "This policy restricts transfer over 100 sun";

  await createPolicy(
    turnkeyClient.apiClient(),
    policyName,
    effect,
    consensus,
    condition,
    notes,
  );

  // create a non-root user to execute transactions that will abide by policy rules
  let keypair = generateP256KeyPair();
  let userName = "new-tron-user";
  let apiKeyName = "new-user-api-key";

  await createUser(
    turnkeyClient.apiClient(),
    userName,
    apiKeyName,
    keypair.publicKey,
  );

  // create a new client for the new user with their credentials
  const newUserTurnkeyClient = new Turnkey({
    apiBaseUrl: "https://api.turnkey.com",
    apiPrivateKey: keypair.privateKey,
    apiPublicKey: keypair.publicKey,
    defaultOrganizationId: process.env.ORGANIZATION_ID!,
  });

  // initialize TronWeb without a private key
  const tronWeb = new TronWeb({
    fullHost: "https://nile.trongrid.io/", // testnet
  });

  const turnkeyAddress = process.env.TRON_ADDRESS!; // your Tron address in Turnkey
  const recipientAddress = "TY1jfzP3s94oSzYECC89EFn17iA8S4imVZ";
  // use an amount where the policy will deny
  const amount = 101; // amount in SUN (1 TRX = 1,000,000 SUN)

  // create the unsigned transaction
  const unsignedTx = await tronWeb.transactionBuilder.sendTrx(
    recipientAddress,
    amount,
    turnkeyAddress,
  );

  console.log("Expecting to fail signing transaction...\n");

  try {
    // attempt to sign the transaction with the new unprivileged user
    await newUserTurnkeyClient.apiClient().signTransaction({
      signWith: turnkeyAddress,
      unsignedTransaction: unsignedTx.raw_data_hex,
      type: "TRANSACTION_TYPE_TRON",
    });
  } catch (e: any) {
    // this sign activity will fail because the amount exceeds whats allowed in the policy
    console.log("Failed to sign transaction:", e.message, "\n");
  }

  // set an amount that will be accepted by the policy
  const newAmount = 100;

  // create the new transaction
  const newUnsignedTx = await tronWeb.transactionBuilder.sendTrx(
    recipientAddress,
    newAmount,
    turnkeyAddress,
  );

  console.log("Expecting to succeed signing transaction...\n");

  try {
    // sign the transaction with the new unprivileged user and an allowed amount
    const signedTx = await newUserTurnkeyClient.apiClient().signTransaction({
      signWith: turnkeyAddress,
      unsignedTransaction: newUnsignedTx.raw_data_hex,
      type: "TRANSACTION_TYPE_TRON",
    });

    // broadcast the transaction
    const result = await tronWeb.trx.sendHexTransaction(
      signedTx.signedTransaction,
    );

    console.log("New transaction sent! ID:", result.txid);
    console.log("https://nile.tronscan.org/#/transaction/" + result.txid);
  } catch (e: any) {
    console.log("Failed to sign transaction:", e.message);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

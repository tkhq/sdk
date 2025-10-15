import { Turnkey } from "@turnkey/sdk-server";
import * as dotenv from "dotenv";
import * as path from "path";
import { generateP256KeyPair } from "@turnkey/crypto";
import * as bitcoin from "bitcoinjs-lib";
import prompts, { PromptType } from "prompts";
import { isMainnet } from "./util";

import createPolicy from "./requests/createPolicy";
import createUser from "./requests/createUser";
import { createUnsignedPsbt } from "./createBtcTx";

// load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  const psbtCreateInfo = await createUnsignedPsbt();
  const unsignedPsbtHex = psbtCreateInfo.psbt.toHex();

  // initialize Turnkey client
  const turnkeyClient = new Turnkey({
    apiBaseUrl: "https://api.turnkey.com",
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    defaultOrganizationId: process.env.ORGANIZATION_ID!,
  });

  const sendingAddress = process.env.SOURCE_BITCOIN_ADDRESS;

  let { receivingTestnetBTCAddress } = await prompts([
    {
      type: "text" as PromptType,
      name: "receivingTestnetBTCAddress",
      message:
        "Enter receiving address to ALLOW signing via policy (to test failure case, enter something other than the receiving address that you entered while creating your PSBT):",
    },
  ]);
  receivingTestnetBTCAddress = receivingTestnetBTCAddress.trim();

  // create a policy allowing for transfer to a particular receiving address
  const policyName = `Bitcoin allow transfer to '${receivingTestnetBTCAddress}'`;
  const effect = "EFFECT_ALLOW";
  const consensus = `approvers.count() == 1`;
  /*
    Only allow transactions that have 2 outputs! 
    - One going being the allowlisted receiving address 
    - One being the sending address (change going back to sender)
  */
  const condition = `bitcoin.tx.outputs.count() == 2 && bitcoin.tx.outputs.all(o, o.address in ['${receivingTestnetBTCAddress}','${sendingAddress}'])`;
  const notes = "This policy only allows sending btc to new ";

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
  let userName = "new-bitcoin-user";
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

  try {
    // sign the transaction with the new unprivileged user and an allowed amount
    const signedTx = await newUserTurnkeyClient.apiClient().signTransaction({
      signWith: sendingAddress!,
      unsignedTransaction: unsignedPsbtHex,
      type: "TRANSACTION_TYPE_BITCOIN",
    });

    // parse the signed transaction return value into a psbt object
    const signedPsbt = bitcoin.Psbt.fromHex(signedTx.signedTransaction);
    const finalSignedTx = signedPsbt.finalizeAllInputs().extractTransaction();

    // To broadcast it: https://mempool.space/tx/push
    const broadcastUrl = isMainnet(psbtCreateInfo.network)
      ? "https://mempool.space/tx/push"
      : "https://mempool.space/testnet/tx/push";
    console.log(
      `✅ Transaction signed! To broadcast it, copy and paste the hex payload to ${broadcastUrl}`,
    );
    return finalSignedTx.toHex();
  } catch (error) {
    throw error;
  }
}

main()
  .then((res) => {
    console.log(res);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

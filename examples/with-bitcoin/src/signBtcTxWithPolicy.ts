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

  const sendingAddress = process.env.SOURCE_BITCOIN_ADDRESS;

  // contract address of usdt on Nile testnet, its different on mainnet!
  const receivingTestnetBTCAddress = "tb1qeln8v9chnchymmmgmad374z3qz598y3mahz7ws";

  // create a policy allowing for tether transfer
  const policyName = `Bitcoin allow transfer to '${receivingTestnetBTCAddress}'`;
  const effect = "EFFECT_ALLOW";
  const consensus = `approvers.count() == 1`;
  /*
    Only allow transactions that have 2 outputs! 
    - One going being the allowlisted receiving address 
    - One being the sending address (change going back to sender)
  */
  //const condition = `bitcoin.tx.outputs.count() == 2 && bitcoin.tx.outputs[0].address == '${receivingTestnetBTCAddress}' && bitcoin.tx.outputs[1].address == '${sendingAddress}'`;
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

  // initialize TronWeb without a private key
  const tronWeb = new TronWeb({
    fullHost: "https://nile.trongrid.io/", // testnet
  });

  const turnkeyAddress = process.env.TRON_ADDRESS!;
  // use an invalid address protected by the policy for the tether contract address
  const fakeUsdtContractAddress = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
  const recipientAddress = "TY1jfzP3s94oSzYECC89EFn17iA8S4imVZ";
  const amount = "100";
  const options = {
    from: turnkeyAddress,
    txLocal: true,
  };
  const parameters = [
    { type: "address", value: recipientAddress },
    { type: "uint256", value: amount },
  ];

  // create the TriggerSmartContract transaction
  const failureTriggerSmartContractTx =
    await tronWeb.transactionBuilder.triggerSmartContract(
      fakeUsdtContractAddress,
      "transfer(address,uint256)",
      options,
      parameters,
      options.from,
    );

  console.log("Expecting to fail signing transaction...");
  console.log();

  try {
    // attempt to sign the transaction with the new unprivileged user
    await newUserTurnkeyClient.apiClient().signTransaction({
      signWith: turnkeyAddress,
      unsignedTransaction:
        failureTriggerSmartContractTx.transaction.raw_data_hex,
      type: "TRANSACTION_TYPE_TRON",
    });
  } catch (e: any) {
    // this sign transaction activity will fail because the contract address is not the correct usdt contract address specified in the policy
    console.log("Failed to sign transaction:", e.message, "\n");
  }

  // create the new transaction with the proper usdt contract address
  const triggerSmartContractTx =
    await tronWeb.transactionBuilder.triggerSmartContract(
      usdtContractAddressNile,
      "transfer(address,uint256)",
      options,
      parameters,
      options.from,
    );

  console.log("Expecting to succeed signing transaction...\n");

  try {
    // sign the transaction with the new unprivileged user and an allowed amount
    const signedTx = await newUserTurnkeyClient.apiClient().signTransaction({
      signWith: turnkeyAddress,
      unsignedTransaction: triggerSmartContractTx.transaction.raw_data_hex,
      type: "TRANSACTION_TYPE_BITCOIN",
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

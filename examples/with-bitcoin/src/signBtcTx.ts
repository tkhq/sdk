import * as path from "path";
import * as dotenv from "dotenv";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import * as bitcoin from "bitcoinjs-lib";
import prompts, { PromptType } from "prompts";
import * as ecc from "tiny-secp256k1";
import { ECPairFactory } from "ecpair";

import { Turnkey as TurnkeyServerSDK } from "@turnkey/sdk-server";
import { createNewWallet } from "./createNewWallet";

bitcoin.initEccLib(ecc);

async function main() {
  const turnkeyClient = new TurnkeyServerSDK({
    apiBaseUrl: process.env.BASE_URL!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    defaultOrganizationId: process.env.ORGANIZATION_ID!,
  });

  const cliPrompts = [
    {
      type: "text" as PromptType,
      name: "unsignedTx",
      message:
        "Unsigned transaction, in hex",
    },
    {
      type: "text" as PromptType,
      name: "signerAddress",
      message:
        "Address to sign with",
    }
  ];

  const { unsignedTx, signerAddress } = await prompts(cliPrompts);
  const tx = bitcoin.Transaction.fromHex(unsignedTx);
  // const hashToSign = tx.hashForSignature(0, tx.ins[0].script, bitcoin.Transaction.SIGHASH_ALL);
  // tx.setInputScript


  // const psbt = bitcoin.Psbt.fr(unsignedTx);
  
  console.log(tx);

  // // Create a signer
  // const tkSigner = {
  //   publicKey: pair.publicKey,
  //   sign: async (hash: Buffer, _lowrR: boolean | undefined) => {
  //     const { r, s } = await turnkeyClient.apiClient().signRawPayload({
  //       signWith: publicKeyCompressed,
  //       encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
  //       hashFunction: "HASH_FUNCTION_NO_OP",
  //       payload: hash.toString("hex"),
  //     });

  //     return Buffer.from(r + s, "hex");
  //   },
  // } as bitcoin.SignerAsync;

  // await psbt.signInputAsync(0, tkSigner);
  // psbt.finalizeAllInputs();
  // const signedPayload = psbt.extractTransaction().toHex();
  // return signedPayload;
}

main()
  .then((res) => {
    console.log(res);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

/**
 * VARIOUS HELPERS CALLING OUT TO EXTERNAL APIS BELOW
 */

async function getBalance(address: string) {
  try {
    const response = await fetch(
      `https://api.blockcypher.com/v1/btc/test3/addrs/${address}/balance`
    );
    return await response.json();
  } catch (error) {
    console.error("Error fetching balance:", error);
  }
}

async function getFeeEstimate() {
  try {
    const response = await fetch(
      "https://mempool.space/testnet/api/v1/fees/recommended"
    );
    return await response.json();
  } catch (error) {
    console.error("Error fetching fee estimate:", error);
    throw error;
  }
}

async function getUTXOs(address: string) {
  try {
    const response = await fetch(
      `https://blockstream.info/testnet/api/address/${address}/utxo`
    );
    return await response.json();
  } catch (error) {
    console.error("Error fetching UTXOs:", error);
    throw error;
  }
}

// @ts-ignore
// Optional helper to get additional transaction info
async function getTransactionInfo(txhash: string) {
  try {
    // Get the transaction info from blockcypher API
    let response = await fetch(
      `https://api.blockcypher.com/v1/btc/test3/txs/${txhash}?limit=50&includeHex=true`
    );
    return await response.json();
  } catch (error) {
    console.error("Error fetching transaction info:", error);
    throw error;
  }
}

// @ts-ignore
// Optional helper to programmatically broadcast a transaction
async function broadcast(signedPayload: string) {
  try {
    // Note this endpoint is resistant to dust transactions
    const response = await fetch("https://mempool.space/testnet/tx/push", {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
      },
      body: signedPayload,
    });
    console.log("response", response);

    return await response.json();
  } catch (error) {
    console.error("Error broadcasting transaction:", error);
    throw error;
  }
}

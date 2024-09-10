import * as path from "path";
import * as dotenv from "dotenv";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import * as bitcoin from "bitcoinjs-lib";
import prompts, { PromptType } from "prompts";
import * as ecc from "tiny-secp256k1";
import { ECPairFactory } from "ecpair";

import { Turnkey as TurnkeyServerSDK } from "@turnkey/sdk-server";
import { createNewWallet } from "../createNewWallet";

bitcoin.initEccLib(ecc);

async function main() {
  if (!process.env.SIGN_WITH_COMPRESSED) {
    // If you don't specify a `SIGN_WITH_COMPRESSED`, we'll create a new BTC wallet for you via calling the Turnkey API.
    // If you need to explicitly derive your BTC address, use the `deriveBtcAddress.ts` script.
    await createNewWallet();
    return;
  }

  const publicKeyCompressed = process.env.SIGN_WITH_COMPRESSED;

  const turnkeyClient = new TurnkeyServerSDK({
    apiBaseUrl: process.env.BASE_URL!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    defaultOrganizationId: process.env.ORGANIZATION_ID!,
  });

  const cliPrompts = [
    {
      type: "number" as PromptType,
      name: "amount",
      message: "Amount (in satoshis)",
    },
    {
      type: "text" as PromptType,
      name: "destination",
      // See https://en.bitcoin.it/wiki/List_of_address_prefixes for various prefixes
      message:
        "Destination BTC address, starting with tb1 (Bech32 testnet pubkey hash or script hash)",
    },
  ];

  const { amount, destination } = await prompts(cliPrompts);

  const ECPair = ECPairFactory(ecc);
  const pair = ECPair.fromPublicKey(Buffer.from(publicKeyCompressed, "hex"));

  // Get address and balance, then calculate amount and change amount
  const address = bitcoin.payments.p2wpkh({
    pubkey: pair.publicKey,
    network: bitcoin.networks.testnet,
  }).address!;

  const balanceResponse = await getBalance(address);
  const feeResponse = await getFeeEstimate();
  const utxos = await getUTXOs(address);

  const balance = balanceResponse.final_balance;
  const fee = feeResponse.hourFee;
  const changeAmount = balance - amount - fee;

  const network = bitcoin.networks.testnet;
  const psbt = new bitcoin.Psbt({ network });

  let inputAmount = 0;
  for (const utxo of utxos) {
    if (inputAmount >= amount + fee) break;

    psbt.addInput({
      hash: utxo.txid,
      index: utxo.vout,
      witnessUtxo: {
        script: Buffer.from(
          bitcoin.payments.p2wpkh({
            pubkey: pair.publicKey,
            network,
          }).output!
        ),
        value: utxo.value,
      },
    });

    inputAmount += utxo.value;
  }

  // Output to destination
  psbt.addOutput({
    script: bitcoin.address.toOutputScript(
      destination,
      bitcoin.networks.testnet
    ),
    value: amount,
  });

  // Output for change
  psbt.addOutput({
    script: bitcoin.address.toOutputScript(address, bitcoin.networks.testnet),
    value: changeAmount,
  });

  // Create a signer
  const tkSigner = {
    publicKey: pair.publicKey,
    sign: async (hash: Buffer, _lowrR: boolean | undefined) => {
      const { r, s } = await turnkeyClient.apiClient().signRawPayload({
        signWith: publicKeyCompressed,
        encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
        hashFunction: "HASH_FUNCTION_NO_OP",
        payload: hash.toString("hex"),
      });

      return Buffer.from(r + s, "hex");
    },
  } as bitcoin.SignerAsync;

  await psbt.signInputAsync(0, tkSigner);
  psbt.finalizeAllInputs();
  const signedPayload = psbt.extractTransaction().toHex();
  return signedPayload;
  // await broadcast(signedPayload); // Generally, we recommend broadcasting via Web, i.e. via https://live.blockcypher.com/pushtx
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

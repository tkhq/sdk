import * as bitcoin from "bitcoinjs-lib";
import prompts, { PromptType } from "prompts";
import * as ecc from "tiny-secp256k1";
import { ECPairFactory } from "ecpair";

import * as path from "path";
import * as dotenv from "dotenv";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { Turnkey as TurnkeyServerSDK } from "@turnkey/sdk-server";
import { createNewWallet } from "./createNewWallet";

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
    // {
    //   type: "text" as PromptType,
    //   name: "hash",
    //   message: "Unspent transaction ID",
    // },
    // {
    //   type: "number" as PromptType,
    //   name: "index",
    //   message: "Unspent transaction index",
    // },
    {
      type: "number" as PromptType,
      name: "amount",
      message: "Amount (in satoshis)",
    },
    {
      type: "text" as PromptType,
      name: "destination",
      message: "Destination BTC address (P2SH-P2WPKH), starting with 2",
    },
  ];

  // Sample values to use:
  //   hash: "6a94d6b2d27a3df8036ecf713af6418ef9e8bf5daa7ee170fa74d67a07d4ffae"
  //   index: 0
  //   amount: 501
  //   destination: "2Mv28PpCuEynr6rU9rqNJ5VW3znGZFfAU7Y"
  // const { hash, index, amount, destination } = await prompts(cliPrompts);
  const { amount, destination } = await prompts(cliPrompts);

  const ECPair = ECPairFactory(ecc);
  const pair = ECPair.fromPublicKey(Buffer.from(publicKeyCompressed, "hex"));

  // // Get the transaction info from blockcypher API
  // let resp = await fetch(
  //   `https://api.blockcypher.com/v1/btc/test3/txs/${hash}?limit=50&includeHex=true`
  // );
  // let respJson = await resp.json();

  // Get address and balance, then calculate amount and change amount
  const address = bitcoin.payments.p2sh({
    redeem: bitcoin.payments.p2wpkh({
      pubkey: pair.publicKey,
      network: bitcoin.networks.testnet,
    }),
  }).address!;

  // const fee = 2000; // Should be sufficient; feel free to adjust
  const fee = await getFeeEstimate(); // Should be sufficient; feel free to adjust
  // const balance = await getBalance(address);
  const balance = 16266;
  const changeAmount = balance - amount - fee.economyFee;
  // const changeAmount = balance.final_balance - amount - fee.economyFee;
  const utxos = await getUTXOs(address);

  const network = bitcoin.networks.testnet;
  const psbt = new bitcoin.Psbt({ network });

  console.log({
    changeAmount,
    amount,
    fee,
    balance,
    utxos,
  });

  let inputAmount = 0;
  for (const utxo of utxos) {
    const txHex = await getTransactionInfo(utxo.txid);

    console.log("in loop", {
      utxo,
      txHex,
      inputAmount,
    });

    inputAmount += utxo.value;
    if (inputAmount >= amount + fee.economyFee) break;

    psbt.addInput({
      hash: utxo.txid,
      index: utxo.vout,
      nonWitnessUtxo: Buffer.from(txHex.hex, "hex"),
      redeemScript: bitcoin.payments.p2sh({
        redeem: bitcoin.payments.p2wpkh({
          pubkey: pair.publicKey,
          network,
        }),
      }).redeem?.output!,
    });
  }

  console.log("psbt inputs", psbt.txInputs);

  // psbt.addInput({
  //   hash: hash,
  //   index: index,
  //   nonWitnessUtxo: Buffer.from(respJson.hex, "hex"),
  //   redeemScript: bitcoin.payments.p2sh({
  //     redeem: bitcoin.payments.p2wpkh({
  //       pubkey: pair.publicKey,
  //       network: bitcoin.networks.testnet,
  //     }),
  //   })?.redeem?.output!,
  // });

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
  return psbt.extractTransaction().toHex();
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

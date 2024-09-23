import * as path from "path";
import * as dotenv from "dotenv";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import * as bitcoin from "bitcoinjs-lib";
import prompts, { PromptType } from "prompts";
import * as ecc from "tiny-secp256k1";
import { ECPairFactory } from "ecpair";

import { Turnkey as TurnkeyServerSDK } from "@turnkey/sdk-server";

// Extra imports if you want to test the local mnemonic route
// (no need to do this outside of debugging)
// import BIP32Factory from 'bip32';
// import * as bip39 from 'bip39';

bitcoin.initEccLib(ecc);

// I know, lazy. This is just to estimate fees. We take the live per-byte fee rate and multiply by this constant.
// 200 bytes is generally enough for a simple send. If you need more, bump it.
const ROUGH_AMOUNT_OF_BYTES = 200

async function main() {
  const publicKeyCompressed = process.env.SIGN_WITH_COMPRESSED!;

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
      message:
        "Destination BTC address, starting with bc1 (taproot address)",
    },
  ];

  let { amount, destination } = await prompts(cliPrompts);
  amount = amount
  destination = destination;

  const ECPair = ECPairFactory(ecc);
  const pair = ECPair.fromPublicKey(Buffer.from(publicKeyCompressed, "hex"));

  // Get address and balance, then calculate amount and change amount
  const address = bitcoin.payments.p2tr({
    internalPubkey: pair.publicKey.slice(1, 33),
    network: bitcoin.networks.bitcoin,
  }).address!;
  const xOnlyPublicKey = pair.publicKey.slice(1, 33);
  
  console.log("Taproot address for public key: ", address)

  const balanceResponse = await getBalance(address);
  const feeResponse = await getFeeEstimate();
  const utxos = await getUTXOs(address);

  const balance = balanceResponse.final_balance;
  const fee = feeResponse.hourFee * ROUGH_AMOUNT_OF_BYTES;
  const changeAmount = balance - amount - fee;

  console.log(`Constructing a transaction with fee of ${fee} and a change output of ${changeAmount}`);

  const network = bitcoin.networks.bitcoin;
  const psbt = new bitcoin.Psbt({ network });

  let inputAmount = 0;
  for (const utxo of utxos) {
    if (inputAmount >= amount + fee) break;

    psbt.addInput({
      hash: utxo.txid,
      index: utxo.vout,
      tapInternalKey: xOnlyPublicKey,
      witnessUtxo: {
        script: bitcoin.payments.p2tr({
            network,
            internalPubkey: xOnlyPublicKey,
          }).output!,
        value: utxo.value,
      },
    });

    inputAmount += utxo.value;
  }

  // Output to destination
  psbt.addOutput({
    script: bitcoin.address.toOutputScript(
      destination,
      bitcoin.networks.bitcoin
    ),
    value: amount,
  });

  if (changeAmount > 0) {
    // Output for change
    psbt.addOutput({
      script: bitcoin.address.toOutputScript(address, bitcoin.networks.bitcoin),
      value: changeAmount,
    });
  } else {
    console.log("skipping change output!")
  }

  // This is how you'd sign using a local mnemonic. Note the tweakChildNode!
  // const mnemonic ='your twelve words mnemonic';
  // const bip32Path = `m/86'/0'/0'/0/0`; 
  // const seed = await bip39.mnemonicToSeed(mnemonic);
  // const bip32 = BIP32Factory(ecc);
  // const rootKey = bip32.fromSeed(seed);
  // const childNode = rootKey.derivePath(bip32Path);
  // const tweakedChildNode = childNode.tweak(
  //   bitcoin.crypto.taggedHash('TapTweak', xOnlyPublicKey),
  // );
  // psbt.signInput(0, tweakedChildNode);
  
  // Doing the same with Turnkey -- Turnkey performs this same tweak at signing time for you
  const tkSigner = new TkSchnorrSigner(turnkeyClient, address)
  await psbt.signInputAsync(0, tkSigner);

  psbt.finalizeAllInputs();
  const signedPayload = psbt.extractTransaction().toHex();

  // To broadcast it: https://mempool.space/tx/push
  return signedPayload;
}

main()
  .then((res) => {
    console.log(res);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

class TkSchnorrSigner {
  client: TurnkeyServerSDK
  publicKey: Buffer;
  // The Turnkey-derived address in bech32 format (e.g. bc1pdyzj6qxu6q40jdkcslh0uqmnppx4vtg0l0a7kfdccr5833wfjwqqnp949w)
  taprootAddress: string;
  
  constructor(client: TurnkeyServerSDK, taprootAddress: string) {
    this.client = client;
    this.taprootAddress = taprootAddress;
    // This public key needs to be the decoded address, in order to match the output's "public key"
    // See https://github.com/bitcoinjs/bitcoinjs-lib/blob/34e1644b5fb60055793ec3078f2e4f48b2648ca6/ts_src/psbt.ts#L1786
    this.publicKey =  bitcoin.address.fromBech32(taprootAddress).data;
  }

  // No need to implement sign since all inputs will use `signSchnorr`. We're in a Schnorr signer!
  async sign(_hash: Buffer): Promise<Buffer> {
    throw new Error("not implemented")
  }

  async signSchnorr(hash: Buffer): Promise<Buffer> {
    console.log("signing a hash", hash.toString("hex"));
    const { r, s } = await this.client.apiClient().signRawPayload({
      signWith: this.taprootAddress,
      encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
      hashFunction: "HASH_FUNCTION_NO_OP",
      payload: hash.toString("hex"),
    });

    return Buffer.from(r + s, "hex");
  }
}

/**
 * VARIOUS HELPERS CALLING OUT TO EXTERNAL APIS BELOW
 */

async function getBalance(address: string) {
  try {
    const response = await fetch(
      `https://api.blockcypher.com/v1/btc/main/addrs/${address}/balance`
    );
    return await response.json();
  } catch (error) {
    console.error("Error fetching balance:", error);
  }
}

async function getFeeEstimate() {
  try {
    const response = await fetch(
      "https://mempool.space/api/v1/fees/recommended"
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
      `https://blockstream.info/api/address/${address}/utxo`
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

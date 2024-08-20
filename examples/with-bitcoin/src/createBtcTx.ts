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
// import { print, assertEqual } from "./util";

bitcoin.initEccLib(ecc);

async function main() {
  if (
    !process.env.SIGN_WITH_COMPRESSED
    // !process.env.SIGN_WITH_UNCOMPRESSED
  ) {
    // If you don't specify a `SIGN_WITH`, we'll create a new BTC wallet for you via calling the Turnkey API.
    await createNewWallet();
    return;
  }

  const publicKeyCompressed = process.env.SIGN_WITH_COMPRESSED;
  // const publicKeyUncompressed = process.env.SIGN_WITH_UNCOMPRESSED;
  const turnkeyClient = new TurnkeyServerSDK({
    apiBaseUrl: process.env.BASE_URL!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    defaultOrganizationId: process.env.ORGANIZATION_ID!,
  });

  const cliPrompts = [
    {
      type: "text" as PromptType,
      name: "hash",
      message: "Unspent transaction ID",
    },
    {
      type: "number" as PromptType,
      name: "index",
      message: "Unspent transaction index",
    },
    {
      type: "number" as PromptType,
      name: "amount",
      message: "Amount (in satoshis)",
    },
    // {
    //   type: "text" as PromptType,
    //   name: "publicKey",
    //   message:
    //     "Public key spending this input (starting with 04, hex-encoded, uncompressed)",
    // },
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
  const { hash, index, amount, destination } = await prompts(cliPrompts);

  // This is needed to derive the compressed format of the public key
  // (Turnkey only provides the uncompressed format)
  const ECPair = ECPairFactory(ecc);
  const pair = ECPair.fromPublicKey(Buffer.from(publicKeyCompressed, "hex"));

  console.log({
    publicKeyCompressed,
    pair,
  });

  // Get the transaction info from blockcypher API
  let resp = await fetch(
    `https://api.blockcypher.com/v1/btc/test3/txs/${hash}?limit=50&includeHex=true`
  );
  let respJson = await resp.json();

  const pbst = new bitcoin.Psbt({ network: bitcoin.networks.testnet });
  pbst.addInput({
    hash: hash,
    index: index,
    nonWitnessUtxo: Buffer.from(respJson.hex, "hex"),
    redeemScript: bitcoin.payments.p2sh({
      redeem: bitcoin.payments.p2wpkh({
        pubkey: pair.publicKey,
        // pubkey: Buffer.from(publicKeyCompressed), // why doesn't this work?
        network: bitcoin.networks.testnet,
      }),
    })?.redeem?.output!,
  });

  pbst.addOutput({
    script: bitcoin.address.toOutputScript(
      destination,
      bitcoin.networks.testnet
    ),
    value: amount,
  });

  // Create a signer
  const tkSigner = {
    // publicKey: Buffer.from(publicKeyCompressed),
    publicKey: pair.publicKey,
    sign: async (hash: Buffer, _lowrR: boolean | undefined) => {
      const { r, s } = await turnkeyClient.apiClient().signRawPayload({
        signWith: publicKeyCompressed,
        encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
        hashFunction: "HASH_FUNCTION_NO_OP",
        payload: hash.toString("hex"),
      });

      return Buffer.from(r + s, "hex");

      // return new Promise(async (resolve, rejects) => {
      //   const { r, s, v } = await turnkeyClient.apiClient().signRawPayload({
      //     signWith: publicKeyCompressed,
      //     encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
      //     hashFunction: "HASH_FUNCTION_NO_OP",
      //     payload: hash.toString("hex"),
      //   });

      //   const signPrompt = [
      //     {
      //       type: "confirm" as PromptType,
      //       name: "sigPrompt",
      //       message: `Please go sign the following hash with Turnkey: ${hash.toString(
      //         "hex"
      //       )}\nReady to continue?`, // Hash should be in hex
      //     },
      //     {
      //       type: "text" as PromptType,
      //       name: "r",
      //       message: "R value (hex-encoded):",
      //     },
      //     {
      //       type: "text" as PromptType,
      //       name: "s",
      //       message: "S value (hex-encoded):",
      //     },
      //     {
      //       type: "text" as PromptType,
      //       name: "v",
      //       message: "V value (00 or 01):",
      //     },
      //   ];
      //   // Sample values:
      //   //   r: 683c75e1aa6c55a2f108693e7f04d183eeafe6be88b61dc3901b9e02479cee39
      //   //   s: 43739ad0ab3e3d0f7ce1ad7fc686d506f07c035b7078c1899c09da2922437a34
      //   //   v: 01
      //   prompts(signPrompt)
      //     .then(function (vals) {
      //       let signatureBuf = Buffer.from(vals.r + vals.s, "hex");
      //       resolve(signatureBuf);
      //     })
      //     .catch(function (reason) {
      //       rejects(reason);
      //     });
      // });
    },
  } as bitcoin.SignerAsync;

  await pbst.signInputAsync(0, tkSigner);
  pbst.finalizeAllInputs();
  return pbst.extractTransaction().toHex();
}

main().then((res) => console.log(res));

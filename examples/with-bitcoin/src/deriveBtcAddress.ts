import * as path from "path";
import * as dotenv from "dotenv";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import * as bitcoin from "bitcoinjs-lib";
import prompts, { PromptType } from "prompts";
import * as ecc from "tiny-secp256k1";
import { ECPairFactory } from "ecpair"; // TODO: use bech32 library

const ECPair = ECPairFactory(ecc);

async function main() {
  const cliPrompts = [
    {
      type: "text" as PromptType,
      name: "publicKey",
      message:
        "Generic public key (hex-encoded, starts with 04, 66 characters long)",
      initial: process.env.SIGN_WITH_COMPRESSED,
    },
  ];

  const { publicKey } = await prompts(cliPrompts);

  const pair = ECPair.fromPublicKey(Buffer.from(publicKey, "hex"));

  // Generate the P2WPKH address (SegWit Bech32 address)
  const p2wpkhAddress = bitcoin.payments.p2wpkh({
    pubkey: pair.publicKey,
    network: bitcoin.networks.testnet,
  }).address;

  console.log("Testnet P2WPKH address: " + p2wpkhAddress);

  // FYI here's how you'd derive a P2PKH address (Pay-to-Public-Key-Hash)
  // P2PKH addresses are still in use in the Bitcoin ecosystem, but are
  // being phased out in favor of P2SH or native SegWit addresses.
  // ----
  // let p2pkhAddress = bitcoin.payments.p2pkh({
  //   pubkey: pair.publicKey,
  //   network: bitcoin.networks.testnet,
  // }).address;
  // console.log("Testnet P2PKH address: " + p2pkhAddress);
  //
  // --------
  //
  // Additionally, here's how you'd derive a P2SH (Pay-To-Script-Hash) address:
  // ----
  // const p2shAddress = bitcoin.payments.p2sh({
  //   redeem: bitcoin.payments.p2wpkh({
  //     pubkey: pair.publicKey,
  //     network: bitcoin.networks.testnet,
  //   }),
  // }).address;
  // console.log("Testnet P2SH address: " + p2wpkhAddress);
}

main()
  .then((res) => {
    console.log(res);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

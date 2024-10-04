import * as path from "path";
import * as dotenv from "dotenv";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import * as bitcoin from "bitcoinjs-lib";
import prompts from "prompts";
import * as ecc from "tiny-secp256k1";
import { ECPairFactory } from "ecpair";

import { Turnkey as TurnkeyServerSDK } from "@turnkey/sdk-server";
import { TurnkeySigner } from "./signer";
import { getNetwork, isMainnet, parseAddressAgainstPublicKey } from "./util";
import { estimateFees } from "./fees";

bitcoin.initEccLib(ecc);

async function main() {
  const publicKeyCompressed = process.env.SOURCE_COMPRESSED_PUBLIC_KEY!;
  const bitcoinAddress = process.env.SOURCE_BITCOIN_ADDRESS!;

  const turnkeyClient = new TurnkeyServerSDK({
    apiBaseUrl: process.env.BASE_URL!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    defaultOrganizationId: process.env.ORGANIZATION_ID!,
  });

  const ECPair = ECPairFactory(ecc);
  const pair = ECPair.fromPublicKey(Buffer.from(publicKeyCompressed, "hex"));

  const addressType = parseAddressAgainstPublicKey(
    bitcoinAddress,
    publicKeyCompressed
  );
  const network = getNetwork(addressType);

  console.log("✅ Loaded configuration");
  console.log(`-> Source address: ${bitcoinAddress}`);
  console.log(`-> Inferred address type: ${addressType}`);

  console.log("Fetching UTXOs...");
  const utxos = await getUTXOs(bitcoinAddress, network);
  if (utxos.length === 0) {
    throw new Error("no UTXOs found on this address. Aborting.");
  }

  const choices = utxos.map((utxo: any) => {
    const utxoInfo = {
      hash: utxo.txid,
      index: utxo.vout,
      value: utxo.value,
    };
    return {
      title: `${utxoInfo.value} sats (tx # ${utxoInfo.hash} @ ${utxoInfo.index})`,
      value: utxoInfo,
    };
  });

  const { utxosToSpend, destination } = await prompts([
    {
      type: "multiselect",
      name: "utxosToSpend",
      message: "select UTXOS to spend",
      choices: choices,
      min: 1,
    },
    {
      type: "text",
      name: "destination",
      message: "Destination BTC address",
    },
  ]);

  const feeEstimate = await estimateFees({
    numInputs: utxosToSpend.length,
    numOutputs: 2, // 1 output for destination, 1 for change.
    network,
  });
  console.log(`✅ Fee estimate: ${feeEstimate} sats`);

  const totalToSpend = utxosToSpend.reduce((total: number, utxo: any) => {
    return total + utxo.value;
  }, 0);
  const maxToSpend = totalToSpend - feeEstimate;
  const { amount } = await prompts([
    {
      type: "number",
      name: "amount",
      message: `How much to you want to send to ${destination}? (max: ${maxToSpend} sats, the rest will go back to the source address as change)`,
      initial: maxToSpend,
      style: "default",
      min: 1,
      max: maxToSpend,
    },
  ]);

  const changeAmount = maxToSpend - amount;
  const { confirmChange } = await prompts([
    {
      type: "confirm",
      name: "confirmChange",
      message: `change amount going back to your source address will be ${changeAmount}. Looks good?`,
      initial: true,
    },
  ]);
  if (!confirmChange) {
    throw new Error("aborting.");
  }

  const psbt = new bitcoin.Psbt({ network });

  for (const utxo of utxosToSpend) {
    if (addressType == "MainnetP2TR" || addressType == "TestnetP2TR") {
      // Taproot uses Schnorr signatures and tweaks raw public keys to work around linearity attacks.
      // This is described in [BIP141](https://github.com/bitcoin/bips/blob/master/bip-0141.mediawiki) if you're curious.
      // This "x-only" public key is expected by bitcoinjs-lib because the underlying secp256k1 library which performs the tweak expects this format
      // (see https://github.com/bitcoinjs/tiny-secp256k1/blob/e8966cd1d9c724c4999ae71c9511b14c6a37648e/src_ts/index.ts#L263-L286)
      const xOnlyPublicKey = pair.publicKey.slice(1, 33);

      psbt.addInput({
        hash: utxo.hash,
        index: utxo.index,
        tapInternalKey: xOnlyPublicKey,
        witnessUtxo: {
          script: bitcoin.payments.p2tr({
            network: network,
            internalPubkey: xOnlyPublicKey,
          }).output!,
          value: utxo.value,
        },
      });
    } else if (
      addressType == "MainnetP2WPKH" ||
      addressType == "TestnetP2WPKH"
    ) {
      psbt.addInput({
        hash: utxo.hash,
        index: utxo.index,
        witnessUtxo: {
          script: bitcoin.payments.p2wpkh({
            pubkey: pair.publicKey,
            network: network,
          }).output!,
          value: utxo.value,
        },
      });
    } else {
      // Should never happen
      throw new Error(`Unexpected address type: ${addressType}`);
    }
  }

  // Output to destination
  psbt.addOutput({
    script: bitcoin.address.toOutputScript(destination, network),
    value: amount,
  });

  // Output to change, if amount is >0
  if (changeAmount > 0) {
    psbt.addOutput({
      script: bitcoin.address.toOutputScript(bitcoinAddress, network),
      value: changeAmount,
    });
  }

  var signer: TurnkeySigner;
  if (addressType === "MainnetP2TR" || addressType === "TestnetP2TR") {
    // For taproot public key needs to be the decoded address, in order to match the output's "public key" (tweaked)
    // See https://github.com/bitcoinjs/bitcoinjs-lib/blob/34e1644b5fb60055793ec3078f2e4f48b2648ca6/ts_src/psbt.ts#L1786
    signer = new TurnkeySigner(
      turnkeyClient,
      bitcoinAddress,
      bitcoin.address.fromBech32(bitcoinAddress).data
    );
  } else {
    signer = new TurnkeySigner(turnkeyClient, bitcoinAddress, pair.publicKey);
  }

  // Sign the transaction inputs
  await Promise.all(
    utxosToSpend.map(async (_utxo: any, i: number) => {
      await psbt.signInputAsync(i, signer);
    })
  );
  psbt.finalizeAllInputs();
  const signedPayload = psbt.extractTransaction().toHex();

  // To broadcast it: https://mempool.space/tx/push
  const broadcastUrl = isMainnet(network)
    ? "https://mempool.space/tx/push"
    : "https://mempool.space/testnet/tx/push";
  console.log(
    `✅ Transaction signed! To broadcast it, copy and paste the hex payload to ${broadcastUrl}`
  );
  return signedPayload;
}

async function getUTXOs(address: string, network: bitcoin.Network) {
  try {
    const url = isMainnet(network)
      ? `https://blockstream.info/api/address/${address}/utxo`
      : `https://blockstream.info/testnet/api/address/${address}/utxo`;
    const response = await fetch(url);
    return await response.json();
  } catch (error) {
    console.error("Error fetching UTXOs:", error);
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

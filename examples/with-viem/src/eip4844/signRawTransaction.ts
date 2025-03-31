import fs from "fs";
import { resolve } from "path";
import * as dotenv from "dotenv";
import * as cKzg from "c-kzg";
import {
  createWalletClient,
  http,
  setupKzg,
  parseGwei,
  stringToHex,
  toBlobs,
  serializeTransaction,
} from "viem";
import { sepolia } from "viem/chains";

import { createAccount } from "@turnkey/viem";
import { Turnkey as TurnkeyServerSDK } from "@turnkey/sdk-server";

import { print } from "../util";

// Load environment variables from `.env.local`
dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const mainnetTrustedSetupPath = resolve("./src/eip4844/trusted-setups.json");

const turnkeyClient = new TurnkeyServerSDK({
  apiBaseUrl: process.env.BASE_URL!,
  apiPrivateKey: process.env.API_PRIVATE_KEY!,
  apiPublicKey: process.env.API_PUBLIC_KEY!,
  defaultOrganizationId: process.env.ORGANIZATION_ID!,
  // The following config is useful in contexts where an activity requires consensus.
  // By default, if the activity is not initially successful, it will poll a maximum
  // of 3 times with an interval of 10000 milliseconds.
  //
  // -----
  //
  // activityPoller: {
  //   intervalMs: 10_000,
  //   numRetries: 5,
  // },
});

async function main() {
  const turnkeyAccount = await createAccount({
    client: turnkeyClient.apiClient(),
    organizationId: process.env.ORGANIZATION_ID!,
    signWith: process.env.SIGN_WITH!,
  });

  const client = createWalletClient({
    account: turnkeyAccount,
    chain: sepolia,
    transport: http(
      `https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY!}`,
    ),
  });

  const kzg = setupKzg(cKzg, mainnetTrustedSetupPath);
  const blobs = toBlobs({ data: stringToHex("hello world") });

  // Prepare the transaction first
  const request = await client.prepareTransactionRequest({
    account: turnkeyAccount,
    blobs,
    kzg,
    maxFeePerBlobGas: parseGwei("30"),
    to: "0x0000000000000000000000000000000000000000",
    type: "eip4844",
  });

  const signableTransaction = {
    ...request,
    sidecars: false as false, // see: https://github.com/wevm/viem/blob/73a677c1f5138ac343bfe8b869f39829c7d6eeba/src/accounts/utils/signTransaction.ts#L53-L62
  };

  // Get the serialized unsigned transaction
  const serializedUnsignedTx = serializeTransaction(signableTransaction);

  const { r, s, v } = await turnkeyClient.apiClient().signRawPayload({
    signWith: process.env.SIGN_WITH!,
    payload: serializedUnsignedTx,
    encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
    hashFunction: "HASH_FUNCTION_KECCAK256",
  });

  const serializedTx = serializeTransaction(request, {
    r: r as `0x${string}`,
    s: s as `0x${string}`,
    v: BigInt(v),
  });

  // Write the signed transaction to a file, as it's too long to read from a console
  fs.writeFileSync("./src/eip4844/signed-tx.hex", serializedTx);

  console.log(
    "Raw signed transaction written to ./src/eip4844/signed-tx.hex\n",
  );

  const txHash = await client.sendRawTransaction({
    serializedTransaction: serializedTx,
  });

  print("Transaction sent", `https://sepolia.etherscan.io/tx/${txHash}`);
}

main();

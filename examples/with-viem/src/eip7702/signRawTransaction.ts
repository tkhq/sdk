import fs from "fs";
import { resolve } from "path";
import * as dotenv from "dotenv";

import {
  createWalletClient,
  http,
  parseGwei,
  stringToHex,
  toBlobs,
  serializeTransaction,
  ByteArray,
  hexToBytes,
  bytesToHex,
} from "viem";
import { sepolia } from "viem/chains";

import { createAccount } from "@turnkey/viem";
import { Turnkey as TurnkeyServerSDK } from "@turnkey/sdk-server";

import { print } from "../util";
import { eip7702Actions } from "viem/experimental";

// Load environment variables from `.env.local`
dotenv.config({ path: resolve(process.cwd(), ".env.local") });

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
  }).extend(eip7702Actions());

  // Prepare the transaction first
  const request = await client.prepareTransactionRequest({
    account: turnkeyAccount,
    to: "0x0000000000000000000000000000000000000000",
    type: "eip7702",
  });

  const signableTransaction = {
    ...request,
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

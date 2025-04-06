import { createWalletClient, http } from "viem";
import { serializeTransaction, hashMessage } from "viem";
import { sepolia } from "viem/chains";

import { resolve } from "path";
import * as dotenv from "dotenv";

import { createAccount } from "@turnkey/viem";
import { Turnkey as TurnkeyServerSDK } from "@turnkey/sdk-server";

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
  });

  // Prepare the transaction first
  const request = await client.prepareTransactionRequest({
    to: process.env.SIGN_WITH! as `0x${string}`, // self
    account: turnkeyAccount,
    type: "eip1559",
    nonce: 100,
  });

  console.log("request", request);

  // Get the serialized unsigned transaction
  const serializedUnsignedTx = serializeTransaction(request);
  // console.log("Raw unsigned transaction:", serializedUnsignedTx);

  const { activity, r, s, v } = await turnkeyClient.apiClient().signRawPayload({
    signWith: process.env.SIGN_WITH!,
    payload: serializedUnsignedTx,
    encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
    hashFunction: "HASH_FUNCTION_KECCAK256",
  });

  // combine signature with original transaction
  // serialized signature
  // console.log("signed message", signedPayload);

  const serializedTx = serializeTransaction(request, {
    r: r as `0x${string}`,
    s: s as `0x${string}`,
    v: BigInt(v),
  });

  console.log("signed serialized tx", serializedTx);

  // // const hash = await client.sendTransacwtion(request);
  const hash = await client.sendRawTransaction({
    serializedTransaction: serializedTx,
  });

  console.log("resulting hash", hash);
}

main();

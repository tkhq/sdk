import { createWalletClient, http } from "viem";
import { sepolia } from "viem/chains";

import { serializeTransaction } from "viem";

import fs from "fs";

import { resolve } from "path";

import * as cKzg from "c-kzg";
import { setupKzg } from "viem";
import { parseGwei, stringToHex, toBlobs } from "viem";

const mainnetTrustedSetupPath = resolve("./src/trusted-setups.json");

import * as dotenv from "dotenv";

import { createAccount } from "@turnkey/viem";
import { Turnkey as TurnkeyServerSDK } from "@turnkey/sdk-server";

// Load environment variables from `.env.local`
dotenv.config({ path: resolve(process.cwd(), ".env.local") });

console.log("mainnet trusted setup path", mainnetTrustedSetupPath);

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
    blobs,
    kzg,
    maxFeePerBlobGas: parseGwei("30"),
    to: "0x0000000000000000000000000000000000000000",
    account: turnkeyAccount,
  });

  // Get the serialized unsigned transaction
  const serializedUnsignedTx = serializeTransaction(request);
  // console.log("Raw unsigned transaction:", serializedUnsignedTx);

  // Write the transaction to a file
  fs.writeFileSync("./unsigned-tx.hex", serializedUnsignedTx);
  console.log("Raw unsigned transaction written to ./unsigned-tx.hex");

  const hash = await client.sendTransaction(request);

  console.log("resulting hash", hash);
}

main();

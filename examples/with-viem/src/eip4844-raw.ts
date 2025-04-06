import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

import { serializeTransaction } from "viem";

import fs from "fs";

import { resolve } from "path";

import * as cKzg from "c-kzg";
import { setupKzg } from "viem";
// import { mainnetTrustedSetupPath } from "viem/node";

import { parseGwei, stringToHex, toBlobs } from "viem";

const mainnetTrustedSetupPath = resolve("./src/trusted-setups.json");

import * as dotenv from "dotenv";

// Load environment variables from `.env.local`
dotenv.config({ path: resolve(process.cwd(), ".env.local") });

console.log("mainnet trusted setup path", mainnetTrustedSetupPath);

async function main() {
  // import { generatePrivateKey } from "viem/accounts";
  // const privateKey = generatePrivateKey();

  const account = privateKeyToAccount(process.env.PK! as `0x{string}`);

  const client = createWalletClient({
    account,
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
  });

  // Get the serialized unsigned transaction
  const serializedUnsignedTx = serializeTransaction(request);
  // console.log("Raw unsigned transaction:", serializedUnsignedTx);

  // Write the transaction to a file
  fs.writeFileSync("./unsigned-tx.hex", serializedUnsignedTx);
  console.log("Raw unsigned transaction written to ./unsigned-tx.hex");

  const hash = await client.sendTransaction(request);

  // You can still send the transaction as before
  // const hash = await client.sendTransaction({
  //   blobs,
  //   kzg,
  //   maxFeePerBlobGas: parseGwei("30"),
  //   to: "0x0000000000000000000000000000000000000000",
  //   account: turnkeyAccount,
  // });

  console.log("resulting hash", hash);
}

main();

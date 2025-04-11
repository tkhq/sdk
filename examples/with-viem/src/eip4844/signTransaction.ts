import { resolve } from "path";
import * as dotenv from "dotenv";
import { loadKZG } from "kzg-wasm";

import {
  createWalletClient,
  http,
  parseGwei,
  stringToHex,
  toBlobs,
  ByteArray,
  hexToBytes,
  bytesToHex,
} from "viem";
import { sepolia } from "viem/chains";

import { createAccount } from "@turnkey/viem";
import { Turnkey as TurnkeyServerSDK } from "@turnkey/sdk-server";

import { print } from "../util";

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

  /**
   * Note: if you'd prefer to use `c-kzg` instead of `kzg-wasm`, you'll need the following:
   *
   * import * as cKzg from "c-kzg";
   * import { setupKzg } from "viem";
   *
   * // This file has been included in this example folder already; it's more reliable than using the one exported by Viem
   * const mainnetTrustedSetupPath = resolve("./src/eip4844/trusted-setups.json");
   *
   * const kzg = setupKzg(cKzg, mainnetTrustedSetupPath);
   *
   * ...
   *
   * // `kzg` can then be used in requests such as `await client.sendTransaction({
   *   ...
   *   kzg,
   *   ...
   * });
   */
  const kzg = await loadKZG();
  const blobs = toBlobs({ data: stringToHex("hello world") });

  // These adaptations are required in order to use `kzg-wasm`, in order for types to resolve.
  // Why `kzg-wasm` over `c-kzg`? No particular reason, but makes builds simpler in certain environments.
  const blobToKzgCommitmentAdapter = (blob: ByteArray): ByteArray => {
    const hexInput = bytesToHex(blob);
    const commitmentHex = kzg.blobToKZGCommitment(hexInput);
    return hexToBytes(commitmentHex as `0x${string}`);
  };

  const computeBlobKzgProofAdapter = (
    blob: ByteArray,
    commitment: ByteArray,
  ): ByteArray => {
    const hexBlob = bytesToHex(blob);
    const hexCommitment = bytesToHex(commitment);
    const proofHex = kzg.computeBlobKZGProof(hexBlob, hexCommitment);
    return hexToBytes(proofHex as `0x${string}`);
  };

  const adaptedKzg = {
    ...kzg,
    computeBlobKzgProof: computeBlobKzgProofAdapter,
    blobToKzgCommitment: blobToKzgCommitmentAdapter,
  };

  const txHash = await client.sendTransaction({
    account: turnkeyAccount,
    blobs,
    kzg: adaptedKzg,
    maxFeePerBlobGas: parseGwei("30"),
    to: "0x0000000000000000000000000000000000000000",
    type: "eip4844",
  });

  print("Transaction sent", `https://sepolia.etherscan.io/tx/${txHash}`);
}

main();

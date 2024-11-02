import * as path from "path";
import * as dotenv from "dotenv";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { TurnkeySigner } from "@turnkey/ethers";
import { ethers, Transaction } from "ethers";
import { Turnkey as TurnkeyServerSDK } from "@turnkey/sdk-server";
import { createNewWallet } from "./createNewWallet";
import { print } from "./util";
import {
  uint8ArrayFromHexString,
  uint8ArrayToHexString,
} from "@turnkey/encoding";

import { loadKZG } from "kzg-wasm";
// import bls from "@chainsafe/bls";
// import { Blob } from "@chainsafe/bls/bls";

async function main() {
  if (!process.env.SIGN_WITH) {
    // If you don't specify a `SIGN_WITH`, we'll create a new wallet for you via calling the Turnkey API.
    await createNewWallet();
    return;
  }

  console.log("process base url", process.env.BASE_URL);

  const turnkeyClient = new TurnkeyServerSDK({
    apiBaseUrl: process.env.BASE_URL!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    defaultOrganizationId: process.env.ORGANIZATION_ID!,
  });

  // Initialize a Turnkey Signer
  const turnkeySigner = new TurnkeySigner({
    client: turnkeyClient.apiClient(),
    organizationId: process.env.ORGANIZATION_ID!,
    signWith: process.env.SIGN_WITH!,
  });

  // Bring your own provider (such as Alchemy or Infura: https://docs.ethers.org/v6/api/providers/)
  const network = "sepolia";
  const provider = new ethers.InfuraProvider(network);
  const connectedSigner = turnkeySigner.connect(provider);
  const address = await connectedSigner.getAddress();

  print("Address:", address);

  // 4. Sign type 3 (EIP-4844) transaction
  const feeEstimate = await connectedSigner.provider?.getFeeData();
  console.log("fee estimate", feeEstimate);

  // Blob stuff
  // Create blob data (example with zeros)
  const blobData = new Uint8Array(131072).fill(0);

  // Create KZG proof and commitment
  // Create versioned hash
  //   const versionByte = new Uint8Array([1]); // 0x01 for version
  //   const commitmentBytes = hexToBytes(commitment);
  //   const versionedCommitment = new Uint8Array([...versionByte, ...commitmentBytes]);
  //   const versionedHash = ethers.utils.keccak256(versionedCommitment);
  const kzg = await loadKZG();

  //   const blob = Blob.fromBytes(blobData);
  const blob = uint8ArrayToHexString(blobData);
  const commitment = kzg.blobToKZGCommitment(blob);
  const proof = kzg.computeBlobKZGProof(blob, commitment);

//   // Create versioned hash
  const versionByte = new Uint8Array([1]); // 0x01 for version
  const commitmentBytes = uint8ArrayFromHexString(commitment);
  const versionedCommitment = new Uint8Array([
    ...versionByte,
    ...commitmentBytes,
  ]);
  const versionedHash = ethers.keccak256(versionedCommitment);

  const unsignedTx = Transaction.from({
    to: "0x08d2b0a37F869FF76BACB5Bab3278E26ab7067B7",
    value: 1,
    type: 3,
    chainId: 11155111,
    gasLimit: 21000,
    maxFeePerGas: feeEstimate!.maxFeePerGas,
    maxPriorityFeePerGas: feeEstimate!.maxPriorityFeePerGas,
    maxFeePerBlobGas: feeEstimate!.maxFeePerGas,
    // blobs: [],
    blobVersionedHashes: [versionedHash],
  });

  // The blobs, commitments, and proofs are sent separately
  //   const blobSidecar = {
  //     blobs: [blob],
  //     commitments: [commitmentBytes],
  //     proofs: [uint8ArrayFromHexString(proof)],
  //   };

  const gasEstimate = await connectedSigner.estimateGas(unsignedTx);
  console.log("gas estimate", gasEstimate);

  console.log("serialized unsigned", unsignedTx.unsignedSerialized);
  console.log("full tx", unsignedTx.gasLimit);

  const signedTx = await connectedSigner.signTransaction(unsignedTx);

  console.log("signed tx", signedTx);

  const sentTx = await connectedSigner.sendTransaction({
    ...unsignedTx,
    // ...blobSidecar,
  });
  console.log("sent tx", sentTx);

  // console.log({
  //   unsignedTx,
  //   unsignedTxTo: unsignedTx.to,
  //   unsignedTxSerialized: unsignedTx.unsignedSerialized,
  // });

  // const signedMessage = await connectedSigner.signMessage(
  //   unsignedTx.unsignedSerialized
  // );

  // console.log({
  //   unsignedTx,
  //   signedMessage,
  // });

  // const signedTx = Object.assign({}, unsignedTx);

  // signedTx.signature = Signature.from(signedMessage);

  // console.log({ signedTx });

  // // Combine the signautre + transaction
  // const broadcastedTx = await connectedSigner.provider?.broadcastTransaction(
  //   signedTx.serialized
  // );

  // print("Successfully broadcasted EIP-4844 transaction!", broadcastedTx?.hash!);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

import * as path from "path";
import * as dotenv from "dotenv";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { TurnkeySigner } from "@turnkey/ethers";
import { ethers, Transaction, Signature } from "ethers";
import { Turnkey as TurnkeyServerSDK } from "@turnkey/sdk-server";
import { createNewWallet } from "./createNewWallet";
import { print, assertEqual } from "./util";

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

  const baseMessage = "Hello Turnkey";

  // 1. Sign a raw hex message
  const hexMessage = ethers.hexlify(ethers.toUtf8Bytes(baseMessage));
  let signature = await connectedSigner.signMessage(hexMessage);
  let recoveredAddress = ethers.verifyMessage(hexMessage, signature);

  print("Turnkey-powered signature - raw hex message:", `${signature}`);
  assertEqual(recoveredAddress, address);

  // 2. Sign a raw bytes message
  const bytesMessage = ethers.toUtf8Bytes(baseMessage);
  signature = await connectedSigner.signMessage(bytesMessage);
  recoveredAddress = ethers.verifyMessage(bytesMessage, signature);

  print("Turnkey-powered signature - raw bytes message:", `${signature}`);
  assertEqual(recoveredAddress, address);

  // 3. Sign typed data (EIP-712)
  const typedData = {
    types: {
      // Note that we do not need to include `EIP712Domain` as a type here, as Ethers will automatically inject it for us
      Person: [
        { name: "name", type: "string" },
        { name: "wallet", type: "address" },
      ],
    },
    domain: {
      name: "EIP712 Test",
      version: "1",
    },
    primaryType: "Person",
    message: {
      name: "Alice",
      wallet: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
    },
  };

  signature = await connectedSigner.signTypedData(
    typedData.domain,
    typedData.types,
    typedData.message
  );

  recoveredAddress = ethers.verifyTypedData(
    typedData.domain,
    typedData.types,
    typedData.message,
    signature
  );

  print("Turnkey-powered signature - typed data (EIP-712):", `${signature}`);
  assertEqual(recoveredAddress, address);

  // 4. Sign type 3 (EIP-4844) transaction
  const feeEstimate = await connectedSigner.provider?.getFeeData();
  console.log("fee estimate", feeEstimate);

  const unsignedTx = Transaction.from({
    to: "0x08d2b0a37F869FF76BACB5Bab3278E26ab7067B7",
    value: 1111,
    type: 3,
    chainId: 11155111,
    gasLimit: 21000,
    maxFeePerGas: feeEstimate!.maxFeePerGas,
    maxPriorityFeePerGas: feeEstimate!.maxPriorityFeePerGas,
    maxFeePerBlobGas: feeEstimate!.maxFeePerGas,
    // blobs: [],
    blobVersionedHashes: [
      "0x01000000000000000000000000000000000000000000000000000000000000aa",
    ],
  });

  const gasEstimate = await connectedSigner.estimateGas(unsignedTx);
  console.log("gas estimate", gasEstimate);

  console.log("serialized unsigned", unsignedTx.unsignedSerialized);
  console.log("full tx", unsignedTx.gasLimit);

  const signedTx = await connectedSigner.signTransaction(unsignedTx);

  console.log("signed tx", signedTx);

  const sentTx = await connectedSigner.sendTransaction(unsignedTx);
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

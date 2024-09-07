import * as path from "path";
import * as dotenv from "dotenv";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { TurnkeySigner } from "@turnkey/ethers";
import { ethers } from "ethers";
import {
  Turnkey as TurnkeyServerSDK,
  TERMINAL_ACTIVITY_STATUSES,
} from "@turnkey/sdk-server";
import { createNewWallet } from "./createNewWallet";
import { print, sleep } from "./util";

async function main() {
  if (!process.env.SIGN_WITH) {
    // If you don't specify a `SIGN_WITH`, we'll create a new wallet for you via calling the Turnkey API.
    await createNewWallet();
    return;
  }

  const turnkeyClient = new TurnkeyServerSDK({
    apiBaseUrl: process.env.BASE_URL!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    defaultOrganizationId: process.env.ORGANIZATION_ID!,
    // The following config is useful in contexts where an activity requires consensus.
    // By default, if the activity is not initially successful, it will poll a maximum
    // of 3 times with an interval of 1000 milliseconds.
    //
    // -----
    //
    // activityPoller: {
    //   intervalMs: 10_000,
    //   numRetries: 5,
    // },
  });

  // Initialize a Turnkey Signer
  const turnkeySigner = new TurnkeySigner({
    client: turnkeyClient.apiClient(),
    organizationId: process.env.ORGANIZATION_ID!,
    signWith: process.env.SIGN_WITH!,
  });

  // Bring your own provider (such as Alchemy or Infura: https://docs.ethers.org/v6/api/providers/)
  const network = "sepolia";
  const provider = new ethers.JsonRpcProvider(
    `https://${network}.infura.io/v3/${process.env.INFURA_KEY}`
  );
  const connectedSigner = turnkeySigner.connect(provider);

  const chainId = (await connectedSigner.provider?.getNetwork())?.chainId ?? 0;
  const address = await connectedSigner.getAddress();
  const balance = (await connectedSigner.provider?.getBalance(address)) ?? 0;
  const transactionCount = await connectedSigner.provider?.getTransactionCount(
    address
  );

  print("Network:", `${network} (chain ID ${chainId})`);
  print("Address:", address);
  print("Balance:", `${ethers.formatEther(balance)} Ether`);
  print("Transaction count:", `${transactionCount}`);

  // Create a simple send transaction
  const transactionAmount = "0.00001";
  const destinationAddress = "0x2Ad9eA1E677949a536A270CEC812D6e868C88108";
  const transactionRequest = {
    to: destinationAddress,
    value: ethers.parseEther(transactionAmount),
    type: 2,
  };

  if (balance === 0) {
    let warningMessage =
      "The transaction won't be broadcasted because your account balance is zero.\n";
    if (network === "sepolia") {
      warningMessage +=
        "Use https://sepoliafaucet.com/ to request funds on Sepolia, then run the script again.\n";
    }

    console.warn(warningMessage);
    return;
  }

  let sentTx;

  // Simple send tx.
  // If it does not succeed at first, wait for consensus, then attempt to broadcast the signed transaction
  try {
    sentTx = await connectedSigner.sendTransaction(transactionRequest);
  } catch (error: any) {
    const activityId = error["activityId"];
    let activityStatus = error["activityStatus"];

    while (!TERMINAL_ACTIVITY_STATUSES.includes(activityStatus)) {
      console.log("Waiting for consensus...");

      // Wait 5 seconds
      await sleep(5_000);

      // Refresh activity status
      activityStatus = (
        await turnkeyClient.apiClient().getActivity({
          activityId,
          organizationId: process.env.ORGANIZATION_ID!,
        })
      ).activity.status;
    }

    console.log("Consensus reached! Moving onto broadcasting...");

    // Break out of loop now that we have an activity that has reached terminal status.
    // Get the signature
    const signedTransaction =
      await connectedSigner.getSignedTransactionFromActivity(activityId);

    sentTx = await connectedSigner.provider?.broadcastTransaction(
      signedTransaction
    );
  }

  print(
    `Sent ${ethers.formatEther(sentTx!.value)} Ether to ${sentTx!.to}:`,
    `https://${network}.etherscan.io/tx/${sentTx!.hash}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

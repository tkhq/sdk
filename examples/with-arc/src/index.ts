import * as path from "path";
import * as dotenv from "dotenv";
import prompts from "prompts";
import { ethers } from "ethers";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import {
  getSignedTransactionFromActivity,
  TurnkeyActivityConsensusNeededError,
  TERMINAL_ACTIVITY_STATUSES,
  TActivity,
} from "@turnkey/http";
import { TurnkeySigner } from "@turnkey/ethers";
import { Turnkey as TurnkeyServerSDK } from "@turnkey/sdk-server";
import { createNewWallet } from "./createNewWallet";
import { print } from "./util";

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
    // of 3 times with an interval of 1000 milliseconds. Otherwise, use the values below.
    //
    // -----
    //
    // activityPoller: {
    //   intervalMs: 5_000,
    //   numRetries: 10,
    // },
  });

  // Initialize a Turnkey Signer
  const turnkeySigner = new TurnkeySigner({
    client: turnkeyClient.apiClient(),
    organizationId: process.env.ORGANIZATION_ID!,
    signWith: process.env.SIGN_WITH!,
  });

  const network = "arc testnet";
  const provider = new ethers.JsonRpcProvider(
    `https://rpc.testnet.arc.network/`,
  );
  const connectedSigner = turnkeySigner.connect(provider);

  const chainId = (await connectedSigner.provider?.getNetwork())?.chainId ?? 0;
  const address = await connectedSigner.getAddress();
  const transactionCount =
    await connectedSigner.provider?.getTransactionCount(address);
  let balance = (await connectedSigner.provider?.getBalance(address)) ?? 0;

  print("Network:", `${network} (chain ID ${chainId})`);
  print("Address:", address);
  print("Balance:", `${ethers.formatEther(balance)} USDC`);
  print("Transaction count:", `${transactionCount}`);

  // create a simple send transaction
  const { amount, destination } = await prompts([
    {
      type: "text",
      name: "amount",
      message: "Amount to send in USDC (default is 1 cent)",
      initial: "0.01",
    },
    {
      type: "text",
      name: "destination",
      message: "Destination address (default is yourself)",
      initial: address,
    },
  ]);
  const transactionRequest = {
    to: destination,
    value: ethers.parseEther(amount),
    type: 2,
  };

  const populatedTx =
    await connectedSigner.populateTransaction(transactionRequest);

  let signedTx;
  try {
    signedTx = await connectedSigner.signTransaction(populatedTx);
  } catch (error: any) {
    signedTx = await handleActivityError(error).then(
      async (activity?: TActivity) => {
        if (!activity) {
          throw error;
        }

        return getSignedTransactionFromActivity(activity);
      },
    );
  }

  print("Turnkey-signed transaction:", `${signedTx}`);

  while (balance === 0) {
    console.log(
      [
        `\nYour onchain balance is at 0! To continue this demo you'll need testnet funds! You can use:`,
        `- Arc's testnet faucet (e.g. https://faucet.circle.com/)`,
        `\nTo check your balance: https://testnet.arcscan.app/address/${address}`,
        `\n--------`,
      ].join("\n"),
    );

    await prompts([
      {
        type: "text",
        name: "continue",
        message: "Ready to continue? y/n",
        initial: "y",
      },
    ]);

    balance = (await connectedSigner.provider?.getBalance(address))!;
  }

  let sentTx;
  try {
    sentTx = await connectedSigner.sendTransaction(populatedTx);
  } catch (error: any) {
    sentTx = await handleActivityError(error).then(
      async (activity?: TActivity) => {
        if (!activity) {
          throw error;
        }

        return await connectedSigner.provider?.broadcastTransaction(
          getSignedTransactionFromActivity(activity),
        );
      },
    );
  }

  print(
    `Sent ${ethers.formatEther(sentTx!.value)} USDC to ${sentTx!.to}:`,
    `https://testnet.arcscan.app/tx/${sentTx!.hash}`,
  );

  async function handleActivityError(error: any) {
    if (error instanceof TurnkeyActivityConsensusNeededError) {
      const activityId = error["activityId"]!;
      let activityStatus = error["activityStatus"]!;
      let activity: TActivity | undefined;

      while (!TERMINAL_ACTIVITY_STATUSES.includes(activityStatus)) {
        console.log("\nWaiting for consensus...\n");

        const { retry } = await prompts([
          {
            type: "text",
            name: "retry",
            message: "Consensus reached? y/n",
            initial: "y",
          },
        ]);

        if (retry === "n") {
          continue;
        }

        // Refresh activity status
        activity = (
          await turnkeyClient.apiClient().getActivity({
            activityId,
            organizationId: process.env.ORGANIZATION_ID!,
          })
        ).activity;
        activityStatus = activity.status;
      }

      console.log("\nConsensus reached! Moving on...\n");

      return activity;
    }

    // Rethrow error
    throw error;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

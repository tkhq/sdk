import * as path from "path";
import * as dotenv from "dotenv";

import { createAccount, getSignedTransactionFromActivity } from "@turnkey/viem";
import {
  Turnkey as TurnkeyServerSDK,
  TERMINAL_ACTIVITY_STATUSES,
} from "@turnkey/sdk-server";
import { createWalletClient, http, type Account } from "viem";
import { sepolia } from "viem/chains";
import { print, sleep } from "./util";
import { createNewWallet } from "./createNewWallet";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

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

  const turnkeyAccount = await createAccount({
    client: turnkeyClient.apiClient(),
    organizationId: process.env.ORGANIZATION_ID!,
    signWith: process.env.SIGN_WITH!,
  });

  const client = createWalletClient({
    account: turnkeyAccount as Account,
    chain: sepolia,
    transport: http(
      `https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY!}`
    ),
  });

  // This demo sends ETH back to our faucet (we keep a bunch of Sepolia ETH at this address)
  const turnkeyFaucet = "0x08d2b0a37F869FF76BACB5Bab3278E26ab7067B7";

  // 1. Simple send tx
  const transactionRequest = {
    to: turnkeyFaucet as `0x${string}`,
    value: 1000000000000000n,
  };

  let txHash;

  // Simple send tx.
  // If it does not succeed at first, wait for consensus, then attempt to broadcast the signed transaction
  try {
    txHash = await client.sendTransaction(transactionRequest);
  } catch (error: any) {
    console.log("error", error);
    const parsedErrorMessage = JSON.parse(error["shortMessage"])["cause"][
      "shortMessage"
    ];
    const parsedTurnkeyError = JSON.parse(parsedErrorMessage);

    const activityId = parsedTurnkeyError["activityId"];
    let activityStatus = parsedTurnkeyError["activityStatus"];

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
    const signedTransaction = await getSignedTransactionFromActivity(
      turnkeyClient.apiClient(),
      process.env.ORGANIZATION_ID!,
      activityId
    );

    txHash = await client.sendRawTransaction({
      serializedTransaction: signedTransaction,
    });
  }

  print("Source address", client.account.address);
  print("Transaction sent", `https://sepolia.etherscan.io/tx/${txHash}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

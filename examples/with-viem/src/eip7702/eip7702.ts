import * as path from "path";
import * as dotenv from "dotenv";
import prompts, { PromptType } from "prompts";
import {
  createWalletClient,
  http,
  recoverMessageAddress,
  type Account,
} from "viem";
import { sepolia } from "viem/chains";
import { eip7702Actions } from "viem/experimental";

import {
  TERMINAL_ACTIVITY_STATUSES,
  getSignatureFromActivity,
  getSignedTransactionFromActivity,
  type TActivity,
} from "@turnkey/http";
import {
  createAccount,
  isTurnkeyActivityConsensusNeededError,
  serializeSignature,
} from "@turnkey/viem";
import { Turnkey as TurnkeyServerSDK } from "@turnkey/sdk-server";
import { print, assertEqual } from "./util";
import { createNewWallet } from "./createNewWallet";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const WETH_TOKEN_ADDRESS_SEPOLIA = "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9";

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
    // of 3 times with an interval of 10000 milliseconds.
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

  // If you would like to create a Viem account synchronously,
  // import `createAccountWithAddress` and provide an Ethereum address as well
  //
  // -----
  //
  // const turnkeyAccount = createAccountWithAddress({
  //   client: turnkeyClient.apiClient(),
  //   organizationId: process.env.ORGANIZATION_ID!,
  //   signWith: process.env.SIGN_WITH!,
  //   ethereumAddress: process.env.ETHEREUM_ADDRESS!,
  // });

  const client = createWalletClient({
    account: turnkeyAccount as Account,
    chain: sepolia,
    transport: http(
      `https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY!}`,
    ),
  });

  const address = client.account.address;

  const authorization = await client.signAuthorization({
    contractAddress: WETH_TOKEN_ADDRESS_SEPOLIA,
  });

  const hash = await client.sendTransaction({
    authorizationList: [authorization],
    data: encodeFunctionData({
      abi,
      functionName: "execute",
      args: [
        [
          {
            data: "0x",
            to: "0xcb98643b8786950F0461f3B0edf99D88F274574D",
            value: parseEther("0.001"),
          },
          {
            data: "0x",
            to: "0xd2135CfB216b74109775236E36d4b433F1DF507B",
            value: parseEther("0.002"),
          },
        ],
      ],
    }),
    to: address,
  });

  print("Source address", client.account.address);
  print("Transaction sent", `https://sepolia.etherscan.io/tx/${txHash}`);

  async function handleActivityError(error: any) {
    if (isTurnkeyActivityConsensusNeededError(error)) {
      // Turnkey-specific error details may be wrapped by higher level errors
      const activityId = error["activityId"] || error["cause"]["activityId"];
      let activityStatus =
        error["activityStatus"] || error["cause"]["activityId"];
      let activity: TActivity | undefined;

      while (!TERMINAL_ACTIVITY_STATUSES.includes(activityStatus)) {
        console.log("\nWaiting for consensus...\n");

        const { retry } = await prompts([
          {
            type: "text" as PromptType,
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

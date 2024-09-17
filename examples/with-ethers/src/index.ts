import * as path from "path";
import * as dotenv from "dotenv";
import prompts, { PromptType } from "prompts";
import { ethers } from "ethers";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import {
  getSignatureFromActivity,
  getSignedTransactionFromActivity,
  TurnkeyActivityConsensusNeededError,
  TERMINAL_ACTIVITY_STATUSES,
  TActivity,
} from "@turnkey/http";
import { TurnkeySigner, serializeSignature } from "@turnkey/ethers";
import { Turnkey as TurnkeyServerSDK } from "@turnkey/sdk-server";
import { createNewWallet } from "./createNewWallet";
import { print, assertEqual } from "./util";
import WETH_TOKEN_ABI from "./weth-contract-abi.json";

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

  // Bring your own provider (such as Alchemy or Infura: https://docs.ethers.org/v6/api/providers/)
  const network = "sepolia";
  const provider = new ethers.JsonRpcProvider(
    `https://${network}.infura.io/v3/${process.env.INFURA_KEY}`
  );
  const connectedSigner = turnkeySigner.connect(provider);

  const chainId = (await connectedSigner.provider?.getNetwork())?.chainId ?? 0;
  const address = await connectedSigner.getAddress();
  const transactionCount = await connectedSigner.provider?.getTransactionCount(
    address
  );
  let balance = (await connectedSigner.provider?.getBalance(address)) ?? 0;

  print("Network:", `${network} (chain ID ${chainId})`);
  print("Address:", address);
  print("Balance:", `${ethers.formatEther(balance)} Ether`);
  print("Transaction count:", `${transactionCount}`);

  // 1. Sign a raw payload (`eth_sign` style)
  const { message } = await prompts([
    {
      type: "text" as PromptType,
      name: "message",
      message: "Message to sign",
      initial: "Hello Turnkey",
    },
  ]);

  let signature;
  try {
    signature = await connectedSigner.signMessage(message);
  } catch (error: any) {
    signature = await handleActivityError(error).then(
      async (activity?: TActivity) => {
        if (!activity) {
          throw error;
        }

        return serializeSignature(getSignatureFromActivity(activity));
      }
    );
  }

  const recoveredAddress = ethers.verifyMessage(message, signature);

  print("Turnkey-powered signature:", `${signature}`);
  print("Recovered address:", `${recoveredAddress}`);
  assertEqual(recoveredAddress, address);

  // 2. Create a simple send transaction
  const { amount, destination } = await prompts([
    {
      type: "number" as PromptType,
      name: "amount",
      message: "Amount to send (wei). Default to 0.0000001 ETH",
      initial: 100000000000,
    },
    {
      type: "text" as PromptType,
      name: "destination",
      message: "Destination address (default to TKHQ warchest)",
      initial: "0x08d2b0a37F869FF76BACB5Bab3278E26ab7067B7",
    },
  ]);
  const transactionRequest = {
    to: destination,
    value: amount,
    type: 2,
  };

  let signedTx;
  try {
    signedTx = await connectedSigner.signTransaction(transactionRequest);
  } catch (error: any) {
    signedTx = await handleActivityError(error).then(
      async (activity?: TActivity) => {
        if (!activity) {
          throw error;
        }

        return getSignedTransactionFromActivity(activity);
      }
    );
  }

  print("Turnkey-signed transaction:", `${signedTx}`);

  while (balance === 0) {
    console.log(
      [
        `\n💸 Your onchain balance is at 0! To continue this demo you'll need testnet funds! You can use:`,
        `- Any online faucet (e.g. https://www.alchemy.com/faucets/)`,
        `\nTo check your balance: https://${network}.etherscan.io/address/${address}`,
        `\n--------`,
      ].join("\n")
    );

    const { continue: _ } = await prompts([
      {
        type: "text" as PromptType,
        name: "continue",
        message: "Ready to continue? y/n",
        initial: "y",
      },
    ]);

    balance = (await connectedSigner.provider?.getBalance(address))!;
  }

  // 3. Make a simple send tx (which calls `signTransaction` under the hood)
  let sentTx;
  try {
    sentTx = await connectedSigner.sendTransaction(transactionRequest);
  } catch (error: any) {
    sentTx = await handleActivityError(error).then(
      async (activity?: TActivity) => {
        if (!activity) {
          throw error;
        }

        return await connectedSigner.provider?.broadcastTransaction(
          getSignedTransactionFromActivity(activity)
        );
      }
    );
  }

  print(
    `Sent ${ethers.formatEther(sentTx!.value)} Ether to ${sentTx!.to}:`,
    `https://${network}.etherscan.io/tx/${sentTx!.hash}`
  );

  if (network === "sepolia") {
    // https://sepolia.etherscan.io/address/0xb4fbf271143f4fbf7b91a5ded31805e42b2208d6
    const wethContract = new ethers.Contract(
      WETH_TOKEN_ADDRESS_SEPOLIA,
      WETH_TOKEN_ABI,
      connectedSigner
    );

    // Read from contract
    const wethBalance = await wethContract?.balanceOf?.(address);

    print("WETH Balance:", `${ethers.formatEther(wethBalance)} WETH`);

    const { wrapAmount } = await prompts([
      {
        type: "number" as PromptType,
        name: "wrapAmount",
        message: "Amount to wrap (wei). Default to 0.0000001 ETH",
        initial: 100000000000,
      },
    ]);

    // 3. Wrap ETH -> WETH
    let depositTx;
    try {
      depositTx = await wethContract?.deposit?.({
        value: wrapAmount,
      });
    } catch (error: any) {
      depositTx = await handleActivityError(error).then(
        async (activity?: TActivity) => {
          if (!activity) {
            throw error;
          }

          return await connectedSigner.provider?.broadcastTransaction(
            getSignedTransactionFromActivity(activity)
          );
        }
      );
    }

    print(
      `Wrapped ${ethers.formatEther(depositTx.value)} ETH:`,
      `https://${network}.etherscan.io/tx/${depositTx.hash}`
    );
  }

  async function handleActivityError(error: any) {
    if (error instanceof TurnkeyActivityConsensusNeededError) {
      const activityId = error["activityId"]!;
      let activityStatus = error["activityStatus"]!;
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

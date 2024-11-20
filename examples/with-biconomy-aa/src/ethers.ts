import * as path from "path";
import * as dotenv from "dotenv";
import prompts, { PromptType } from "prompts";
import { ethers } from "ethers";
import {
  createSmartAccountClient,
  LightSigner,
  BiconomySmartAccountV2,
  PaymasterMode,
} from "@biconomy/account";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

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
  });

  // Initialize a Turnkey Signer via Ethers v6
  const turnkeySigner = new TurnkeySigner({
    client: turnkeyClient.apiClient(),
    organizationId: process.env.ORGANIZATION_ID!,
    signWith: process.env.SIGN_WITH!,
  });

  // Bring your own provider
  const network = "sepolia";
  const provider = new ethers.JsonRpcProvider(
    `https://${network}.infura.io/v3/${process.env.INFURA_KEY}`
  );
  const connectedSigner = turnkeySigner.connect(provider);

  // Connect a TurnkeySigner to a Biconomy Smart Account Client, defaulting to Sepolia
  // Ensure this method is hoisted
  const connect = async (
    turnkeySigner: TurnkeySigner
  ): Promise<BiconomySmartAccountV2> => {
    try {
      const smartAccount = await createSmartAccountClient({
        signer: turnkeySigner as LightSigner,
        bundlerUrl: process.env.BICONOMY_BUNDLER_URL!, // <-- Read about this at https://docs.biconomy.io/dashboard#bundler-url
        biconomyPaymasterApiKey: process.env.BICONOMY_PAYMASTER_API_KEY!, // <-- Read about at https://docs.biconomy.io/dashboard/paymaster
        rpcUrl: `https://${network}.infura.io/v3/${process.env.INFURA_KEY!}`, // <-- read about this at https://docs.biconomy.io/account/methods#createsmartaccountclient
        chainId: Number(chainId),
      });

      return smartAccount;
    } catch (error: any) {
      throw new Error(error);
    }
  };

  const chainId = (await connectedSigner.provider?.getNetwork())?.chainId ?? 0;
  const signerAddress = await connectedSigner.getAddress(); // signer

  const smartAccount = await connect(turnkeySigner);
  const smartAccountAddress = await smartAccount.getAccountAddress();

  const transactionCount = await connectedSigner.provider?.getTransactionCount(
    smartAccountAddress
  );
  const nonce = await smartAccount.getNonce();
  let balance =
    (await connectedSigner.provider?.getBalance(smartAccountAddress)) ?? 0;

  print("Network:", `${network} (chain ID ${chainId})`);
  print("Signer address:", signerAddress);
  print("Smart wallet address:", smartAccountAddress);
  print("Balance:", `${ethers.formatEther(balance)} Ether`);
  print("Transaction count:", `${transactionCount}`);
  print("Nonce:", `${nonce}`);

  while (balance === 0n) {
    console.log(
      [
        `\n💸 Your onchain balance is at 0! To continue this demo you'll need testnet funds! You can use:`,
        `- Any online faucet (e.g. https://www.alchemy.com/faucets/)`,
        `\nTo check your balance: https://${network}.etherscan.io/address/${smartAccountAddress}`,
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

    balance = (await connectedSigner.provider?.getBalance(
      smartAccountAddress
    ))!;
  }

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

  // Make a simple send tx (which calls `signTransaction` under the hood)
  const userOpResponse = await smartAccount?.sendTransaction(
    transactionRequest,
    {
      nonceOptions: { nonceKey: Number(0) },
      paymasterServiceData: { mode: PaymasterMode.SPONSORED },
    }
  );

  const { transactionHash } = await userOpResponse.waitForTxHash();

  print(
    `Sent ${ethers.formatEther(transactionRequest.value)} Ether to ${
      transactionRequest.to
    }:`,
    `https://${network}.etherscan.io/tx/${transactionHash}`
  );

  print(
    `User Ops can be found here:`,
    `https://v2.jiffyscan.xyz/tx/${transactionHash}?network=${network}&pageNo=0&pageSize=10`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

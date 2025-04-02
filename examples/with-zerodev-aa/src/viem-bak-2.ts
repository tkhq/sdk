import * as path from "path";
import * as dotenv from "dotenv";
import prompts, { PromptType } from "prompts";

import {
  createWalletClient,
  createPublicClient,
  http,
  type Account,
  formatEther,
} from "viem";
import { sepolia } from "viem/chains";

import { signerToEcdsaValidator } from "@zerodev/ecdsa-validator";
import { KERNEL_V3_1 } from "@zerodev/sdk/constants";
import {
  createKernelAccount,
  createZeroDevPaymasterClient,
  createKernelAccountClient,
} from "@zerodev/sdk";
import {
  walletClientToSmartAccountSigner,
  createBundlerClient,
  ENTRYPOINT_ADDRESS_V07,
} from "permissionless";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { createAccount } from "@turnkey/viem";
import { Turnkey as TurnkeyServerSDK } from "@turnkey/sdk-server";
import { createNewWallet } from "./createNewWallet";
import { print } from "./util";

async function main() {
  if (!process.env.SIGN_WITH) {
    // If you don't specify a `SIGN_WITH`, we'll create a new wallet for you via calling the Turnkey API.
    await createNewWallet();
    return;
  }

  const BUNDLER_RPC = process.env.ZERODEV_BUNDLER_RPC!;
  const PAYMASTER_RPC = process.env.ZERODEV_PAYMASTER_RPC!;

  const chain = sepolia;
  const network = "sepolia";
  const entryPoint = ENTRYPOINT_ADDRESS_V07;
  const kernelVersion = KERNEL_V3_1;

  const turnkeyClient = new TurnkeyServerSDK({
    apiBaseUrl: process.env.BASE_URL!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    defaultOrganizationId: process.env.ORGANIZATION_ID!,
  });

  // Initialize a Turnkey-powered Viem Account
  const turnkeyAccount = await createAccount({
    client: turnkeyClient.apiClient(),
    organizationId: process.env.ORGANIZATION_ID!,
    signWith: process.env.SIGN_WITH!,
  });

  // Create Viem client for signer
  const client = createWalletClient({
    account: turnkeyAccount as Account,
    chain: sepolia,
    transport: http(BUNDLER_RPC),
  });

  // Create public client for fetching chain data
  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(BUNDLER_RPC),
  });

  const smartAccountSigner = walletClientToSmartAccountSigner(client);

  // Construct a validator
  const ecdsaValidator = await signerToEcdsaValidator(publicClient, {
    signer: smartAccountSigner,
    entryPoint,
    kernelVersion,
  });

  // Construct a Kernel account
  const account = await createKernelAccount(publicClient, {
    plugins: {
      sudo: ecdsaValidator,
    },
    entryPoint,
    kernelVersion,
  });

  // Construct a Kernel account client
  const kernelClient = createKernelAccountClient({
    account,
    chain,
    entryPoint,
    bundlerTransport: http(BUNDLER_RPC),
    middleware: {
      sponsorUserOperation: async ({ userOperation }) => {
        const zerodevPaymaster = createZeroDevPaymasterClient({
          chain,
          entryPoint,
          transport: http(PAYMASTER_RPC),
        });
        return zerodevPaymaster.sponsorUserOperation({
          userOperation,
          entryPoint,
        });
      },
    },
  });

  const chainId = client.chain.id;
  const signerAddress = client.account.address;
  const smartAccountAddress = kernelClient.account.address;

  const transactionCount = await publicClient.getTransactionCount({
    address: smartAccountAddress,
  });

  const nonce = await kernelClient.account.getNonce();
  let balance =
    (await publicClient.getBalance({ address: smartAccountAddress })) ?? 0;

  print("Network:", `${network} (chain ID ${chainId})`);
  print("Signer address:", signerAddress);
  print("Smart wallet address:", smartAccountAddress);
  print("Balance:", `${formatEther(balance)} Ether`);
  print("Transaction count:", `${transactionCount}`);
  print("Nonce:", `${nonce}`);

  while (balance === BigInt(0)) {
    console.log(
      [
        `\n💸 Your onchain balance is at 0! To continue this demo you'll need testnet funds! You can use:`,
        `- Any online faucet (e.g. https://www.alchemy.com/faucets/)`,
        `\nTo check your balance: https://${network}.etherscan.io/address/${smartAccountAddress}`,
        `\n--------`,
      ].join("\n"),
    );

    const { continue: _ } = await prompts([
      {
        type: "text" as PromptType,
        name: "continue",
        message: "Ready to continue? y/n",
        initial: "y",
      },
    ]);

    balance = await publicClient.getBalance({ address: smartAccountAddress });
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
  const userOpHash = await kernelClient.sendUserOperation({
    userOperation: {
      callData: await account.encodeCallData({
        to: transactionRequest.to,
        value: transactionRequest.value,
        data: "0x",
      }),
    },
  });

  const bundlerClient = createBundlerClient({
    entryPoint,
    transport: http(BUNDLER_RPC),
  });

  const { receipt } = await bundlerClient.waitForUserOperationReceipt({
    hash: userOpHash,
    timeout: 60_000, // 1 minute
  });

  print(
    `Sent ${formatEther(transactionRequest.value)} Ether to ${
      transactionRequest.to
    }:`,
    `https://${network}.etherscan.io/tx/${receipt.transactionHash}`,
  );

  print(
    `Bundle can be found here:`,
    `https://jiffyscan.xyz/bundle/${receipt.transactionHash}?network=${network}&pageNo=0&pageSize=10`,
  );

  print(
    `User Ops can be found here:`,
    `https://jiffyscan.xyz/userOpHash/${receipt.transactionHash}?network=${network}&pageNo=0&pageSize=10`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

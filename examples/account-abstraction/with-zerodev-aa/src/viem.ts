// Note: this is a Turnkey-specific adaptation of https://github.com/zerodevapp/zerodev-examples/blob/9d348ae55000fb8417551361bc15ea7a3971aaaf/tutorial/completed.ts
// Following along in the tutorial here: https://docs.zerodev.app/sdk/getting-started/tutorial
import * as path from "path";
import * as dotenv from "dotenv";

import { createPublicClient, encodeFunctionData, http, parseAbi } from "viem";
import { sepolia } from "viem/chains";
import { signerToEcdsaValidator } from "@zerodev/ecdsa-validator";
import {
  createKernelAccount,
  createKernelAccountClient,
  createZeroDevPaymasterClient,
} from "@zerodev/sdk";
import { getEntryPoint, KERNEL_V3_1 } from "@zerodev/sdk/constants";

import { createAccount } from "@turnkey/viem";
import { Turnkey as TurnkeyServerSDK } from "@turnkey/sdk-server";

import { print } from "./util";
import { createNewWallet } from "./createNewWallet";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

if (!process.env.ZERODEV_RPC) {
  throw new Error("ZERODEV_RPC is not set");
}

const ZERODEV_RPC = process.env.ZERODEV_RPC;

// The NFT contract we will be interacting with
const contractAddress = "0x34bE7f35132E97915633BC1fc020364EA5134863";
const contractABI = parseAbi([
  "function mint(address _to) public",
  "function balanceOf(address owner) external view returns (uint256 balance)",
]);

const turnkeyClient = new TurnkeyServerSDK({
  apiBaseUrl: process.env.BASE_URL!,
  apiPrivateKey: process.env.API_PRIVATE_KEY!,
  apiPublicKey: process.env.API_PUBLIC_KEY!,
  defaultOrganizationId: process.env.ORGANIZATION_ID!,
});

const main = async () => {
  if (!process.env.SIGN_WITH) {
    // If you don't specify a `SIGN_WITH`, we'll create a new wallet for you via calling the Turnkey API.
    await createNewWallet();
    return;
  }

  // Initialize a Turnkey-powered Viem Account
  const turnkeyAccount = await createAccount({
    client: turnkeyClient.apiClient(),
    organizationId: process.env.ORGANIZATION_ID!,
    signWith: process.env.SIGN_WITH!,
  });

  // Construct a public client
  const chain = sepolia;
  const publicClient = createPublicClient({
    transport: http(ZERODEV_RPC),
    chain,
  });
  const entryPoint = getEntryPoint("0.7");

  // Construct a validator
  const ecdsaValidator = await signerToEcdsaValidator(publicClient, {
    signer: turnkeyAccount,
    entryPoint,
    kernelVersion: KERNEL_V3_1,
  });

  // Construct a Kernel account
  const account = await createKernelAccount(publicClient, {
    entryPoint,
    plugins: {
      sudo: ecdsaValidator,
    },
    kernelVersion: KERNEL_V3_1,
  });

  const zerodevPaymaster = createZeroDevPaymasterClient({
    chain,
    transport: http(ZERODEV_RPC),
  });

  // Construct a Kernel account client
  const kernelClient = createKernelAccountClient({
    account,
    chain,
    bundlerTransport: http(ZERODEV_RPC),
    paymaster: {
      getPaymasterData(userOperation) {
        return zerodevPaymaster.sponsorUserOperation({ userOperation });
      },
    },
  });

  const accountAddress = kernelClient.account.address;

  print("My account:", accountAddress);

  // Send a UserOp
  const userOpHash = await kernelClient.sendUserOperation({
    callData: await kernelClient.account.encodeCalls([
      {
        to: contractAddress,
        value: BigInt(0),
        data: encodeFunctionData({
          abi: contractABI,
          functionName: "mint",
          args: [accountAddress],
        }),
      },
    ]),
  });

  print("Submitted UserOp:", userOpHash);

  // Wait for the UserOp to be included on-chain
  const receipt = await kernelClient.waitForUserOperationReceipt({
    hash: userOpHash,
  });

  print(
    "UserOp confirmed:",
    `https://v2.jiffyscan.xyz/userOpHash/${receipt.userOpHash}?network=sepolia&section=overview`,
  );

  print(
    "TxHash:",
    `https://sepolia.etherscan.io/tx/${receipt.receipt.transactionHash}`,
  );

  // Print NFT balance
  const nftBalance = await publicClient.readContract({
    address: contractAddress,
    abi: contractABI,
    functionName: "balanceOf",
    args: [accountAddress],
  });

  print("NFT balance:", `${nftBalance}`);

  process.exit(0);
};

main();

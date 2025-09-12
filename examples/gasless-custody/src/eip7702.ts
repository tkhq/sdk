import { resolve } from "path";
import * as dotenv from "dotenv";

import { createPublicClient, http, encodeFunctionData, parseAbi, formatUnits } from "viem";
import { sepolia } from "viem/chains";
import { getEntryPoint, KERNEL_V3_3 } from "@zerodev/sdk/constants";
import {
  create7702KernelAccount,
  create7702KernelAccountClient,
} from "@zerodev/ecdsa-validator";
import {
  createZeroDevPaymasterClient,
  getUserOperationGasPrice,
} from "@zerodev/sdk";

import { createAccount } from "@turnkey/viem";
import { Turnkey as TurnkeyServerSDK } from "@turnkey/sdk-server";

import { createNewWallet } from "./createNewWallet";
import { sweepFunds } from "./sweepFunds";

// Load environment variables from `.env.local`
dotenv.config({ path: resolve(process.cwd(), ".env.local") });

if (!process.env.ZERODEV_RPC) {
  throw new Error("ZERODEV_RPC is not set");
}

const ZERODEV_RPC = process.env.ZERODEV_RPC;
const entryPoint = getEntryPoint("0.7");
const kernelVersion = KERNEL_V3_3;

// We use the Sepolia testnet here, but you can use any network that
// supports EIP-7702.
const chain = sepolia;

// ERC20 Token configuration - using USDC on Sepolia as an example
// You can replace this with any ERC20 token address and ABI
const TOKEN_ADDRESS = (process.env.TOKEN_ADDRESS || "0x1c7d4b196cb0c7b01d743fbc6116a902379c7238") as `0x${string}`; // USDC on Sepolia
const TOKEN_ABI = parseAbi([
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
  "function symbol() external view returns (string)",
  "function name() external view returns (string)",
]);

// Configuration for the transfer
const TRANSFER_AMOUNT = process.env.TRANSFER_AMOUNT || "10000"; // Amount in smallest unit (e.g., 1 USDC = 1000000 for 6 decimals)
const OMNIBUS_ADDRESS = process.env.OMNIBUS_ADDRESS as `0x${string}`;

const publicClient = createPublicClient({
  transport: http(),
  chain,
});

const turnkeyClient = new TurnkeyServerSDK({
  apiBaseUrl: process.env.BASE_URL!,
  apiPrivateKey: process.env.API_PRIVATE_KEY!,
  apiPublicKey: process.env.API_PUBLIC_KEY!,
  defaultOrganizationId: process.env.ORGANIZATION_ID!,
});


const main = async () => {

  // Initialize sender account
  const turnkeyAccount = await createAccount({
    client: turnkeyClient.apiClient(),
    organizationId: process.env.ORGANIZATION_ID!,
    signWith: process.env.SIGN_WITH!,
  });

  // Generate recipient wallet
  const recipientWallet = await createNewWallet({
    walletName: `Recipient Wallet ${Date.now()}`,
    isRecipient: true,
    turnkeyClient,
  });

  // Create EIP-7702 kernel account
  const account = await create7702KernelAccount(publicClient, {
    signer: turnkeyAccount as any,
    entryPoint,
    kernelVersion,
  });

  // Set up ZeroDev paymaster and kernel client
  const paymasterClient = createZeroDevPaymasterClient({
    chain,
    transport: http(ZERODEV_RPC),
  });

  const kernelClient = create7702KernelAccountClient({
    account,
    chain,
    bundlerTransport: http(ZERODEV_RPC),
    userOperation: {
      estimateFeesPerGas: async ({ bundlerClient }) => {
        return getUserOperationGasPrice(bundlerClient);
      },
    },
    paymaster: {
      getPaymasterData: (userOperation) => {
        return paymasterClient.sponsorUserOperation({
          userOperation,
        });
      },
    },
    client: publicClient,
  });

  // Get token info and validate balance
  const [tokenSymbol, tokenDecimals, currentBalance] = await Promise.all([
    publicClient.readContract({
      address: TOKEN_ADDRESS,
      abi: TOKEN_ABI,
      functionName: "symbol",
    }),
    publicClient.readContract({
      address: TOKEN_ADDRESS,
      abi: TOKEN_ABI,
      functionName: "decimals",
    }),
    publicClient.readContract({
      address: TOKEN_ADDRESS,
      abi: TOKEN_ABI,
      functionName: "balanceOf",
      args: [account.address],
    }),
  ]);

  const transferAmount = BigInt(TRANSFER_AMOUNT);
  if (currentBalance < transferAmount) {
    throw new Error("Insufficient token balance");
  }

  // Send gasless ERC20 transfer
  const transferData = encodeFunctionData({
    abi: TOKEN_ABI,
    functionName: "transfer",
    args: [recipientWallet.address as `0x${string}`, transferAmount],
  });

  const userOpHash = await kernelClient.sendUserOperation({
    callData: await kernelClient.account.encodeCalls([
      {
        to: TOKEN_ADDRESS,
        value: BigInt(0),
        data: transferData,
      },
    ]),
  });

  const { receipt } = await kernelClient.waitForUserOperationReceipt({
    hash: userOpHash,
  });

  console.log(`Transfer completed: ${formatUnits(transferAmount, tokenDecimals)} ${tokenSymbol} sent to ${recipientWallet.address}`);
  console.log(`Transaction: ${chain.blockExplorers.default.url}/tx/${receipt.transactionHash}`);

  // Sweep tokens and ETH from recipient to omnibus address
  if (OMNIBUS_ADDRESS) {
    console.log(`\nSweeping funds from recipient to omnibus address: ${OMNIBUS_ADDRESS}`);
    await sweepFunds(recipientWallet.address, OMNIBUS_ADDRESS, TOKEN_ADDRESS, turnkeyClient, ZERODEV_RPC);
  }

  process.exit(0);
};

main();

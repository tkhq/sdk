import { resolve } from "path";
import * as dotenv from "dotenv";

import { Account, createPublicClient, createWalletClient, encodeFunctionData, http, formatUnits, decodeFunctionResult } from "viem";
import { baseSepolia } from "viem/chains";
import { getEntryPoint, KERNEL_V3_3, KernelVersionToAddressesMap } from "@zerodev/sdk/constants";
import {
  createKernelAccount,
  createKernelAccountClient,
  createZeroDevPaymasterClient,
  getUserOperationGasPrice,
} from "@zerodev/sdk";
import { createAccount } from "@turnkey/viem";
import { Turnkey as TurnkeyServerSDK } from "@turnkey/sdk-server";
import { createNewWallet } from "./createNewWallet";
import { TOKEN_ABI } from "./token_abi";

// Load environment variables from `.env.local`
dotenv.config({ path: resolve(process.cwd(), ".env.local") });

if (!process.env.ZERODEV_RPC) {
  throw new Error("ZERODEV_RPC is not set");
}

const ZERODEV_RPC = process.env.ZERODEV_RPC;
const entryPoint = getEntryPoint("0.7");
const kernelVersion = KERNEL_V3_3;
const kernelAddresses = KernelVersionToAddressesMap[kernelVersion];

// We use the Base Sepolia testnet here, but you can use any network that
// supports EIP-7702.
const chain = baseSepolia;

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
  // create a dummy wallet representing the user's wallet, in real world this is a browser wallet
  const userDummyWallet = await createNewWallet();
  
  // create signer and dummy user accounts
  const signerAccount = await createAccount({
    client: turnkeyClient.apiClient(),
    organizationId: process.env.ORGANIZATION_ID!,
    signWith: process.env.SIGN_WITH!,
  });

  const userAccount = await createAccount({
    client: turnkeyClient.apiClient(),
    organizationId: process.env.ORGANIZATION_ID!,
    signWith: userDummyWallet!,
  });

  // create clients for the accounts
  const signerClient = createWalletClient({
    account: signerAccount as Account,
    chain,
    transport: http(),
  });

  const userClient = createWalletClient({
    account: userAccount as Account,
    chain,
    transport: http(),
  });

  const signerKernelAccount = await createKernelAccount(publicClient, {
    eip7702Account: signerClient,
    entryPoint,
    kernelVersion,
  });

  const userKernelAccount = await createKernelAccount(publicClient, {
    eip7702Account: userClient,
    entryPoint,
    kernelVersion,
  });

  const paymasterClient = createZeroDevPaymasterClient({
    chain,
    transport: http(ZERODEV_RPC),
  });

  const signerKernelClient = createKernelAccountClient({
    account: signerKernelAccount,
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

  const userKernelClient = createKernelAccountClient({
    account: userKernelAccount,
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

  console.log("Deposit a small amount of stablecoin to above dummy account...");
  console.log("Press Enter to continue once you have deposited tokens to the dummy account...");
  
  // Wait for user input
  await new Promise<void>((resolve) => {
    process.stdin.once('data', () => {
      resolve();
    });
  });

  const userOpHash = await userKernelClient.sendUserOperation({
    callData: await userKernelClient.account.encodeCalls([
      {
        to: process.env.TOKEN_ADDRESS as `0x${string}`,
        value: BigInt(0),
        data: encodeFunctionData({
          abi: TOKEN_ABI,
          functionName: "transfer",
          args: [userKernelAccount.address, "10000"], // self-send 0.01 USDC (6 decimals)
        }),
      },
    ]),
  });

  console.log("Waiting for gasless transfer to complete...");

  const { receipt } = await userKernelClient.waitForUserOperationReceipt({
    hash: userOpHash,
  });
  console.log(
    "UserOp completed",
    `${chain.blockExplorers.default.url}/tx/${receipt.transactionHash}`,
  );

  // Sweep funds from recipient to omnibus address
  if (process.env.OMNIBUS_ADDRESS) {
    console.log("Starting fund sweep to omnibus address...");
    
    // Check token balance
    const [tokenSymbol, tokenDecimals, tokenBalance] = await Promise.all([
      publicClient.call({
        to: process.env.TOKEN_ADDRESS as `0x${string}`,
        data: encodeFunctionData({
          abi: TOKEN_ABI,
          functionName: "symbol",
        }),
      }).then(result => result.data ? decodeFunctionResult({
        abi: TOKEN_ABI,
        functionName: "symbol",
        data: result.data,
      }) as string : ""),
      publicClient.call({
        to: process.env.TOKEN_ADDRESS as `0x${string}`,
        data: encodeFunctionData({
          abi: TOKEN_ABI,
          functionName: "decimals",
        }),
      }).then(result => result.data ? decodeFunctionResult({
        abi: TOKEN_ABI,
        functionName: "decimals",
        data: result.data,
      }) as number : 0),
      publicClient.call({
        to: process.env.TOKEN_ADDRESS as `0x${string}`,
        data: encodeFunctionData({
          abi: TOKEN_ABI,
          functionName: "balanceOf",
          args: [userKernelAccount.address],
        }),
      }).then(result => result.data ? decodeFunctionResult({
        abi: TOKEN_ABI,
        functionName: "balanceOf",
        data: result.data,
      }) as bigint : BigInt(0)),
    ]);

    console.log(`Token balance: ${formatUnits(tokenBalance, tokenDecimals)} ${tokenSymbol}`);

    if (tokenBalance > BigInt(0)) {
      // Sweep tokens using existing userKernelClient
      console.log(`Sweeping ${formatUnits(tokenBalance, tokenDecimals)} ${tokenSymbol} to omnibus address...`);

      const sweepUserOpHash = await userKernelClient.sendUserOperation({
        callData: await userKernelClient.account.encodeCalls([
          {
            to: process.env.TOKEN_ADDRESS as `0x${string}`,
            value: BigInt(0),
            data: encodeFunctionData({
              abi: TOKEN_ABI,
              functionName: "transfer",
              args: [process.env.OMNIBUS_ADDRESS as `0x${string}`, tokenBalance],
            }),
          },
        ]),
      });

      console.log("Waiting for sweep transaction to complete...");

      const { receipt: sweepReceipt } = await userKernelClient.waitForUserOperationReceipt({
        hash: sweepUserOpHash,
      });

      console.log(`Sweep completed in transaction: ${chain.blockExplorers.default.url}/tx/${sweepReceipt.transactionHash}`);
    } else {
      console.log(`No ${tokenSymbol} tokens to sweep. Skipping...`);
    }

  } else {
    console.log("OMNIBUS_ADDRESS not set. Skipping fund sweep.");
  }

  process.exit(0);
};

main();

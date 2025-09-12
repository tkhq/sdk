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
import type { Turnkey as TurnkeyServerSDK } from "@turnkey/sdk-server";

// ERC20 Token ABI
const TOKEN_ABI = parseAbi([
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
  "function symbol() external view returns (string)",
  "function name() external view returns (string)",
]);

// Sweep function to transfer all tokens and ETH from recipient to omnibus address
export async function sweepFunds(
  recipientAddress: string,
  omnibusAddress: `0x${string}`,
  tokenAddress: `0x${string}`,
  turnkeyClient: TurnkeyServerSDK,
  zerodevRpc: string
) {
  const chain = sepolia;
  const entryPoint = getEntryPoint("0.7");
  const kernelVersion = KERNEL_V3_3;

  const publicClient = createPublicClient({
    transport: http(zerodevRpc),
    chain,
  });

  try {
    // Create a recipient account for signing sweep transactions
    const recipientAccount = await createAccount({
      client: turnkeyClient.apiClient(),
      organizationId: process.env.ORGANIZATION_ID!,
      signWith: recipientAddress,
    });

    // Create EIP-7702 kernel account for recipient
    const recipientKernelAccount = await create7702KernelAccount(publicClient, {
      signer: recipientAccount as any,
      entryPoint,
      kernelVersion,
    });

    // Set up ZeroDev paymaster and kernel client for recipient
    const paymasterClient = createZeroDevPaymasterClient({
      chain,
      transport: http(zerodevRpc),
    });

    const recipientKernelClient = create7702KernelAccountClient({
      account: recipientKernelAccount,
      chain,
      bundlerTransport: http(zerodevRpc),
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

    // Sweep ERC20 tokens
    const [tokenSymbol, tokenDecimals, tokenBalance] = await Promise.all([
      publicClient.readContract({
        address: tokenAddress,
        abi: TOKEN_ABI,
        functionName: "symbol",
      }),
      publicClient.readContract({
        address: tokenAddress,
        abi: TOKEN_ABI,
        functionName: "decimals",
      }),
      publicClient.readContract({
        address: tokenAddress,
        abi: TOKEN_ABI,
        functionName: "balanceOf",
        args: [recipientKernelAccount.address],
      }),
    ]);

    if (tokenBalance > BigInt(0)) {
      console.log(`Sweeping ${formatUnits(tokenBalance, tokenDecimals)} ${tokenSymbol} to omnibus...`);
      
      const sweepTokenData = encodeFunctionData({
        abi: TOKEN_ABI,
        functionName: "transfer",
        args: [omnibusAddress, tokenBalance],
      });

      const sweepUserOpHash = await recipientKernelClient.sendUserOperation({
        callData: await recipientKernelClient.account.encodeCalls([
          {
            to: tokenAddress,
            value: BigInt(0),
            data: sweepTokenData,
          },
        ]),
      });

      const { receipt: sweepReceipt } = await recipientKernelClient.waitForUserOperationReceipt({
        hash: sweepUserOpHash,
      });

      console.log(`Token sweep completed: ${chain.blockExplorers.default.url}/tx/${sweepReceipt.transactionHash}`);
    }

    // Sweep ETH (leave some for gas)
    const ethBalance = await publicClient.getBalance({
      address: recipientKernelAccount.address,
    });

    // Estimate gas for ETH transfer and leave some buffer
    const gasEstimate = BigInt(21000); // Basic ETH transfer gas
    const gasPrice = await publicClient.getGasPrice();
    const gasBuffer = gasEstimate * gasPrice * BigInt(2); // 2x buffer
    const sweepAmount = ethBalance > gasBuffer ? ethBalance - gasBuffer : BigInt(0);

    if (sweepAmount > BigInt(0)) {
      console.log(`Sweeping ${formatUnits(sweepAmount, 18)} ETH to omnibus...`);
      
      const sweepEthUserOpHash = await recipientKernelClient.sendUserOperation({
        callData: await recipientKernelClient.account.encodeCalls([
          {
            to: omnibusAddress,
            value: sweepAmount,
            data: "0x",
          },
        ]),
      });

      const { receipt: sweepEthReceipt } = await recipientKernelClient.waitForUserOperationReceipt({
        hash: sweepEthUserOpHash,
      });

      console.log(`ETH sweep completed: ${chain.blockExplorers.default.url}/tx/${sweepEthReceipt.transactionHash}`);
    }

    console.log(`Sweep completed for recipient ${recipientAddress}`);
  } catch (error) {
    console.error(`Failed to sweep funds from ${recipientAddress}:`, error);
  }
}

import { resolve } from "path";
import * as dotenv from "dotenv";
import { z } from "zod";
import { parseArgs } from "node:util";

import {
  SignedAuthorization,
  createWalletClient,
  createPublicClient,
  http,
  encodeFunctionData,
  parseEther,
  type WalletClient,
  type Account,
  type Chain,
  type Transport,
} from "viem";

import { gasStationAbi as combinedAbi } from "../abi/combined_abi";
import { gasStationAbi as separateAbi } from "../abi/gasStationAbi";

import { base, mainnet } from "viem/chains";
import { createAccount } from "@turnkey/viem";
import { Turnkey as TurnkeyServerSDK } from "@turnkey/sdk-server";

export function print(header: string, body: string): void {
  console.log(`${header}\n\t${body}\n`);
}

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

// Parse command line arguments
const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    chain: {
      type: "string",
      short: "c",
      default: "base",
    },
  },
});

// Validate chain argument
const validChains = ["base", "mainnet"] as const;
type ValidChain = (typeof validChains)[number];

if (!validChains.includes(values.chain as ValidChain)) {
  console.error(
    `Invalid chain: ${values.chain}. Valid options: ${validChains.join(", ")}`
  );
  process.exit(1);
}

const selectedChain = values.chain as ValidChain;

// Chain configuration (no token addresses needed for ETH)
const chainConfig = {
  base: {
    chain: base,
    explorerUrl: "https://basescan.org",
  },
  mainnet: {
    chain: mainnet,
    explorerUrl: "https://etherscan.io",
  },
} as const;

const config = chainConfig[selectedChain];

const envSchema = z.object({
  BASE_URL: z.string().url(),
  API_PRIVATE_KEY: z.string().min(1),
  API_PUBLIC_KEY: z.string().min(1),
  ORGANIZATION_ID: z.string().min(1),
  EOA_ADDRESS: z.string().min(1),
  PAYMASTER: z.string().min(1),
  ETH_RPC_URL: z.string().url(),
  BASE_RPC_URL: z.string().url(),

  // Single contract approach (default) - combined delegate + execution contract
  SINGLE_CONTRACT_ADDRESS: z.string().min(1),
  SINGLE_EXECUTION_ADDRESS: z.string().min(1),

  // Two contract approach (optional - only required when USE_TWO_CONTRACTS=true)
  TWO_DELEGATE_CONTRACT: z.string().min(1).optional(),
  TWO_EXECUTION_CONTRACT: z.string().min(1).optional(),

  // Flag to switch between single contract (default) and two contract approaches
  USE_TWO_CONTRACTS: z
    .string()
    .optional()
    .transform((val) => val === "true"),

  SKIP_AUTHORIZATION: z
    .string()
    .optional()
    .transform((val) => val === "true"),
});

const env = envSchema.parse(process.env);

// Validate required environment variables based on the mode
if (env.USE_TWO_CONTRACTS) {
  if (!env.TWO_DELEGATE_CONTRACT || !env.TWO_EXECUTION_CONTRACT) {
    console.error(
      "When USE_TWO_CONTRACTS=true, both TWO_DELEGATE_CONTRACT and GAS_STATION_SEPERATE must be provided"
    );
    process.exit(1);
  }
}

print(
  `🌐 Using ${selectedChain.toUpperCase()} network`,
  `ETH transfers on ${config.chain.name}`
);

// Get appropriate configuration based on the contract approach flag
function getContractConfig() {
  if (env.USE_TWO_CONTRACTS) {
    return {
      abi: separateAbi,
      delegateAddress: env.TWO_DELEGATE_CONTRACT as `0x${string}`,
      gasStationAddress: env.TWO_EXECUTION_CONTRACT as `0x${string}`,
      nonceType: "uint128" as const,
      nonceFunctionName: "getNonce" as const,
      nonceArgs: (eoaAddress: `0x${string}`) => [eoaAddress] as const,
      executeArgs: (
        eoaAddress: `0x${string}`,
        nonce: bigint,
        outputContract: `0x${string}`,
        callData: `0x${string}`,
        signature: `0x${string}`
      ) =>
        [eoaAddress, nonce, outputContract, 0n, callData, signature] as const,
    };
  } else {
    return {
      abi: combinedAbi,
      delegateAddress: env.SINGLE_CONTRACT_ADDRESS as `0x${string}`,
      gasStationAddress: env.SINGLE_EXECUTION_ADDRESS as `0x${string}`,
      nonceType: "uint128" as const,
      nonceFunctionName: "nonce" as const,
      nonceArgs: (eoaAddress: `0x${string}`) => [eoaAddress] as const,
      executeArgs: (
        eoaAddress: `0x${string}`,
        nonce: bigint,
        outputContract: `0x${string}`,
        callData: `0x${string}`,
        signature: `0x${string}`
      ) => [nonce, outputContract, 0n, callData, signature] as const, // Combined ABI includes ethAmount parameter
    };
  }
}

print(
  `🔧 Using ${env.USE_TWO_CONTRACTS ? "two-contract" : "single-contract"} contract approach`,
  env.USE_TWO_CONTRACTS
    ? `Delegate: ${env.TWO_DELEGATE_CONTRACT}, Gas Station: ${env.TWO_EXECUTION_CONTRACT}`
    : `Combined Contract: ${env.SINGLE_CONTRACT_ADDRESS} (Execution: ${env.SINGLE_EXECUTION_ADDRESS})`
);

const turnkeyClient = new TurnkeyServerSDK({
  apiBaseUrl: env.BASE_URL,
  apiPrivateKey: env.API_PRIVATE_KEY,
  apiPublicKey: env.API_PUBLIC_KEY,
  defaultOrganizationId: env.ORGANIZATION_ID,
});

/**
 * Authorizes an EOA to use a gas station contract via EIP-7702
 *
 * @param eoaWalletClient - Wallet client for the EOA that will be authorized
 * @param paymasterWalletClient - Wallet client for the paymaster that sponsors the transaction
 * @returns Promise resolving to the transaction receipt
 */
async function authorize7702ForEOA({
  eoaWalletClient,
  paymasterWalletClient,
}: {
  eoaWalletClient: WalletClient<Transport, Chain, Account>;
  paymasterWalletClient: WalletClient<Transport, Chain, Account>;
}) {
  // Create public client for monitoring transactions
  const publicClient = createPublicClient({
    chain: config.chain,
    transport: http(
      selectedChain === "base" ? env.BASE_RPC_URL : env.ETH_RPC_URL
    ),
  });
  // Get contract configuration based on the flag
  const contractConfig = getContractConfig();

  // Sign the EIP-7702 authorization to delegate the appropriate contract to the EOA
  const authorization = await eoaWalletClient.signAuthorization({
    contractAddress: contractConfig.delegateAddress,
    account: eoaWalletClient.account,
    chainId: 0, // 0 means valid on any EIP-7702 compatible chain
    // No executor specified - means the paymaster will execute the transaction
  });

  // Paymaster broadcasts the EIP-7702 authorization transaction
  const authTxHash = await paymasterWalletClient.sendTransaction({
    from: "0x0000000000000000000000000000000000000000", // Zero address for authorization
    gas: BigInt(200000),
    authorizationList: [authorization as SignedAuthorization],
    to: "0x0000000000000000000000000000000000000000", // Zero address for authorization
    type: "eip7702",
    account: paymasterWalletClient.account,
  });

  print(
    "EIP-7702 Authorization Transaction sent by paymaster",
    `${config.explorerUrl}/tx/${authTxHash}`
  );

  print("Waiting for authorization confirmation...", "");

  // Wait for authorization transaction confirmation
  const authReceipt = await publicClient.waitForTransactionReceipt({
    hash: authTxHash,
  });

  // Check if authorization succeeded or failed
  if (authReceipt.status === "success") {
    print("✅ EIP-7702 Authorization SUCCEEDED", "");
    print(
      "Authorization confirmed",
      `Block: ${authReceipt.blockNumber}, Gas used: ${authReceipt.gasUsed}`
    );
  } else {
    print("❌ EIP-7702 Authorization FAILED", "");
    print(
      "Authorization reverted",
      `Block: ${authReceipt.blockNumber}, Gas used: ${authReceipt.gasUsed}`
    );
    throw new Error("Authorization failed - cannot proceed with ETH transfer");
  }

  return authReceipt;
}

/**
 * Creates an EIP-712 signed intent for the EOA to authorize an ETH transfer
 * that will be executed by the paymaster through the delegated contract
 *
 * @param eoaWalletClient - Wallet client for the EOA that will sign the intent
 * @param paymasterWalletClient - Wallet client for the paymaster that will execute
 * @param transferAmount - Amount of ETH to transfer (in wei)
 * @returns Promise resolving to the transaction receipt
 */
async function executeETHTransferWithIntent({
  eoaWalletClient,
  paymasterWalletClient,
  transferAmount = parseEther("0.001"), // 0.001 ETH
}: {
  eoaWalletClient: WalletClient<Transport, Chain, Account>;
  paymasterWalletClient: WalletClient<Transport, Chain, Account>;
  transferAmount?: bigint;
}) {
  const publicClient = createPublicClient({
    chain: config.chain,
    transport: http(
      selectedChain === "base" ? env.BASE_RPC_URL : env.ETH_RPC_URL
    ),
  });

  print("Creating EIP-712 intent for ETH transfer...", "");

  // Get contract configuration based on the flag
  const contractConfig = getContractConfig();

  // Step 1: Get current nonce using the appropriate contract and method
  
  /// Nonce reading when directly from the EoA
  /*
  let readArgs = {
    address: env.EOA_ADDRESS as `0x${string}`,//contractConfig.gasStationAddress,
    abi: contractConfig.abi,
    functionName: contractConfig.nonceFunctionName,
    args: []//contractConfig.nonceArgs(eoaWalletClient.account.address),
  }
  const currentNonce = await publicClient.readContract(readArgs);
  */

  let readArgs = {
    address: contractConfig.gasStationAddress,
    abi: contractConfig.abi,
    functionName: contractConfig.nonceFunctionName,
    args: contractConfig.nonceArgs(eoaWalletClient.account.address),
  }
  const currentNonce = await publicClient.readContract(readArgs);

  print(`Current nonce from gas station contract: ${currentNonce}`, "");

  // Step 2: Create the ETH transfer call data (empty for direct ETH transfer)
  const transferCallData = "0x"; // Empty call data for ETH transfer

  print(`ETH transfer amount: ${transferAmount} wei`, "");
  print(
    `Transfer details: ${transferAmount.toString()} wei (${parseFloat(transferAmount.toString()) / 1e18} ETH) from EOA to ${paymasterWalletClient.account.address}`,
    ""
  );

  // Step 3: EOA signs EIP-712 message for the gas station contract execution
  const domain = {
    name: "TKGasDelegate",
    version: "1",
    chainId: config.chain.id,
    verifyingContract: env.EOA_ADDRESS as `0x${string}`,//eoaWalletClient.account.address,
  };

  const types = {
    Execution: [
      { name: "nonce", type: contractConfig.nonceType },
      { name: "outputContract", type: "address" },
      { name: "ethAmount", type: "uint256" },
      { name: "arguments", type: "bytes" },
    ],
  };

  const message = {
    nonce: currentNonce,
    outputContract: paymasterWalletClient.account.address, // Gas station will send ETH to paymaster
    ethAmount: transferAmount, // Amount of ETH to transfer
    arguments: transferCallData, // Empty call data for ETH transfer
  };
  console.log({ message });

  print(
    "EOA signing EIP-712 message to authorize gas station execution...",
    ""
  );
  console.log({ domain });
  console.log(eoaWalletClient.account);

  // Step 4: EOA signs the execution intent
  const signature = await eoaWalletClient.signTypedData({
    account: eoaWalletClient.account,
    domain,
    types,
    primaryType: "Execution",
    message,
  });

  print(`EIP-712 signature from EOA: ${signature}`, "");

  // Step 5: Paymaster calls the actual gas station contract's execute function
  print(
    "Paymaster calling gas station contract to execute ETH transfer...",
    ""
  );

  let args = contractConfig.executeArgs(
    eoaWalletClient.account.address,
    currentNonce,
    paymasterWalletClient.account.address as `0x${string}`,
    transferCallData,
    signature
  )

  console.log({ args });
  const txHash = await paymasterWalletClient.sendTransaction({
    to: contractConfig.gasStationAddress, // Call the appropriate gas station contract // env.EOA_ADDRESS as `0x${string}`,
    data: encodeFunctionData({
      abi: contractConfig.abi,
      functionName: "execute",
      args: args,
    }),
    gas: BigInt(200000),
    account: paymasterWalletClient.account,
  });

  print(
    "Gas station execution transaction sent by paymaster",
    `${config.explorerUrl}/tx/${txHash}`
  );

  print("Waiting for transaction confirmation...", "");

  // Wait for transaction confirmation
  const receipt = await publicClient.waitForTransactionReceipt({
    hash: txHash,
  });

  // Check if transaction succeeded or failed
  if (receipt.status === "success") {
    print("✅ ETH transfer execution SUCCEEDED", "");
    print(
      "Transaction confirmed",
      `Block: ${receipt.blockNumber}, Gas used: ${receipt.gasUsed}`
    );
    print(
      "Transfer details",
      `${transferAmount.toString()} wei (${parseFloat(transferAmount.toString()) / 1e18} ETH) from EOA to ${paymasterWalletClient.account.address}`
    );
  } else {
    print("❌ ETH transfer execution FAILED", "");
    print(
      "Transaction reverted",
      `Block: ${receipt.blockNumber}, Gas used: ${receipt.gasUsed}`
    );
  }

  return receipt;
}

/**
 * EIP-7702 Authorization Transaction Example for ETH Transfers
 *
 * This example demonstrates how to:
 * 1. Sign an EIP-7702 authorization that delegates a gas station contract to an EOA
 * 2. Prepare and send the authorization transaction using raw transaction signing
 * 3. Execute an ETH transfer through the delegated gas station contract
 *
 * The authorization allows the EOA to use the gas station contract's functionality
 * for gasless transactions or sponsored transactions.
 *
 * Contract Approach Configuration:
 * - Single Contract (default): Uses one combined contract for both delegation and execution
 * - Two Contract: Uses separate contracts for delegation (TWO_DELEGATE_CONTRACT) and execution (GAS_STATION_SEPERATE)
 *
 * Set USE_TWO_CONTRACTS=true to switch to the two contract approach.
 */
const main = async () => {
  const eoaAccount = await createAccount({
    client: turnkeyClient.apiClient(),
    organizationId: env.ORGANIZATION_ID,
    signWith: env.EOA_ADDRESS,
  });
  const paymasterAccount = await createAccount({
    client: turnkeyClient.apiClient(),
    organizationId: env.ORGANIZATION_ID,
    signWith: env.PAYMASTER,
  });
  const eoaWalletClient = createWalletClient({
    account: eoaAccount,
    chain: config.chain,
    transport: http(
      selectedChain === "base" ? env.BASE_RPC_URL : env.ETH_RPC_URL
    ),
  });
  const paymasterWalletClient = createWalletClient({
    account: paymasterAccount,
    chain: config.chain,
    transport: http(
      selectedChain === "base" ? env.BASE_RPC_URL : env.ETH_RPC_URL
    ),
  });

  // Step 1: Authorize the EOA to use the gas station contract via EIP-7702 (optional)
  if (!env.SKIP_AUTHORIZATION) {
    print("===== Starting EIP-7702 Authorization =====", "");
    const authReceipt = await authorize7702ForEOA({
      eoaWalletClient,
      paymasterWalletClient,
    });

    print(
      "EOA is now authorized to use the gas station contract for transactions",
      `Block: ${authReceipt.blockNumber}, Gas used: ${authReceipt.gasUsed}`
    );
  } else {
    print(
      "===== Skipping EIP-7702 Authorization (SKIP_AUTHORIZATION=true) =====",
      ""
    );
    print(
      "Assuming EOA is already authorized to use the gas station contract",
      ""
    );
  }

  print("===== Starting ETH Transfer =====", "");

  // Step 2: Execute an ETH transfer using the delegated contract functionality
  const transferReceipt = await executeETHTransferWithIntent({
    eoaWalletClient,
    paymasterWalletClient,
  });

  print("===== EIP-7702 Flow Complete =====", "");

  // Only print success message if transaction actually succeeded
  if (transferReceipt.status === "success") {
    print(
      "✅ Successfully transferred 0.001 ETH from EOA to paymaster via delegated contract",
      `Transfer TX: ${config.explorerUrl}/tx/${transferReceipt.transactionHash}`
    );
    print(
      "Final transaction gas usage",
      `Gas used: ${transferReceipt.gasUsed}`
    );
  } else {
    print(
      "❌ EIP-7702 flow completed but ETH transfer FAILED",
      `Failed TX: ${config.explorerUrl}/tx/${transferReceipt.transactionHash}`
    );
    print(
      "Gas wasted on failed transaction",
      `Gas used: ${transferReceipt.gasUsed}`
    );
  }
};

main();

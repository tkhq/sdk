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
  parseUnits,
  type WalletClient,
  type Account,
  type Chain,
  type Transport,
} from "viem";

import { gasStationAbi } from "./abi";

import { base, mainnet } from "viem/chains";
import { createAccount } from "@turnkey/viem";
import { Turnkey as TurnkeyServerSDK } from "@turnkey/sdk-server";
import { print } from "../util";

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

// Chain and USDC address configuration
const chainConfig = {
  base: {
    chain: base,
    usdcAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    explorerUrl: "https://basescan.org",
  },
  mainnet: {
    chain: mainnet,
    usdcAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
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
  GAS_STATION_CA: z.string().min(1),
  PAYMASTER: z.string().min(1),
  ETH_RPC_URL: z.string().url(),
  BASE_RPC_URL: z.string().url(),
  // same as EOA address while Gassy and TK GasStation are combined
  EXECUTION_ADDRESS: z.string().min(1),
  SKIP_AUTHORIZATION: z
    .string()
    .optional()
    .transform((val) => val === "true"),
});

const env = envSchema.parse(process.env);

print(
  `🌐 Using ${selectedChain.toUpperCase()} network`,
  `USDC: ${config.usdcAddress}`
);
const ERC20_ABI = [
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "success", type: "bool" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "balance", type: "uint256" }],
  },
] as const;

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
  // Sign the EIP-7702 authorization to delegate the gas station contract to the EOA
  const authorization = await eoaWalletClient.signAuthorization({
    contractAddress: env.GAS_STATION_CA as `0x${string}`,
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
    throw new Error("Authorization failed - cannot proceed with USDC transfer");
  }

  return authReceipt;
}

/**
 * Creates an EIP-712 signed intent for the EOA to authorize a USDC transfer
 * that will be executed by the paymaster through the delegated contract
 *
 * @param eoaWalletClient - Wallet client for the EOA that will sign the intent
 * @param paymasterWalletClient - Wallet client for the paymaster that will execute
 * @param transferAmount - Amount of USDC to transfer (in wei, 6 decimals for USDC)
 * @returns Promise resolving to the transaction receipt
 */
async function executeUSDCTransferWithIntent({
  eoaWalletClient,
  paymasterWalletClient,
  transferAmount = parseUnits("0.01", 6), // 1 penny in USDC (6 decimals)
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

  print("Creating EIP-712 intent for USDC transfer...", "");

  const executionAddress = env.EXECUTION_ADDRESS as `0x${string}`;
  // Step 1: Get current nonce using the EOA's context
  const currentNonce = await publicClient.readContract({
    address: executionAddress,
    abi: gasStationAbi,
    functionName: "nonce",
  });

  print(`Current nonce from gas station contract: ${currentNonce}`, "");

  // Step 2: Create the USDC transfer call data (what the gas station will call)
  const transferCallData = encodeFunctionData({
    abi: ERC20_ABI,
    functionName: "transfer",
    args: [paymasterWalletClient.account.address, transferAmount], // Transfer TO paymaster
  });

  print(`USDC transfer call data: ${transferCallData}`, "");
  print(
    `Transfer details: ${transferAmount.toString()} USDC (1 penny) from EOA to ${paymasterWalletClient.account.address}`,
    ""
  );

  // Step 3: EOA signs EIP-712 message for the gas station contract execution
  const domain = {
    name: "TKGasStation",
    version: "1",
    chainId: config.chain.id,
    verifyingContract: executionAddress, // EOA address (now delegated to gas station)
  };

  const types = {
    Execution: [
      { name: "nonce", type: "uint128" },
      { name: "outputContract", type: "address" },
      { name: "ethAmount", type: "uint256" },
      { name: "arguments", type: "bytes" },
    ],
  };

  const message = {
    nonce: currentNonce,
    outputContract: config.usdcAddress, // Gas station will call USDC contract
    ethAmount: 0n, // No ETH being sent
    arguments: transferCallData, // The USDC transfer function call
  };
  console.log({ message });

  print(
    "EOA signing EIP-712 message to authorize gas station execution...",
    ""
  );

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
    "Paymaster calling gas station contract to execute USDC transfer...",
    ""
  );

  const txHash = await paymasterWalletClient.sendTransaction({
    to: executionAddress, // Call the gas station contract with EOA context
    data: encodeFunctionData({
      abi: gasStationAbi,
      functionName: "execute",
      args: [currentNonce, config.usdcAddress, transferCallData, signature],
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
    print("✅ USDC transfer execution SUCCEEDED", "");
    print(
      "Transaction confirmed",
      `Block: ${receipt.blockNumber}, Gas used: ${receipt.gasUsed}`
    );
    print(
      "Transfer details",
      `${transferAmount.toString()} USDC units (1 penny) from EOA to ${paymasterWalletClient.account.address}`
    );
  } else {
    print("❌ USDC transfer execution FAILED", "");
    print(
      "Transaction reverted",
      `Block: ${receipt.blockNumber}, Gas used: ${receipt.gasUsed}`
    );
  }

  return receipt;
}

/**
 * EIP-7702 Authorization Transaction Example
 *
 * This example demonstrates how to:
 * 1. Sign an EIP-7702 authorization that delegates a gas station contract to an EOA
 * 2. Prepare and send the authorization transaction using raw transaction signing
 *
 * The authorization allows the EOA to use the gas station contract's functionality
 * for gasless transactions or sponsored transactions.
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

  print("===== Starting USDC Transfer =====", "");

  // Step 2: Execute a USDC transfer using the delegated contract functionality
  const transferReceipt = await executeUSDCTransferWithIntent({
    eoaWalletClient,
    paymasterWalletClient,
  });

  print("===== EIP-7702 Flow Complete =====", "");

  // Only print success message if transaction actually succeeded
  if (transferReceipt.status === "success") {
    print(
      "✅ Successfully transferred 1 penny USDC from EOA to paymaster via delegated contract",
      `Transfer TX: ${config.explorerUrl}/tx/${transferReceipt.transactionHash}`
    );
    print(
      "Final transaction gas usage",
      `Gas used: ${transferReceipt.gasUsed}`
    );
  } else {
    print(
      "❌ EIP-7702 flow completed but USDC transfer FAILED",
      `Failed TX: ${config.explorerUrl}/tx/${transferReceipt.transactionHash}`
    );
    print(
      "Gas wasted on failed transaction",
      `Gas used: ${transferReceipt.gasUsed}`
    );
  }
};

main();

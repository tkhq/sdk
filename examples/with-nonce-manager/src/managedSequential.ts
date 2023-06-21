import * as path from "path";
import * as dotenv from "dotenv";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { TurnkeySigner } from "@turnkey/ethers";
import { ethers } from "ethers";
import { createNewEthereumPrivateKey } from "./createNewEthereumPrivateKey";

// These defaults should be suitable for most testnets.
// For Polygon Mainnet, consider using at least 40 gwei for both parameters for consistent performance.
const DEFAULT_MAX_FEE_PER_GAS = 1000000000; // 1 gwei
const DEFAULT_MAX_PRIORITY_FEE_PER_GAS = 1000000000; // 1 gwei
const DEFAULT_GAS_MULTIPLIER = 1.5;
const DEFAULT_TX_WAIT_TIME_MS = 5000;

async function main() {
  if (!process.env.PRIVATE_KEY_ID) {
    // If you don't specify a `PRIVATE_KEY_ID`, we'll create one for you via calling the Turnkey API.
    await createNewEthereumPrivateKey();
    return;
  }

  // Initialize a Turnkey Signer
  const turnkeySigner = new TurnkeySigner({
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    baseUrl: process.env.BASE_URL!,
    organizationId: process.env.ORGANIZATION_ID!,
    privateKeyId: process.env.PRIVATE_KEY_ID!,
  });

  // Bring your own provider (such as Alchemy or Infura: https://docs.ethers.org/v5/api/providers/)
  const network = "goerli";
  const provider = new ethers.providers.InfuraProvider(network);
  const connectedSigner = turnkeySigner.connect(provider);

  const chainId = await connectedSigner.getChainId();
  const address = await connectedSigner.getAddress();
  const balance = await connectedSigner.getBalance();
  const transactionCount = await connectedSigner.getTransactionCount();

  print("Network:", `${network} (chain ID ${chainId})`);
  print("Address:", address);
  print("Balance:", `${ethers.utils.formatEther(balance)} Ether`);
  print("Transaction count:", `${transactionCount}`);

  if (balance.isZero()) {
    let warningMessage =
      "The transaction won't be broadcasted because your account balance is zero.\n";
    if (network === "goerli") {
      warningMessage +=
        "Use https://goerlifaucet.com/ to request funds on Goerli, then run the script again.\n";
    }

    console.warn(warningMessage);
    return;
  }

  // Create a queue of simple send transactions
  let txQueue = [];

  for (let i = 0; i < 3; i++) {
    const transactionAmount = "0";
    const destinationAddress = "0x2Ad9eA1E677949a536A270CEC812D6e868C88108";
    const transactionRequest = {
      to: destinationAddress,
      value: ethers.utils.parseEther(transactionAmount),
      type: 2,
      nonce: transactionCount + i, // manually specify the nonce
    };

    txQueue.push(transactionRequest);
  }

  let needsRetry = false;
  let index = 0;

  // Process the queue of transactions. If the transaction is not mined in a block within the allotted time,
  // reattempt it with increased gas fee parameters.
  while (index < txQueue.length - 1) {
    let currentTransaction: ethers.providers.TransactionRequest =
      txQueue[index]!;

    if (needsRetry) {
      currentTransaction = await getUpdatedTransaction(
        provider,
        currentTransaction
      );
    }

    const sendTx = await connectedSigner.sendTransaction(currentTransaction!);

    print(
      `Sent ${ethers.utils.formatEther(sendTx.value)} Ether to ${sendTx.to}:`,
      `https://${network}.etherscan.io/tx/${sendTx.hash}`
    );

    // Wait for tx to be confirmed. If working with lower latencies/faster chains,
    // consider tweaking this value and/or using exponential backoff.
    await sleep(DEFAULT_TX_WAIT_TIME_MS);

    const tx = await provider.getTransaction(sendTx.hash);

    if (tx?.blockNumber) {
      index++;
      needsRetry = false;
      continue;
    }

    txQueue[index] = currentTransaction!;
    needsRetry = true;
  }
}

function sleep(milliseconds: number) {
  const date = Date.now();
  let currentDate = null;
  do {
    currentDate = Date.now();
  } while (currentDate - date < milliseconds);
}

// Helper to re-estimate gas fees with a multiplier applied
async function getUpdatedTransaction(
  provider: ethers.providers.Provider,
  transaction: ethers.providers.TransactionRequest
) {
  const feeData = await provider.getFeeData();

  const maxFee = maxBigNumber([
    feeData.maxFeePerGas!,
    transaction.maxFeePerGas,
    DEFAULT_MAX_FEE_PER_GAS,
  ]);
  const maxPriorityFee = maxBigNumber([
    feeData.maxPriorityFeePerGas!,
    transaction.maxPriorityFeePerGas,
    DEFAULT_MAX_PRIORITY_FEE_PER_GAS,
  ]);

  const mulMaxFee = (
    parseFloat(maxFee.toString()) *
    parseFloat(DEFAULT_GAS_MULTIPLIER.toString())
  ).toFixed(0);
  const mulMaxPriorityFee = (
    parseFloat(maxPriorityFee.toString()) *
    parseFloat(DEFAULT_GAS_MULTIPLIER.toString())
  ).toFixed(0);

  return {
    ...transaction,
    maxFeePerGas: mulMaxFee,
    maxPriorityFeePerGas: mulMaxPriorityFee,
  };
}

// Helper to get the maximum BigNumber in a given array
function maxBigNumber(
  arr: (ethers.BigNumberish | undefined)[]
): ethers.BigNumber {
  let max = ethers.BigNumber.from(0);

  for (let i = 0; i < arr.length; i++) {
    const value = ethers.BigNumber.from(arr[i] || 0);
    if (value.gt(max)) {
      max = value;
    }
  }

  return max;
}

function print(header: string, body: string): void {
  console.log(`${header}\n\t${body}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

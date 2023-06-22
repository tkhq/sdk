import * as path from "path";
import * as dotenv from "dotenv";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { TurnkeySigner } from "@turnkey/ethers";
import { ethers } from "ethers";
import { createNewEthereumPrivateKey } from "./createNewEthereumPrivateKey";
import { print, sleep, getUpdatedTransaction } from "./util";

const DEFAULT_TX_WAIT_TIME_MS = 5000;
const DEFAULT_TOTAL_WAIT_TIME_MS = 60000;

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
  const txQueue = [];

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

  const startTime = Date.now();
  let needsRetry = false;
  let index = 0;

  // Process the queue of transactions. If the transaction is not mined in a block within the allotted time,
  // reattempt it with increased gas fee parameters.
  while (index < txQueue.length - 1) {
    if (Date.now() - startTime > DEFAULT_TOTAL_WAIT_TIME_MS) {
      console.log(
        "Exceeded total time allotted for transaction processing. Exiting..."
      );

      process.exit(1);
    }

    let currentTransaction: ethers.providers.TransactionRequest;

    try {
      currentTransaction = txQueue[index]!;

      if (needsRetry) {
        currentTransaction = await getUpdatedTransaction(
          provider,
          currentTransaction
        );

        console.log(
          `Updated gas fee params for transaction with nonce: ${currentTransaction.nonce}\n`
        );
      }

      const sendTx = await connectedSigner.sendTransaction(currentTransaction!);

      print(
        `Sent ${ethers.utils.formatEther(sendTx.value)} Ether to ${
          sendTx.to
        } with nonce ${currentTransaction.nonce}:`,
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
    } catch (err) {
      // Catch errors related to potential race conditions, e.g. if we attempt to retry a transaction right as it landed onchain.
      // Continue processing otherwise, at least until the `DEFAULT_TOTAL_WAIT_TIME_MS` threshold is breached.
      console.log("Encountered error:", err);
    }

    txQueue[index] = currentTransaction!;
    needsRetry = true;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

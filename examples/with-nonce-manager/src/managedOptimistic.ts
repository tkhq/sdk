import * as path from "path";
import * as dotenv from "dotenv";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { TurnkeySigner } from "@turnkey/ethers";
import { ethers } from "ethers";
import { createNewEthereumPrivateKey } from "./createNewEthereumPrivateKey";
import { print, sleep, getUpdatedTransaction } from "./util";

const DEFAULT_REFRESH_TIME_MS = 5000;
const DEFAULT_TX_WAIT_TIME_MS = 15000;
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

  // Create a queue of simple send transactions, and also keep track of these transactions via a map.
  // This effectively serves as our state for this example. Then, optimistically broadcast the transactions.
  const txQueue = [];
  const txMap = new Map<number, ethers.providers.TransactionRequest>();
  const numTxs = 3;

  for (let i = 0; i < numTxs; i++) {
    const transactionAmount = "0";
    const destinationAddress = "0x2Ad9eA1E677949a536A270CEC812D6e868C88108";
    const nonce = transactionCount + i;
    const transactionRequest = {
      to: destinationAddress,
      value: ethers.utils.parseEther(transactionAmount),
      type: 2,
      nonce: nonce, // manually specify the nonce
    };

    txQueue.push(transactionRequest);
    txMap.set(nonce, transactionRequest);

    const sendTx = await connectedSigner.sendTransaction(transactionRequest);

    print(
      `Sent ${ethers.utils.formatEther(sendTx.value)} Ether to ${
        sendTx.to
      } with nonce ${nonce}:`,
      `https://${network}.etherscan.io/tx/${sendTx.hash}`
    );
  }

  const startTime = Date.now();
  const finalExpectedNonce = transactionCount + numTxs;
  let nonce = transactionCount;

  // Repeatedly poll the status of these transactions. If we seem to be stuck on a given transaction,
  // bump its gas fee params and try again.
  while (nonce < finalExpectedNonce) {
    if (Date.now() - startTime > DEFAULT_TOTAL_WAIT_TIME_MS) {
      console.log(
        "Exceeded total time allotted for transaction processing. Exiting..."
      );

      process.exit(1);
    }

    try {
      await sleep(DEFAULT_REFRESH_TIME_MS);

      // If tx processing seems to be stuck, try resubmitting the most recent one with increased gas fee params
      if (Date.now() - startTime > DEFAULT_TX_WAIT_TIME_MS) {
        const updatedTx = await getUpdatedTransaction(
          provider,
          txMap.get(nonce)!
        );

        const sendTx = await connectedSigner.sendTransaction(updatedTx!);
        txMap.set(nonce, updatedTx);

        print(
          `Updated transaction with nonce ${nonce} sent ${ethers.utils.formatEther(
            sendTx.value
          )} Ether to ${sendTx.to}:`,
          `https://${network}.etherscan.io/tx/${sendTx.hash}`
        );
      }
    } catch (err) {
      // Catch errors related to potential race conditions, e.g. if we attempt to retry a transaction right as it landed onchain.
      // Continue processing otherwise, at least until the `DEFAULT_TOTAL_WAIT_TIME_MS` threshold is breached.
      console.log("Encountered error:", err);
    }

    // Fetch latest nonce
    nonce = await connectedSigner.getTransactionCount();
  }

  console.log("All transactions processed!");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

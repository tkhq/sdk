import { ethers } from "ethers";
import { toReadableAmount } from "./utils";

export async function sendEth(
  provider: ethers.providers.Provider,
  connectedSigner: ethers.Signer,
  destinationAddress: string,
  value: number
) {
  // TODO(tim): investigate why we can't call `connectedSigner.getNetwork()`
  const network = await provider.getNetwork();
  const chainId = await connectedSigner.getChainId();
  const balance = await connectedSigner.getBalance();
  const address = await connectedSigner.getAddress();

  print("Network:", `${network.name} (chain ID ${chainId})`);
  print("Address:", address);
  print("Balance:", `${ethers.utils.formatEther(balance)} Ether`);

  if (balance.isZero()) {
    let warningMessage =
      "The transaction won't be broadcasted because your account balance is zero.\n";
    if (network.name === "goerli") {
      warningMessage +=
        "Use https://goerlifaucet.com/ to request funds on Goerli, then run the script again.\n";
    }

    throw new Error(warningMessage);
  }

  const feeData = await connectedSigner.getFeeData();
  const gasRequired = feeData.maxFeePerGas!.mul(21000);
  const totalCost = gasRequired.add(value);

  if (balance.lt(totalCost)) {
    throw new Error(`Insufficient ETH balance. Needs ${totalCost}`);
  }

  const transactionRequest = {
    to: destinationAddress,
    value,
    type: 2,
    maxFeePerGas: feeData.maxFeePerGas!,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas!,
  };

  let sentTx;
  try {
    sentTx = await connectedSigner.sendTransaction(transactionRequest);
  } catch (err: any) {
    // HACK: allow these activites to require consensus
    if (err.toString().includes("ACTIVITY_STATUS_CONSENSUS_NEEDED")) {
      console.log("Consensus is required. Please visit the dashboard.");
      return;
    }

    throw err;
  }
  
  console.log("Awaiting confirmation...");

  await connectedSigner.provider?.waitForTransaction(sentTx.hash, 1);

  print(
    `Sent ${toReadableAmount(
      value.toString(),
      18,
      12
    )} ETH to ${destinationAddress}:`,
    `https://${network.name}.etherscan.io/tx/${sentTx.hash}`
  );
}

function print(header: string, body: string): void {
  console.log(`${header}\n\t${body}\n`);
}

import { ethers } from "ethers";
import { toReadableAmount } from "./utils";

export async function sendEth(
  provider: ethers.providers.Provider,
  connectedSigner: ethers.Signer,
  destinationAddress: string,
  value: ethers.BigNumber,
  precalculatedFeeData: ethers.providers.FeeData | undefined = undefined
) {
  // TODO(tim): investigate why we can't call `connectedSigner.getNetwork()`
  const network = await provider.getNetwork();
  const balance = await connectedSigner.getBalance();
  const address = await connectedSigner.getAddress();

  print("Address:", address);
  print("Balance:", `${ethers.utils.formatEther(balance)} Ether`);

  if (balance.isZero()) {
    let warningMessage =
      "The transaction won't be broadcasted because your account balance is zero.\n";
    if (network.name === "sepolia") {
      warningMessage +=
        "Use https://sepoliafaucet.com/ to request funds on Sepolia, then run the script again.\n";
    }

    throw new Error(warningMessage);
  }

  const feeData = precalculatedFeeData || (await connectedSigner.getFeeData());
  const gasRequired = feeData
    .maxFeePerGas!.add(feeData.maxPriorityFeePerGas!)
    .mul(21000);
  const totalCost = gasRequired.add(value);

  console.log(`Transaction details:`, {
    totalCost: totalCost.toString(),
    value: value,
    balance: balance.toString(),
    gasRequired: gasRequired.toString(),
  });

  if (balance.lt(totalCost)) {
    console.error(`Insufficient ETH balance of ${balance}. Needs ${totalCost}`);
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

    console.log(`Awaiting confirmation for tx hash ${sentTx.hash}...\n`);

    await connectedSigner.provider?.waitForTransaction(sentTx.hash, 1);

    print(
      `Sent ${toReadableAmount(
        value.toString(),
        18,
        12
      )} ETH to ${destinationAddress}:`,
      `https://${network.name}.etherscan.io/tx/${sentTx.hash}`
    );
  } catch (error: any) {
    // HACK: allow these activites to require consensus
    if (error.toString().includes("ACTIVITY_STATUS_CONSENSUS_NEEDED")) {
      console.error("Consensus is required. Please visit the dashboard.");
      return;
    }

    console.error("Encountered error:", error);
  }
}

function print(header: string, body: string): void {
  console.log(`${header}\n\t${body}\n`);
}

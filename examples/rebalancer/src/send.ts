import { ethers } from "ethers";
import { toReadableAmount, print } from "./utils";

export async function broadcastTx(
  provider: ethers.Provider,
  signedTx: string,
  activityId: string
) {
  const network = await provider.getNetwork();
  const txHash = ethers.keccak256(signedTx);

  console.log(
    [
      `Attempting to broadcast signed transaction:`,
      `- Activity ID: ${activityId}`,
      `- Signed payload: ${signedTx}`,
      `- Hash: ${txHash}`,
      ``,
    ].join("\n")
  );

  const transaction = await provider.getTransaction(txHash);
  const confirmations = await transaction!.confirmations();

  if (confirmations > 0) {
    console.log(`Transaction ${txHash} has already been broadcasted\n`);
    return;
  }

  const { hash } = await provider.broadcastTransaction(signedTx);

  console.log(`Awaiting confirmation for transaction hash ${hash}...\n`);

  await provider.waitForTransaction(hash, 1);

  print(
    `Broadcasted transaction:`,
    `https://${network.name}.etherscan.io/tx/${hash}`
  );
}

export async function sendEth(
  provider: ethers.Provider,
  connectedSigner: ethers.Signer,
  destinationAddress: string,
  value: ethers.BigNumberish,
  precalculatedFeeData: ethers.FeeData | undefined = undefined
) {
  const address = await connectedSigner.getAddress();
  const network = await provider.getNetwork();
  const balance = await provider.getBalance(address);

  print("Address:", address);
  print("Balance:", `${ethers.formatEther(balance)} Ether`);

  if (balance === 0n) {
    let warningMessage =
      "The transaction won't be broadcast because your account balance is zero.\n";
    if (network.name === "sepolia") {
      warningMessage +=
        "Use https://sepoliafaucet.com/ to request funds on Sepolia, then run the script again.\n";
    }

    throw new Error(warningMessage);
  }

  const feeData = precalculatedFeeData || (await provider.getFeeData());
  const gasRequired = (feeData
    .maxFeePerGas! + feeData.maxPriorityFeePerGas!) * 21000n;
  const totalCost = gasRequired + BigInt(value);

  if (balance < totalCost) {
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
    if (error.toString().includes("ACTIVITY_STATUS_CONSENSUS_NEEDED")) {
      console.error(
        `Consensus is required for activity ${
          error.activityId
        } in order to send ${toReadableAmount(
          value.toString(),
          18,
          12
        )} ETH to ${destinationAddress}.`
      );
      return;
    }

    console.error("Encountered error:", error.toString(), "\n");
  }
}

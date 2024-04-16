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

  const confirmations =
    (await (await provider.getTransaction(txHash))?.confirmations()) ?? 0;
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
  connectedSigner: ethers.Signer,
  destinationAddress: string,
  value: bigint,
  precalculatedFeeData: ethers.FeeData | undefined = undefined
) {
  const network = await connectedSigner.provider?.getNetwork();
  const address = await connectedSigner.getAddress();
  const balance = (await connectedSigner.provider?.getBalance(address)) ?? 0n;

  print("Address:", address);
  print("Balance:", `${ethers.formatEther(balance)} Ether`);

  if (balance === 0n) {
    let warningMessage =
      "The transaction won't be broadcast because your account balance is zero.\n";
    if (network?.name === "sepolia") {
      warningMessage +=
        "Use https://sepoliafaucet.com/ to request funds on Sepolia, then run the script again.\n";
    }

    throw new Error(warningMessage);
  }

  const feeData =
    precalculatedFeeData || (await connectedSigner.provider?.getFeeData());
  const gasRequired =
    ((feeData?.maxFeePerGas ?? 0n) + (feeData?.maxPriorityFeePerGas ?? 0n)) *
    21000n;

  const totalCost = gasRequired + value;

  if (balance < totalCost) {
    console.error(`Insufficient ETH balance of ${balance}. Needs ${totalCost}`);
  }

  const transactionRequest = {
    to: destinationAddress,
    value,
    type: 2,
    maxFeePerGas: feeData?.maxFeePerGas || 0n,
    maxPriorityFeePerGas: feeData?.maxPriorityFeePerGas || 0n,
  };

  let sentTx;
  try {
    sentTx = await connectedSigner.sendTransaction(transactionRequest);

    console.log(`Awaiting confirmation for tx hash ${sentTx.hash}...\n`);
    await connectedSigner.provider?.waitForTransaction(sentTx.hash, 1);
    const network = await connectedSigner.provider?.getNetwork();

    print(
      `Sent ${toReadableAmount(
        value.toString(),
        18,
        12
      )} ETH to ${destinationAddress}:`,
      `https://${network?.name}.etherscan.io/tx/${sentTx.hash}`
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

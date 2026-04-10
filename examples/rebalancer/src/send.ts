import { ethers } from "ethers";
import { toReadableAmount, print } from "./utils";
import { getTurnkeyClient } from "./provider";
import { TurnkeyErrorCodes } from "@turnkey/sdk-types";
import { TurnkeyError } from "@turnkey/sdk-types";
import type { TurnkeyApiClient } from "@turnkey/sdk-server";

type Caip2ChainId =
  | "eip155:1"
  | "eip155:11155111"
  | "eip155:8453"
  | "eip155:84532"
  | "eip155:137"
  | "eip155:80002";

export async function broadcastTx(
  provider: ethers.Provider,
  signedTx: string,
  activityId: string,
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
    ].join("\n"),
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
    `https://${network.name}.etherscan.io/tx/${hash}`,
  );
}

export async function sendEth(
  connectedSigner: ethers.Signer,
  fromAddress: string,
  destinationAddress: string,
  value: bigint,
  sponsor: boolean,
  precalculatedFeeData: ethers.FeeData,
  gasEstimate: bigint,
) {
  const network = await connectedSigner.provider?.getNetwork();
  const balance =
    (await connectedSigner.provider?.getBalance(fromAddress)) ?? 0n;
  const maxFeePerGas = precalculatedFeeData.maxFeePerGas?.toString() || "0x";
  const maxPriorityFeePerGas =
    precalculatedFeeData.maxPriorityFeePerGas?.toString() || "0x";
  const gasLimit = gasEstimate.toString();

  print("Address:", fromAddress);
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

  const chainId = network?.chainId.toString();

  const transactionRequest = {
    from: fromAddress,
    to: destinationAddress,
    value: value.toString(),
    type: 2,
    caip2: `eip155:${chainId}` as Caip2ChainId,
    sponsor: sponsor,
    ...(!sponsor && { maxFeePerGas, maxPriorityFeePerGas, gasLimit }),
  };

  try {
    let txHash;
    const turnkeyClient = getTurnkeyClient().apiClient();

    const transactionResponse =
      await turnkeyClient.ethSendTransaction(transactionRequest);

    if (
      transactionResponse.activity.status == "ACTIVITY_STATUS_CONSENSUS_NEEDED"
    ) {
      console.log(
        `Consensus is required for activity ${
          transactionResponse.activity.id
        } in order to send ${toReadableAmount(
          value.toString(),
          18,
          12,
        )} ETH to ${destinationAddress}.`,
      );
      return;
    }
    txHash = await pollTransactionStatus(
      turnkeyClient,
      transactionResponse.sendTransactionStatusId,
    );

    print(
      `Sent ${toReadableAmount(
        value.toString(),
        18,
        12,
      )} ETH to ${destinationAddress}:`,
      `https://${network?.name}.etherscan.io/tx/${txHash}`,
    );
  } catch (error: any) {
    if (error.toString().includes("TurnkeyActivityConsensusNeededError")) {
      console.error(
        `Consensus is required for activity ${
          error.activityId
        } in order to send ${toReadableAmount(
          value.toString(),
          18,
          12,
        )} ETH to ${destinationAddress}.`,
      );
      return;
    }

    console.error("Encountered error:", error.toString(), "\n");
  }
}

export async function pollTransactionStatus(
  client: TurnkeyApiClient,
  sendTransactionStatusId: any,
) {
  let txHash;

  try {
    const pollResult = await client.pollTransactionStatus({
      organizationId: process.env.ORGANIZATION_ID!,
      sendTransactionStatusId,
      pollingIntervalMs: 1000,
    });

    if (!pollResult) {
      throw new TurnkeyError(
        "Polling returned no result",
        TurnkeyErrorCodes.SIGN_AND_SEND_TRANSACTION_ERROR,
      );
    }

    txHash = pollResult.eth?.txHash; // Ethereum

    if (!txHash) {
      throw new TurnkeyError(
        "Missing transaction id in transaction result",
        TurnkeyErrorCodes.SIGN_AND_SEND_TRANSACTION_ERROR,
      );
    }
    console.log(txHash);
  } catch (error) {
    console.log("Error polling for status.");
    console.error(error);
  }

  return txHash;
}

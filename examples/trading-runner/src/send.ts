import { ethers } from "ethers";
import type { Token } from "@uniswap/sdk-core";

import { toReadableAmount, print } from "./utils";
import {
  NATIVE_TRANSFER_GAS_LIMIT,
  ERC20_TRANSFER_GAS_LIMIT,
} from "./uniswap/constants";

export async function broadcastTx(
  provider: ethers.providers.Provider,
  signedTx: string,
  activityId: string
) {
  const network = await provider.getNetwork();
  const txHash = ethers.utils.keccak256(signedTx);

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
  if (transaction?.confirmations > 0) {
    console.log(`Transaction ${txHash} has already been broadcasted\n`);
    return;
  }

  const { hash } = await provider.sendTransaction(signedTx);

  console.log(`Awaiting confirmation for transaction hash ${hash}...\n`);

  await provider.waitForTransaction(hash, 1);

  print(
    `Broadcasted transaction:`,
    `https://${network.name}.etherscan.io/tx/${hash}`
  );
}

export async function sendEth(
  provider: ethers.providers.Provider,
  connectedSigner: ethers.Signer,
  destinationAddress: string,
  value: ethers.BigNumber,
  precalculatedFeeData: ethers.providers.FeeData | undefined = undefined
) {
  const network = await provider.getNetwork();
  const balance = await connectedSigner.getBalance();

  if (balance.isZero()) {
    let warningMessage =
      "The transaction won't be broadcast because your account balance is zero.\n";
    if (network.name === "goerli") {
      warningMessage +=
        "Use https://goerlifaucet.com/ to request funds on goerli, then run the script again.\n";
    }

    throw new Error(warningMessage);
  }

  const feeData = precalculatedFeeData || (await connectedSigner.getFeeData());
  const gasRequired = feeData
    .maxFeePerGas!.add(feeData.maxPriorityFeePerGas!)
    .mul(NATIVE_TRANSFER_GAS_LIMIT);
  const totalCost = gasRequired.add(value);

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
    console.log(`Awaiting confirmation for send tx...\n`);

    sentTx = await connectedSigner.sendTransaction(transactionRequest);

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

export async function sendToken(
  provider: ethers.providers.Provider,
  connectedSigner: ethers.Signer,
  destinationAddress: string,
  value: ethers.BigNumber,
  token: Token,
  tokenContract: ethers.Contract,
  precalculatedFeeData: ethers.providers.FeeData | undefined = undefined
) {
  const network = await provider.getNetwork();
  const balance = await connectedSigner.getBalance();
  const address = await connectedSigner.getAddress();

  if (balance.isZero()) {
    let warningMessage =
      "The transaction won't be broadcast because your account balance is zero.\n";
    if (network.name === "goerli") {
      warningMessage +=
        "Use https://goerlifaucet.com/ to request funds on goerli, then run the script again.\n";
    }

    throw new Error(warningMessage);
  }

  const feeData = precalculatedFeeData || (await connectedSigner.getFeeData());
  const gasRequired = feeData
    .maxFeePerGas!.add(feeData.maxPriorityFeePerGas!)
    .mul(ERC20_TRANSFER_GAS_LIMIT);

  if (balance.lt(gasRequired)) {
    throw new Error(
      `Insufficient ETH balance of ${balance}. Needs ${gasRequired} for gas`
    );
  }

  // check token balance
  const tokenBalance = await tokenContract.balanceOf(address);
  if (tokenBalance.lt(value)) {
    throw new Error(
      `Insufficient funds to perform this trade. Have: ${tokenBalance} ${token.symbol}; Need: ${value} ${token.symbol}.`
    );
  }

  if (!tokenContract.populateTransaction.transfer) {
    throw new Error("Invalid contract call. Exiting...\n");
  }

  // populate transaction
  const populatedTx = await tokenContract.populateTransaction.transfer(
    destinationAddress,
    value
  );

  try {
    console.log(`Awaiting confirmation for send tx...\n`);

    const submittedTx = await connectedSigner.sendTransaction(populatedTx);

    await connectedSigner.provider?.waitForTransaction(submittedTx.hash, 1);

    print(
      `Sent ${toReadableAmount(value.toString(), token.decimals, 12)} ${
        token.symbol
      } to ${destinationAddress}:`,
      `https://${network.name}.etherscan.io/tx/${submittedTx.hash}`
    );
  } catch (error: any) {
    if (error.toString().includes("ACTIVITY_STATUS_CONSENSUS_NEEDED")) {
      console.error(
        `Consensus is required for activity ${
          error.activityId
        } in order to send ${toReadableAmount(
          value.toString(),
          token.decimals,
          12
        )} ${token.symbol} to ${destinationAddress}.`
      );
      return;
    }

    console.error("Encountered error:", error.toString(), "\n");
  }
}

export async function wrapEth(
  connectedSigner: ethers.Signer,
  value: ethers.BigNumber,
  tokenContract: ethers.Contract,
  precalculatedFeeData: ethers.providers.FeeData | undefined = undefined
) {
  const provider = connectedSigner.provider!;
  const network = await provider.getNetwork();
  const balance = await connectedSigner.getBalance();

  if (balance.isZero()) {
    let warningMessage =
      "The transaction won't be broadcast because your account balance is zero.\n";
    if (network.name === "goerli") {
      warningMessage +=
        "Use https://goerlifaucet.com/ to request funds on goerli, then run the script again.\n";
    }

    throw new Error(warningMessage);
  }

  const feeData = precalculatedFeeData || (await connectedSigner.getFeeData());
  const gasRequired = feeData
    .maxFeePerGas!.add(feeData.maxPriorityFeePerGas!)
    .mul(ERC20_TRANSFER_GAS_LIMIT);

  if (balance.lt(value.add(gasRequired))) {
    throw new Error(
      `Insufficient ETH balance of ${toReadableAmount(
        balance.toString(),
        18,
        12
      )}. Needs ${toReadableAmount(
        value.add(gasRequired).toString(),
        18,
        12
      )} ETH.`
    );
  }

  if (balance.lt(value)) {
    throw new Error(
      `Insufficient funds to perform this deposit. Have: ${toReadableAmount(
        balance.toString(),
        18,
        12
      )} ETH; Need: ${toReadableAmount(
        value.add(gasRequired).toString(),
        18,
        12
      )} ETH.`
    );
  }

  if (!tokenContract.populateTransaction.deposit) {
    throw new Error("Invalid contract call. Exiting...\n");
  }

  const populatedTx = await tokenContract!.populateTransaction!.deposit({
    value,
  });

  try {
    console.log("Awaiting confirmation for wrap tx...\n");

    const submittedTx = await connectedSigner.sendTransaction(populatedTx);

    await provider.waitForTransaction(submittedTx.hash, 1);

    print(
      `Wrapped ${toReadableAmount(value.toString(), 18, 12)} ETH`,
      `https://${network.name}.etherscan.io/tx/${submittedTx.hash}`
    );
  } catch (error: any) {
    if (error.toString().includes("ACTIVITY_STATUS_CONSENSUS_NEEDED")) {
      console.error(
        `Consensus is required for activity ${
          error.activityId
        } in order to wrap ${toReadableAmount(value.toString(), 18, 12)} ETH.`
      );
      return;
    }

    console.error("Encountered error:", error.toString(), "\n");
  }
}

export async function unwrapWeth(
  connectedSigner: ethers.Signer,
  value: ethers.BigNumber,
  tokenContract: ethers.Contract,
  precalculatedFeeData: ethers.providers.FeeData | undefined = undefined
) {
  const provider = connectedSigner.provider!;
  const network = await provider.getNetwork();
  const balance = await connectedSigner.getBalance();
  const address = await connectedSigner.getAddress();

  if (balance.isZero()) {
    let warningMessage =
      "The transaction won't be broadcast because your account balance is zero.\n";
    if (network.name === "goerli") {
      warningMessage +=
        "Use https://goerlifaucet.com/ to request funds on goerli, then run the script again.\n";
    }

    throw new Error(warningMessage);
  }

  const feeData = precalculatedFeeData || (await connectedSigner.getFeeData());
  const gasRequired = feeData
    .maxFeePerGas!.add(feeData.maxPriorityFeePerGas!)
    .mul(ERC20_TRANSFER_GAS_LIMIT);

  if (balance.lt(gasRequired)) {
    throw new Error(
      `Insufficient ETH balance of ${toReadableAmount(
        balance.toString(),
        18,
        12
      )}. Needs ${toReadableAmount(
        value.add(gasRequired).toString(),
        18,
        12
      )} ETH for gas.`
    );
  }

  // check token balance
  const tokenBalance = await tokenContract.balanceOf(address);
  if (tokenBalance.lt(value)) {
    throw new Error(
      `Insufficient funds to unwrap. Have: ${toReadableAmount(
        tokenBalance.toString(),
        18,
        12
      )} WETH; Need: ${toReadableAmount(value.toString(), 18, 12)} WETH.`
    );
  }

  if (!tokenContract.populateTransaction.withdraw) {
    throw new Error("Invalid contract call. Exiting...\n");
  }

  const populatedTx = await tokenContract!.populateTransaction!.withdraw(value);

  try {
    console.log("Awaiting confirmation for unwrap tx...\n");

    const submittedTx = await connectedSigner.sendTransaction(populatedTx);

    await provider.waitForTransaction(submittedTx.hash, 1);

    print(
      `Unwrapped ${toReadableAmount(value.toString(), 18, 12)} ETH`,
      `https://${network.name}.etherscan.io/tx/${submittedTx.hash}`
    );
  } catch (error: any) {
    if (error.toString().includes("ACTIVITY_STATUS_CONSENSUS_NEEDED")) {
      console.error(
        `Consensus is required for activity ${
          error.activityId
        } in order to unwrap ${toReadableAmount(value.toString(), 18, 12)} ETH.`
      );
      return;
    }

    console.error("Encountered error:", error.toString(), "\n");
  }
}

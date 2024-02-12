import * as path from "path";
import * as dotenv from "dotenv";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { ethers } from "ethers";
import type { Token } from "@uniswap/sdk-core";
import { toReadableAmount } from "../utils";
import { getProvider, getTurnkeySigner } from "../provider";
import {
  ERC20_ABI,
  UNI_TOKEN_GOERLI,
  USDC_TOKEN_GOERLI,
  WETH_TOKEN_GOERLI,
} from "../utils";

import prompts from "prompts";

async function main() {
  if (!process.env.SIGN_WITH) {
    console.log("Missing SIGN_WITH env var");
    return;
  }

  // Connect it with a Provider (https://docs.ethers.org/v6/api/providers/)
  const provider = getProvider();
  const connectedSigner = getTurnkeySigner(provider);

  const network = await provider.getNetwork();
  const chainId = (await connectedSigner.provider?.getNetwork())?.chainId ?? 0n;
  const address = await connectedSigner.getAddress();
  const balance = (await connectedSigner.provider?.getBalance(address)) ?? 0n;
  const destinationAddress = "0x2Ad9eA1E677949a536A270CEC812D6e868C88108";

  print("Network:", `${network.name} (chain ID ${chainId})`);
  print("Address:", address);
  print("Balance:", `${ethers.formatEther(balance)} Ether`);

  if (balance === 0n) {
    let warningMessage =
      "The transaction won't be broadcasted because your account balance is zero.\n";
    if (network.name === "goerli") {
      warningMessage +=
        "Use https://goerlifaucet.com/ to request funds on Goerli, then run the script again.\n";
    }

    console.warn(warningMessage);
    return;
  }

  if (network.name === "goerli") {
    const tokens: Token[] = [
      UNI_TOKEN_GOERLI,
      USDC_TOKEN_GOERLI,
      WETH_TOKEN_GOERLI,
    ];

    await sweepTokens(
      connectedSigner,
      network.name,
      tokens,
      address,
      destinationAddress
    );
    await sweepEth(connectedSigner, network.name, destinationAddress);
  }
}

async function sweepTokens(
  connectedSigner: ethers.Signer,
  network: string,
  tokens: Token[],
  address: string,
  destinationAddress: string
) {
  for (let t of tokens) {
    let contract = new ethers.Contract(t.address, ERC20_ABI, connectedSigner);
    let balance: bigint = (await contract.balanceOf?.(address)) ?? 0n;

    if (balance === 0n) {
      console.warn(`No balance for ${t.symbol}. Skipping...`);
      continue;
    }

    let { confirmed } = await prompts([
      {
        type: "confirm",
        name: "confirmed",
        message: `Please confirm: transfer ${toReadableAmount(
          balance.toString(),
          t.decimals,
          12
        )} ${t.symbol || "<missing symbol>"} (token address ${
          t.address
        }) to ${destinationAddress}?`,
      },
    ]);

    if (confirmed) {
      let transferTx = await contract.transfer?.(destinationAddress, balance);

      console.log("Awaiting confirmation...");

      await connectedSigner.provider?.waitForTransaction(transferTx.hash, 1);

      print(
        `Sent ${toReadableAmount(balance.toString(), t.decimals)} ${
          t.symbol || "<missing symbol>"
        } (token address ${t.address}) to ${destinationAddress}:`,
        `https://${network}.etherscan.io/tx/${transferTx.hash}`
      );
    } else {
      print(`Skipping transfer...`, ``);
    }
  }
}

async function sweepEth(
  connectedSigner: ethers.Signer,
  network: string,
  destinationAddress: string
) {
  const address = await connectedSigner.getAddress();
  const balance = (await connectedSigner.provider?.getBalance(address)) ?? 0n;

  const feeData = await connectedSigner.provider?.getFeeData();
  const gasRequired = feeData?.maxFeePerGas
    ? feeData?.maxFeePerGas * 21000n
    : 0n;
  const value = balance - gasRequired;

  if (value <= 0) {
    console.warn(`Insufficient ETH balance to sweep. Skipping...`);
    return;
  }

  const transactionRequest = {
    to: destinationAddress,
    value: value,
    type: 2,
    maxFeePerGas: feeData?.maxFeePerGas ?? 0n,
    maxPriorityFeePerGas: feeData?.maxPriorityFeePerGas ?? 0n,
  };

  let { confirmed } = await prompts([
    {
      type: "confirm",
      name: "confirmed",
      message: `Please confirm: transfer ${toReadableAmount(
        value.toString(),
        18,
        12
      )} ETH (balance of ${toReadableAmount(
        balance.toString(),
        18,
        12
      )} - ${toReadableAmount(
        gasRequired.toString(),
        18,
        12
      )} for gas) to ${destinationAddress}?`,
    },
  ]);

  if (confirmed) {
    const sentTx = await connectedSigner.sendTransaction(transactionRequest);

    console.log("Awaiting confirmation...");

    await connectedSigner.provider?.waitForTransaction(sentTx.hash, 1);

    print(
      `Sent ${toReadableAmount(
        value.toString(),
        18,
        12
      )} ETH to ${destinationAddress}:`,
      `https://${network}.etherscan.io/tx/${sentTx.hash}`
    );
  } else {
    print(`Skipping transfer...`, ``);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

function print(header: string, body: string): void {
  console.log(`${header}\n\t${body}\n`);
}

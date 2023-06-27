import * as path from "path";
import * as dotenv from "dotenv";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { TurnkeyApi, init as httpInit } from "@turnkey/http";
import { TurnkeySigner } from "@turnkey/ethers";
import { ethers } from "ethers";
import type { Token } from "@uniswap/sdk-core";
import { toReadableAmount } from "../utils";
import {
  ERC20_ABI,
  UNI_TOKEN_GOERLI,
  USDC_TOKEN_GOERLI,
  WETH_TOKEN_GOERLI,
} from "../utils";

import prompts from "prompts";

async function main() {
  httpInit({
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    baseUrl: process.env.BASE_URL!,
  });

  const privateKeysResponse = await TurnkeyApi.postGetPrivateKeys({
    body: {
      organizationId: process.env.ORGANIZATION_ID!,
    },
  });

  for (let pk of privateKeysResponse.privateKeys) {
    // Initialize a Turnkey Signer
    const turnkeySigner = new TurnkeySigner({
      apiPublicKey: process.env.API_PUBLIC_KEY!,
      apiPrivateKey: process.env.API_PRIVATE_KEY!,
      baseUrl: process.env.BASE_URL!,
      organizationId: process.env.ORGANIZATION_ID!,
      privateKeyId: pk.privateKeyId!,
    });

    // Bring your own provider (such as Alchemy or Infura: https://docs.ethers.org/v5/api/providers/)
    const network = "goerli";
    const provider = new ethers.providers.InfuraProvider(network);
    const connectedSigner = turnkeySigner.connect(provider);

    const chainId = await connectedSigner.getChainId();
    const address = await connectedSigner.getAddress();
    const balance = await connectedSigner.getBalance();
    const destinationAddress = "0x2Ad9eA1E677949a536A270CEC812D6e868C88108";

    print("Network:", `${network} (chain ID ${chainId})`);
    print("Address:", address);
    print("Balance:", `${ethers.utils.formatEther(balance)} Ether`);

    if (balance.isZero()) {
      let warningMessage =
        `Account balance for address ${address} is zero. Moving on to next address...\n`;
      if (network === "goerli") {
        warningMessage +=
          "Use https://goerlifaucet.com/ to request funds on Goerli, then run the script again.\n";
      }

      console.warn(warningMessage);
      continue;
    }

    if (network === "goerli") {
      const tokens: Token[] = [
        UNI_TOKEN_GOERLI,
        USDC_TOKEN_GOERLI,
        WETH_TOKEN_GOERLI,
      ];

      await sweepTokens(
        connectedSigner,
        network,
        tokens,
        address,
        destinationAddress
      );
      await sweepEth(connectedSigner, network, destinationAddress);
    }
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
    let balance = await contract.balanceOf(address);

    if (balance == 0) {
      console.warn(`No balance for ${t.symbol}. Skipping...`);
      continue;
    }

    let { confirmed } = await prompts([
      {
        type: "confirm",
        name: "confirmed",
        message: `Please confirm: transfer ${toReadableAmount(
          balance,
          t.decimals,
          12
        )} ${t.symbol || "<missing symbol>"} (token address ${
          t.address
        }) to ${destinationAddress}?`,
      },
    ]);

    if (confirmed) {
      let transferTx = await contract.transfer(destinationAddress, balance);

      console.log("Awaiting confirmation...");

      await connectedSigner.provider?.waitForTransaction(transferTx.hash, 1);

      print(
        `Sent ${toReadableAmount(balance, t.decimals)} ${
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
  const balance = await connectedSigner.getBalance();
  const feeData = await connectedSigner.getFeeData();
  const gasRequired = feeData.maxFeePerGas!.mul(21000);
  const value = balance.sub(gasRequired);

  if (value.lte(0)) {
    console.warn(`Insufficient ETH balance to sweep. Skipping...`);
    return;
  }

  const transactionRequest = {
    to: destinationAddress,
    value: value,
    type: 2,
    maxFeePerGas: feeData.maxFeePerGas!,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas!,
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

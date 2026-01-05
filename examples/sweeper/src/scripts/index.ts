import * as path from "path";
import * as dotenv from "dotenv";
// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { ethers } from "ethers";
import prompts from "prompts";
import { getTurnkeyClient, pollTransactionStatus } from "../turnkey";
import { toReadableAmount } from "../utils";
import { ERC20_ABI, USDC_SEPOLIA, WETH_SEPOLIA } from "../tokens";

const RPC_URL = "https://ethereum-sepolia-rpc.publicnode.com";
const provider = new ethers.JsonRpcProvider(RPC_URL);

export async function main() {
  const orgId = process.env.ORGANIZATION_ID!;
  const signWith = process.env.SIGN_WITH!;
  const turnkey = getTurnkeyClient();
  const address = signWith;
  const destination = process.env.DESTINATION_ADDRESS!;

  // Fetch ETH balance
  const balance = await provider.getBalance(address);

  console.log("Address:", address);
  console.log("Balance:", ethers.formatEther(balance));

  if (balance === 0n) {
    console.warn("Not enough ETH.");
    return;
  }

  const tokens = [USDC_SEPOLIA, WETH_SEPOLIA];
  let sponsor = false;
  const { useSponsor } = await prompts({
    type: "confirm",
    name: "useSponsor",
    message: "Use Turnkey gas sponsorship for sweep transactions?",
    initial: false,
  });
  sponsor = !!useSponsor;

  await sweepTokens(turnkey, orgId, address, destination, tokens, sponsor);
  await sweepEth(turnkey, orgId, address, destination, sponsor);
}

async function sweepTokens(
  turnkey: any,
  organizationId: string,
  ownerAddress: string,
  destination: string,
  tokens: any[],
  sponsor: boolean,
) {
  for (const token of tokens) {
    const contract = new ethers.Contract(token.address, ERC20_ABI, provider);
    const balance: bigint = await (contract as any).balanceOf(ownerAddress);

    if (balance === 0n) {
      console.log(`No ${token.symbol}. Skipping...`);
      continue;
    }

    const { confirmed } = await prompts({
      type: "confirm",
      name: "confirmed",
      message: `Transfer ${toReadableAmount(
        balance,
        token.decimals,
      )} ${token.symbol} to ${destination}?`,
    });

    if (!confirmed) continue;

    // Build calldata manually for ERC-20 transfer
    const iface = new ethers.Interface(ERC20_ABI);
    const calldata = iface.encodeFunctionData("transfer", [
      destination,
      balance,
    ]);

    // Fetch nonce (same pattern as sweepEth)
    const resp = await turnkey.apiClient().getNonces({
      organizationId,
      address: ownerAddress,
      caip2: "eip155:11155111", // Sepolia
      nonce: sponsor ? false : true,
      gasStationNonce: sponsor ? true : false,
    });

    const { nonce } = resp;
    const { gasStationNonce } = resp;
    // Submit transaction via Turnkey
    const { sendTransactionStatusId } = await turnkey
      .apiClient()
      .ethSendTransaction({
        organizationId,
        from: ownerAddress,
        to: token.address,
        caip2: "eip155:11155111", // Sepolia
        gasStationNonce: sponsor ? gasStationNonce : undefined,
        nonce: sponsor ? undefined : nonce,
        sponsor,
        data: calldata,
        gasLimit: sponsor ? undefined : "200000",
      });

    // Poll for final inclusion
    const status = await pollTransactionStatus({
      apiClient: turnkey.apiClient(),
      organizationId,
      sendTransactionStatusId,
    });

    if (status.txStatus !== "INCLUDED") {
      throw new Error(
        `${token.symbol} sweep failed with status: ${status.txStatus}`,
      );
    }

    console.log(
      `Sent ${token.symbol}: https://sepolia.etherscan.io/tx/${status.eth?.txHash}`,
    );
  }
}

async function sweepEth(
  turnkey: any,
  organizationId: string,
  ownerAddress: string,
  destination: string,
  sponsor: boolean,
) {
  const balance = await provider.getBalance(ownerAddress);
  const feeData = await provider.getFeeData();

  const gas = 93000n;

  const maxPriorityFee = feeData.maxPriorityFeePerGas;

  const maxFee = feeData.maxFeePerGas;

  const gasCost = gas * maxFee!;
  const value = balance - gasCost;

  if (value <= 0n) {
    console.warn("Not enough ETH to sweep.");
    return;
  }

  const { confirmed } = await prompts({
    type: "confirm",
    name: "confirmed",
    message: `Sweep ${ethers.formatEther(value)} ETH to ${destination}?`,
  });

  if (!confirmed) return;
  const resp = await turnkey.apiClient().getNonces({
    organizationId,
    address: ownerAddress,
    caip2: "eip155:11155111", // Sepolia
    nonce: sponsor ? false : true,
    gasStationNonce: sponsor ? true : false,
  });
  const { nonce } = resp;
  const { gasStationNonce } = resp;
  // Submit transaction via Turnkey
  const { sendTransactionStatusId } = await turnkey
    .apiClient()
    .ethSendTransaction({
      organizationId,
      from: ownerAddress,
      to: destination,
      gasStationNonce: sponsor ? gasStationNonce : undefined,
      nonce: sponsor ? undefined : nonce,
      sponsor,
      caip2: "eip155:11155111",
      value: value.toString(),
      gasLimit: sponsor ? undefined : gas.toString(),
      maxFeePerGas: sponsor ? undefined : maxFee!.toString(),
      maxPriorityFeePerGas: sponsor ? undefined : maxPriorityFee!.toString(),
    });
  // Poll for final inclusion
  const status = await pollTransactionStatus({
    apiClient: turnkey.apiClient(),
    organizationId,
    sendTransactionStatusId,
  });

  if (status.txStatus !== "INCLUDED") {
    throw new Error(`ETH sweep failed with status: ${status.txStatus}`);
  }

  console.log(
    `Sent ETH: https://sepolia.etherscan.io/tx/${status.eth?.txHash}`,
  );
}
main().catch((error) => {
  console.error(error);
  process.exit(1);
});

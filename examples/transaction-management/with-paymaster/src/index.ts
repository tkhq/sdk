import * as path from "path";
import * as dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { ethers } from "ethers";
import prompts from "prompts";
import { getTurnkeyClient, pollTransactionStatus } from "./turnkey";
import { USDC_BASE } from "./tokens";

const CAIP2_BASE = "eip155:8453";
const RPC_URL = process.env.BASE_RPC_URL ?? "https://mainnet.base.org";
const provider = new ethers.JsonRpcProvider(RPC_URL);

const ERC20_INTERFACE = new ethers.Interface([
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address owner) view returns (uint256)",
]);

async function main() {
  const organizationId = process.env.ORGANIZATION_ID;
  const sender = process.env.SIGN_WITH;

  if (!organizationId || !sender) {
    throw new Error("Missing ORGANIZATION_ID or SIGN_WITH");
  }

  const senderAddress = ethers.getAddress(sender);

  const transferParams = await getTransferParams();
  if (!transferParams) {
    console.log("Transfer cancelled.");
    return;
  }

  const { recipientAddress, amount, amountInput } = transferParams;

  console.log(`\nSender: ${senderAddress}`);
  console.log(`Recipient: ${recipientAddress}`);
  console.log(`Amount: ${amountInput} USDC\n`);

  const balanceData = await provider.call({
    to: USDC_BASE.address,
    data: ERC20_INTERFACE.encodeFunctionData("balanceOf", [senderAddress]),
  });
  const balance = ERC20_INTERFACE.decodeFunctionResult(
    "balanceOf",
    balanceData,
  )[0] as bigint;

  if (balance < amount) {
    const available = ethers.formatUnits(balance, USDC_BASE.decimals);
    throw new Error(`Insufficient USDC balance. Available: ${available}`);
  }

  const { proceed } = await prompts({
    type: "confirm",
    name: "proceed",
    message: `Send ${amountInput} USDC to ${recipientAddress} on Base?`,
    initial: true,
  });

  if (!proceed) {
    console.log("Transfer cancelled.");
    return;
  }

  const txHash = await sendTransfer(
    organizationId,
    senderAddress,
    recipientAddress,
    amount,
  );

  console.log("Transfer sent");
  console.log(`Tx: https://basescan.org/tx/${txHash}`);
}

async function getTransferParams(): Promise<{
  recipientAddress: string;
  amount: bigint;
  amountInput: string;
} | null> {
  const { recipient, amountInput } = await prompts([
    {
      type: "text",
      name: "recipient",
      message: "Recipient address:",
    },
    {
      type: "text",
      name: "amountInput",
      message: "Amount of USDC to send:",
      initial: "0.1",
    },
  ]);

  if (!recipient || !amountInput) {
    return null;
  }

  return {
    recipientAddress: ethers.getAddress(recipient),
    amount: ethers.parseUnits(amountInput, USDC_BASE.decimals),
    amountInput,
  };
}

async function sendTransfer(
  organizationId: string,
  senderAddress: string,
  recipientAddress: string,
  amount: bigint,
): Promise<string> {
  const turnkey = getTurnkeyClient();
  const data = ERC20_INTERFACE.encodeFunctionData("transfer", [
    recipientAddress,
    amount,
  ]);

  const { gasStationNonce } = await turnkey.apiClient().getNonces({
    organizationId,
    address: senderAddress,
    caip2: CAIP2_BASE,
    gasStationNonce: true,
  });

  if (!gasStationNonce) {
    throw new Error("Failed to get gas station nonce");
  }

  const { sendTransactionStatusId } = await turnkey
    .apiClient()
    .ethSendTransaction({
      organizationId,
      from: senderAddress,
      to: USDC_BASE.address,
      caip2: CAIP2_BASE,
      sponsor: true,
      data,
      value: "0",
      gasStationNonce,
    });

  const result = await pollTransactionStatus({
    apiClient: turnkey.apiClient(),
    organizationId,
    sendTransactionStatusId,
  });

  return result.eth?.txHash ?? "";
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

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

async function main() {
  const organizationId = process.env.ORGANIZATION_ID;
  const sender = process.env.SIGN_WITH;
  const recipient = process.env.RECIPIENT;

  if (!organizationId || !sender || !recipient) {
    throw new Error("Missing ORGANIZATION_ID, SIGN_WITH, or RECIPIENT");
  }

  const amountInput = process.env.AMOUNT_USDC ?? "0.1";

  const senderAddress = ethers.getAddress(sender);
  const recipientAddress = ethers.getAddress(recipient);
  const amount = ethers.parseUnits(amountInput, USDC_BASE.decimals);

  const turnkey = getTurnkeyClient();

  console.log(`\nSender: ${senderAddress}`);
  console.log(`Recipient: ${recipientAddress}`);
  console.log(`Amount: ${amountInput} USDC`);
  console.log("");

  const erc20 = new ethers.Interface([
    "function transfer(address to, uint256 amount) returns (bool)",
    "function balanceOf(address owner) view returns (uint256)",
  ]);

  const balanceData = await provider.call({
    to: USDC_BASE.address,
    data: erc20.encodeFunctionData("balanceOf", [senderAddress]),
  });
  const balance = erc20.decodeFunctionResult(
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

  const data = erc20.encodeFunctionData("transfer", [recipientAddress, amount]);

  const payload: any = {
    organizationId,
    from: senderAddress,
    to: USDC_BASE.address,
    caip2: CAIP2_BASE,
    sponsor: true,
    data,
    value: "0",
  };

  payload.gasStationNonce = (
    await turnkey.apiClient().getNonces({
      organizationId,
      address: senderAddress,
      caip2: CAIP2_BASE,
      gasStationNonce: true,
    })
  ).gasStationNonce;

  const { sendTransactionStatusId } = await turnkey
    .apiClient()
    .ethSendTransaction(payload);

  const result = await pollTransactionStatus({
    apiClient: turnkey.apiClient(),
    organizationId,
    sendTransactionStatusId,
  });

  console.log("Transfer sent");
  console.log(`Tx: https://basescan.org/tx/${result.eth?.txHash}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

import * as path from "path";
import * as dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { ethers } from "ethers";
import prompts from "prompts";
import { getTurnkeyClient, pollTransactionStatus } from "../turnkey";
import { ERC20_ABI, PERMIT2, PERMIT2_ABI, UNIVERSAL_ROUTER, UNIVERSAL_ROUTER_ABI, USDC, WETH } from "../tokens";

const RPC_URL = "https://ethereum-sepolia-rpc.publicnode.com";
const provider = new ethers.JsonRpcProvider(RPC_URL);

const FEE_TIER = 500;

export async function main() {
  const organizationId = process.env.ORGANIZATION_ID!;
  const wallet = ethers.getAddress(process.env.SIGN_WITH!);
  const turnkey = getTurnkeyClient();

  console.log(`\n🔐 Using wallet: ${wallet}\n`);

  const { direction } = await prompts({
    type: "select",
    name: "direction",
    message: "Choose swap direction",
    choices: [
      { title: "USDC → ETH", value: "USDC_ETH" },
      { title: "ETH → USDC", value: "ETH_USDC" },
    ],
  });

  const { sponsored } = await prompts({
    type: "confirm",
    name: "sponsored",
    message: "Use Turnkey gas sponsorship?",
  });

  const usdc = new ethers.Contract(ethers.getAddress(USDC.address), ERC20_ABI, provider);

  const usdcBalance = await usdc.balanceOf!(wallet);
  const ethBalance = await provider.getBalance(wallet);

  if (direction === "USDC_ETH" && usdcBalance < ethers.parseUnits("0.1", USDC.decimals)) {
    console.log("Insufficient USDC balance");
    return;
  }
  if (direction === "ETH_USDC" && ethBalance < ethers.parseEther("0.0001")) {
    console.log("Insufficient ETH balance");
    return;
  }

  const amountIn =
    direction === "USDC_ETH"
      ? ethers.parseUnits("0.1", USDC.decimals)
      : ethers.parseEther("0.0001");

  const amountOutMin = 1n;

  if (direction === "USDC_ETH") {
    const expiration = 281474976710655n;

    const approveData = new ethers.Interface(PERMIT2_ABI)
      .encodeFunctionData("approve", [ethers.getAddress(USDC.address), UNIVERSAL_ROUTER, amountIn, expiration]);

    let approvePayload: any = {
      organizationId,
      from: wallet,
      to: PERMIT2,
      caip2: "eip155:11155111",
      data: approveData,
      gasLimit: sponsored ? undefined : "150000",
    };

    if (sponsored) {
      approvePayload.sponsor = true;
      approvePayload.gasStationNonce = (await turnkey.apiClient().getNonces({
        organizationId, address: wallet, caip2: "eip155:11155111", gasStationNonce: true
      })).gasStationNonce;
    } else {
      const { nonce } = await turnkey.apiClient().getNonces({
        organizationId, address: wallet, caip2: "eip155:11155111", nonce: true
      });
      const fee = await provider.getFeeData();
      approvePayload.nonce = nonce;
      approvePayload.maxFeePerGas = fee.maxFeePerGas?.toString() ?? "0";
      approvePayload.maxPriorityFeePerGas = fee.maxPriorityFeePerGas?.toString() ?? "0";
    }

    const { sendTransactionStatusId } =
      await turnkey.apiClient().ethSendTransaction(approvePayload);

    await pollTransactionStatus({
      apiClient: turnkey.apiClient(),
      organizationId,
      sendTransactionStatusId,
    });

    console.log("USDC approved via Permit2");
  }

  console.log("→ Preparing Universal Router calldata…");

  const router = new ethers.Interface(UNIVERSAL_ROUTER_ABI);

  let commands: Uint8Array;
  let inputs: string[];

  const path = ethers.concat([
    direction === "ETH_USDC" ? ethers.getAddress(WETH.address) : ethers.getAddress(USDC.address),
    ethers.zeroPadValue(ethers.toBeHex(FEE_TIER), 3),
    direction === "ETH_USDC" ? ethers.getAddress(USDC.address) : ethers.getAddress(WETH.address),
  ]);

  if (direction === "ETH_USDC") {
    commands = new Uint8Array([0x0b, 0x00]);

    const wrapInput = ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "uint256"],
      [UNIVERSAL_ROUTER, amountIn]
    );

    const swapInput = ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "uint256", "uint256", "bytes", "bool"],
      [wallet, amountIn, amountOutMin, path, true]
    );

    inputs = [wrapInput, swapInput];

  } else {
    commands = new Uint8Array([0x00, 0x0c]);

    const swapInput = ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "uint256", "uint256", "bytes", "bool"],
      [wallet, amountIn, amountOutMin, path, false]
    );

    const unwrapInput = ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "uint256"],
      [wallet, 0]
    );

    inputs = [swapInput, unwrapInput];
  }

  const calldata = router.encodeFunctionData("execute", [
    ethers.hexlify(commands),
    inputs
  ]);

  let swapPayload: any = {
    organizationId,
    from: wallet,
    to: UNIVERSAL_ROUTER,
    caip2: "eip155:11155111",
    data: calldata,
    gasLimit: sponsored ? undefined : "600000",
    value: direction === "ETH_USDC" ? amountIn.toString() : "0",
  };

  if (sponsored) {
    swapPayload.sponsor = true;
    swapPayload.gasStationNonce = (await turnkey.apiClient().getNonces({
      organizationId, address: wallet, caip2: "eip155:11155111", gasStationNonce: true
    })).gasStationNonce;
  } else {
    const { nonce } = await turnkey.apiClient().getNonces({
      organizationId, address: wallet, caip2: "eip155:11155111", nonce: true
    });
    const fee = await provider.getFeeData();
    swapPayload.nonce = nonce;
    swapPayload.maxFeePerGas = fee.maxFeePerGas?.toString() ?? "0";
    swapPayload.maxPriorityFeePerGas = fee.maxPriorityFeePerGas?.toString() ?? "0";
  }

  const { sendTransactionStatusId: swapTx } =
    await turnkey.apiClient().ethSendTransaction(swapPayload);

  const swapResult = await pollTransactionStatus({
    apiClient: turnkey.apiClient(),
    organizationId,
    sendTransactionStatusId: swapTx,
  });

  console.log(`✔ Swap executed successfully`);
  console.log(`Tx: https://sepolia.etherscan.io/tx/${swapResult.eth?.txHash}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
import * as path from "path";
import * as dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { ethers } from "ethers";
import prompts from "prompts";
import { getTurnkeyClient, pollTransactionStatus } from "../turnkey";
import { ERC20_ABI, USDC, WETH } from "../tokens";

const UNIVERSAL_ROUTER = "0x3A9D48AB9751398BbFa63ad67599Bb04e4BdF98b";
const UNIVERSAL_ROUTER_ABI = [
  "function execute(bytes commands, bytes[] inputs) payable"
];

const RPC_URL = "https://ethereum-sepolia-rpc.publicnode.com";
const provider = new ethers.JsonRpcProvider(RPC_URL);

// ONLY valid pool on Sepolia
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
  const weth = new ethers.Contract(ethers.getAddress(WETH.address), ERC20_ABI, provider);

  const usdcBalance = await usdc.balanceOf!(wallet);
  const ethBalance = await provider.getBalance(wallet);

  if (direction === "USDC_ETH" && usdcBalance < ethers.parseUnits("5", USDC.decimals)) return;
  if (direction === "ETH_USDC" && ethBalance < ethers.parseEther("0.0025")) return;

  const amountIn =
    direction === "USDC_ETH"
      ? ethers.parseUnits("5", USDC.decimals)
      : ethers.parseEther("0.0025");

  const amountOutMin = 0n;

  //
  // APPROVE USDC IF NEEDED
  //
  if (direction === "USDC_ETH") {
    const approveData = new ethers.Interface(ERC20_ABI)
      .encodeFunctionData("approve", [UNIVERSAL_ROUTER, amountIn]);

    let approvePayload: any = {
      organizationId,
      from: wallet,
      to: ethers.getAddress(USDC.address),
      caip2: "eip155:11155111",
      data: approveData,
      gasLimit: "150000",
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
  }

  //
  // UNIVERSAL ROUTER SWAP — SEPOLIA COMPATIBLE FORMAT
  //
  console.log("→ Preparing Universal Router calldata…");

  const router = new ethers.Interface(UNIVERSAL_ROUTER_ABI);

  let commands: Uint8Array;
  let inputs: string[];

  if (direction === "ETH_USDC") {
    //
    // COMMANDS: wrapETH (0x09) → v3ExactInput (0x0b)
    //
    commands = new Uint8Array([0x09, 0x0b]);

    const wrapInput = ethers.zeroPadValue("0x", 32);

    //
    // OLD STRUCT FORMAT (NO PATH BYTES!)
    //
    const swapInput = ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "address", "uint24", "address", "uint256", "uint256"],
      [
        ethers.getAddress(WETH.address),
        ethers.getAddress(USDC.address),
        FEE_TIER,
        wallet,
        amountIn,
        amountOutMin
      ]
    );

    inputs = [wrapInput, swapInput];

  } else {
    //
    // COMMAND: v3ExactInput (0x0b)
    //
    commands = new Uint8Array([0x0b]);

    const swapInput = ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "address", "uint24", "address", "uint256", "uint256"],
      [
        ethers.getAddress(USDC.address),
        ethers.getAddress(WETH.address),
        FEE_TIER,
        wallet,
        amountIn,
        amountOutMin
      ]
    );

    inputs = [swapInput];
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
    gasLimit: "600000",
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

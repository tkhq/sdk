import * as path from "path";
import * as dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { ethers } from "ethers";
import prompts from "prompts";
import { getTurnkeyClient, pollTransactionStatus } from "../turnkey";
import { UNIVERSAL_ROUTER, UNIVERSAL_ROUTER_ABI, USDC, WETH } from "../tokens";

const RPC_URL = "https://mainnet.base.org";
const provider = new ethers.JsonRpcProvider(RPC_URL);

const FEE_TIER = 500;

export async function main() {
  const organizationId = process.env.ORGANIZATION_ID!;
  const wallet = ethers.getAddress(process.env.SIGN_WITH!);
  const turnkey = getTurnkeyClient();

  console.log(`\n🔐 Using wallet: ${wallet}\n`);

  const { sponsored } = await prompts({
    type: "confirm",
    name: "sponsored",
    message: "Use Turnkey gas sponsorship?",
  });

  const ethBalance = await provider.getBalance(wallet);

  if (ethBalance < ethers.parseEther("0.000005")) {
    console.log("Insufficient ETH balance");
    return;
  }

  const amountIn = ethers.parseEther("0.000005");
  const amountOutMin = 0n;

  const router = new ethers.Interface(UNIVERSAL_ROUTER_ABI);

  const pathBytes = ethers.concat([
    ethers.getAddress(WETH.address),
    ethers.zeroPadValue(ethers.toBeHex(FEE_TIER), 3),
    ethers.getAddress(USDC.address),
  ]);

  const commands = new Uint8Array([0x0b, 0x00]);

  const wrapInput = ethers.AbiCoder.defaultAbiCoder().encode(
    ["address", "uint256"],
    [UNIVERSAL_ROUTER, amountIn],
  );

  const swapInput = ethers.AbiCoder.defaultAbiCoder().encode(
    ["address", "uint256", "uint256", "bytes", "bool"],
    [wallet, amountIn, amountOutMin, pathBytes, false],
  );

  const inputs = [wrapInput, swapInput];

  const calldata = router.encodeFunctionData("execute", [
    ethers.hexlify(commands),
    inputs,
  ]);

  let swapPayload: any = {
    organizationId,
    from: wallet,
    to: UNIVERSAL_ROUTER,
    caip2: "eip155:8453",
    data: calldata,
    gasLimit: sponsored ? undefined : "600000",
    value: amountIn.toString(),
  };

  if (sponsored) {
    swapPayload.sponsor = true;
    swapPayload.gasStationNonce = (
      await turnkey.apiClient().getNonces({
        organizationId,
        address: wallet,
        caip2: "eip155:8453",
        gasStationNonce: true,
      })
    ).gasStationNonce;
  } else {
    const { nonce } = await turnkey.apiClient().getNonces({
      organizationId,
      address: wallet,
      caip2: "eip155:8453",
      nonce: true,
    });
    const fee = await provider.getFeeData();
    swapPayload.nonce = nonce;
    swapPayload.maxFeePerGas = fee.maxFeePerGas?.toString() ?? "0";
    swapPayload.maxPriorityFeePerGas =
      fee.maxPriorityFeePerGas?.toString() ?? "0";
  }

  const { sendTransactionStatusId: swapTx } = await turnkey
    .apiClient()
    .ethSendTransaction(swapPayload);

  const swapResult = await pollTransactionStatus({
    apiClient: turnkey.apiClient(),
    organizationId,
    sendTransactionStatusId: swapTx,
  });

  console.log(`✔ Swap executed successfully`);
  console.log(`Tx: https://basescan.org/tx/${swapResult.eth?.txHash}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

import { encodeFunctionData, parseAbi, parseUnits } from "viem";
import { AaveV3BaseSepolia, MiscBaseSepolia } from "@bgd-labs/aave-address-book";
import { sendBatch, signWith } from "./util";

/**
 * Mint 100 test USDC from Aave's Base Sepolia faucet — itself submitted as a
 * sponsored ETH_SEND_TRANSACTION_V2 call, so the wallet needs NO ETH at any
 * point in this example.
 */
const faucetAbi = parseAbi([
  "function mint(address token, address to, uint256 amount) returns (uint256)",
]);

async function main() {
  const me = signWith();
  const usdc = AaveV3BaseSepolia.ASSETS.USDC.UNDERLYING as `0x${string}`;

  await sendBatch({
    label: "FAUCET",
    calls: [
      {
        to: MiscBaseSepolia.FAUCET as `0x${string}`,
        data: encodeFunctionData({
          abi: faucetAbi,
          functionName: "mint",
          args: [usdc, me, parseUnits("100", 6)],
        }),
      },
    ],
  });
  console.log("Minted 100 test USDC to", me);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

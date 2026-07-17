import { encodeFunctionData, maxUint256, parseAbi } from "viem";
import { AaveV3BaseSepolia } from "@bgd-labs/aave-address-book";
import { sendBatch, signWith } from "./util";

/**
 * EXIT: withdraw the full USDC position from Aave v3 in one sponsored
 * activity — the "big red button". Passing type(uint256).max withdraws
 * everything. In a real treasury this batch would also repay debt and
 * unwind collateral across protocols; every call still lands in the same
 * single atomic transaction.
 */
const poolAbi = parseAbi([
  "function withdraw(address asset, uint256 amount, address to) returns (uint256)",
]);

async function main() {
  const me = signWith();
  const usdc = AaveV3BaseSepolia.ASSETS.USDC.UNDERLYING as `0x${string}`;
  const pool = AaveV3BaseSepolia.POOL as `0x${string}`;

  await sendBatch({
    label: "EXIT",
    calls: [
      {
        to: pool,
        data: encodeFunctionData({
          abi: poolAbi,
          functionName: "withdraw",
          args: [usdc, maxUint256, me],
        }),
      },
    ],
  });
  console.log("Withdrew full USDC position from Aave v3 (Base Sepolia).");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

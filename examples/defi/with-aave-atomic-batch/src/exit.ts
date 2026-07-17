import { encodeFunctionData, erc20Abi, maxUint256, parseAbi } from "viem";
import { AaveV3BaseSepolia } from "@bgd-labs/aave-address-book";
import { printPosition, sendBatch, settle, signWith } from "./util";

/**
 * EXIT — the "big red button": approve → repay(max) → withdraw(max) as ONE
 * atomic transaction.
 *
 * The order is load-bearing: Aave will not release the collateral while debt
 * is outstanding (withdraw(max) before repay reverts on health factor — see
 * exit-wrong-order.ts). Done as three separate transactions, a failure or
 * delay after `repay` leaves the position mid-unwind: debt repaid but
 * collateral still exposed while someone watches a screen. As a V2 batch it
 * is all-or-nothing — the position is either fully unwound or untouched.
 */
const poolAbi = parseAbi([
  "function repay(address asset, uint256 amount, uint256 interestRateMode, address onBehalfOf) returns (uint256)",
  "function withdraw(address asset, uint256 amount, address to) returns (uint256)",
]);

async function main() {
  const me = signWith();
  const usdc = AaveV3BaseSepolia.ASSETS.USDC.UNDERLYING as `0x${string}`;
  const pool = AaveV3BaseSepolia.POOL as `0x${string}`;
  const VARIABLE_RATE = 2n;

  await printPosition("before");

  await sendBatch({
    label: "EXIT",
    calls: [
      {
        to: usdc,
        data: encodeFunctionData({
          abi: erc20Abi,
          functionName: "approve",
          args: [pool, maxUint256],
        }),
      },
      {
        to: pool,
        data: encodeFunctionData({
          abi: poolAbi,
          functionName: "repay",
          args: [usdc, maxUint256, VARIABLE_RATE, me], // max = full debt incl. accrued interest
        }),
      },
      {
        to: pool,
        data: encodeFunctionData({
          abi: poolAbi,
          functionName: "withdraw",
          args: [usdc, maxUint256, me], // max = entire remaining collateral
        }),
      },
    ],
  });

  await settle();
  await printPosition("after");
  console.log("Position fully unwound — repay + withdraw in one atomic tx.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

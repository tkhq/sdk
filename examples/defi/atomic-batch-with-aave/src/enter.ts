import { encodeFunctionData, erc20Abi, parseAbi, parseUnits } from "viem";
import { AaveV3BaseSepolia } from "@bgd-labs/aave-address-book";
import { printPosition, sendBatch, settle, signWith } from "./util";

/**
 * ENTER a leveraged position: approve → supply 90 USDC → borrow 20 USDC —
 * THREE calls, ONE Turnkey activity, ONE atomic on-chain transaction
 * (EIP-7702 batch via Gas Station).
 *
 * After this runs the wallet has collateral posted AND debt outstanding —
 * a real position that cannot be safely unwound step-by-step (see exit.ts).
 *
 * We supply 90 of the faucet's 100 USDC and keep 10 liquid so the exit can
 * always cover accrued borrow interest on repay(max).
 */
const poolAbi = parseAbi([
  "function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode)",
  "function borrow(address asset, uint256 amount, uint256 interestRateMode, uint16 referralCode, address onBehalfOf)",
]);

async function main() {
  const me = signWith();
  const usdc = AaveV3BaseSepolia.ASSETS.USDC.UNDERLYING as `0x${string}`;
  const pool = AaveV3BaseSepolia.POOL as `0x${string}`;
  const supplyAmount = parseUnits("90", 6);
  const borrowAmount = parseUnits("20", 6);
  const VARIABLE_RATE = 2n;

  await printPosition("before");

  await sendBatch({
    label: "ENTER",
    calls: [
      {
        to: usdc,
        data: encodeFunctionData({
          abi: erc20Abi,
          functionName: "approve",
          args: [pool, supplyAmount],
        }),
      },
      {
        to: pool,
        data: encodeFunctionData({
          abi: poolAbi,
          functionName: "supply",
          args: [usdc, supplyAmount, me, 0],
        }),
      },
      {
        to: pool,
        data: encodeFunctionData({
          abi: poolAbi,
          functionName: "borrow",
          args: [usdc, borrowAmount, VARIABLE_RATE, 0, me],
        }),
      },
    ],
  });

  await settle();
  await printPosition("after");
  console.log(
    "Position opened: 90 USDC collateral, 20 USDC debt — approve + supply + borrow in one atomic tx.",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

import { encodeFunctionData, erc20Abi, maxUint256, parseAbi } from "viem";
import { AaveV3BaseSepolia } from "@bgd-labs/aave-address-book";
import { printPosition, sendBatch, settle, signWith } from "./util";

/**
 * PROOF OF ATOMICITY — deliberately submit the exit with the calls in the
 * WRONG order: withdraw(max) BEFORE repay. Aave rejects withdrawing
 * collateral while debt is outstanding, and because the batch executes as one
 * transaction the WHOLE thing fails — in practice Turnkey's Gas Station
 * pre-flight simulation catches it and nothing is even broadcast
 * (txStatus=FAILED, "Pre-flight simulation failed"). Run `positions` before
 * and after: the position is untouched.
 *
 * This is the property that makes batched unwinds safe: there is no way to
 * end up half-exited.
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

  const before = await printPosition("before");
  if (before.debtUsd === 0) {
    console.log("No open debt — run `pnpm enter` first, then try this.");
    return;
  }

  try {
    await sendBatch({
      label: "EXIT-WRONG-ORDER",
      calls: [
        {
          to: pool,
          data: encodeFunctionData({
            abi: poolAbi,
            functionName: "withdraw", // ← wrong: collateral is still backing debt
            args: [usdc, maxUint256, me],
          }),
        },
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
            args: [usdc, maxUint256, VARIABLE_RATE, me],
          }),
        },
      ],
    });
    console.log("Unexpected: the wrong-order batch went through.");
  } catch (err) {
    console.log(
      `Batch rejected/reverted as expected: ${(err as Error).message}`,
    );
  }

  await settle();
  const after = await printPosition("after");
  console.log(
    after.debtUsd > 0 && after.collateralUsd > 0
      ? "Position untouched — the atomic batch reverted as a unit. Run `pnpm exit` for the correct unwind."
      : "Position changed?! — investigate.",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

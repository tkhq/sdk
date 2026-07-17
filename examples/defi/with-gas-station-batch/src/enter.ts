import { encodeFunctionData, erc20Abi, parseAbi, parseUnits } from "viem";
import { AaveV3BaseSepolia } from "@bgd-labs/aave-address-book";
import { sendBatch, signWith } from "./util";

/**
 * ENTER: approve + supply 100 USDC to Aave v3 — TWO calls, ONE Turnkey
 * activity, ONE atomic on-chain transaction (EIP-7702 batch via Gas Station).
 *
 * Compare with `examples/defi/with-aave`, where approve and supply are two
 * separate transactions (two signatures, two policy evaluations, and a
 * window between them where the approval is live but unused).
 */
const poolAbi = parseAbi([
  "function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode)",
]);

async function main() {
  const me = signWith();
  const usdc = AaveV3BaseSepolia.ASSETS.USDC.UNDERLYING as `0x${string}`;
  const pool = AaveV3BaseSepolia.POOL as `0x${string}`;
  const amount = parseUnits("100", 6);

  await sendBatch({
    label: "ENTER",
    calls: [
      {
        to: usdc,
        data: encodeFunctionData({
          abi: erc20Abi,
          functionName: "approve",
          args: [pool, amount],
        }),
      },
      {
        to: pool,
        data: encodeFunctionData({
          abi: poolAbi,
          functionName: "supply",
          args: [usdc, amount, me, 0],
        }),
      },
    ],
  });
  console.log("Supplied 100 USDC to Aave v3 (Base Sepolia) — approve + supply in one tx.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

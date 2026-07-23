import { createPublicClient, http, parseAbi } from "viem";
import { base } from "viem/chains";
import {
  header,
  newClient,
  PARENT_TAG,
  resolveWrapper,
  usd,
} from "./common";

const wrapperAbi = parseAbi([
  "function performanceFeeRecipient() view returns (address)",
  "function balanceOf(address) view returns (uint256)",
  "function convertToAssets(uint256) view returns (uint256)",
]);

const splitterAbi = parseAbi([
  "function payee(uint256) view returns (address)",
  "function shares(address) view returns (uint256)",
  "function totalShares() view returns (uint256)",
  "function releasable(address token, address account) view returns (uint256)",
]);

// Platform revenue view: performance fees accrue to the splitter as wrapper
// shares and are split turnkey/client by bps. Read on-chain; payouts are
// permissionless PaymentSplitter release() calls.
async function main() {
  const { client, organizationId } = newClient("PARENT");

  header("Fee accrual (platform revenue)", PARENT_TAG);

  const vault = await resolveWrapper(client, organizationId);
  const wrapper = vault.wrapperAddress as `0x${string}`;

  const rpc = createPublicClient({ chain: base, transport: http("https://mainnet.base.org") });

  // Batch reads through Multicall3 — the public Base RPC rate-limits
  // parallel single calls.
  const splitter = await rpc.readContract({
    address: wrapper,
    abi: wrapperAbi,
    functionName: "performanceFeeRecipient",
  });

  const [feeShares, totalShares, payee0, payee1] = (await rpc.multicall({
    allowFailure: false,
    contracts: [
      { address: wrapper, abi: wrapperAbi, functionName: "balanceOf", args: [splitter] },
      { address: splitter, abi: splitterAbi, functionName: "totalShares" },
      { address: splitter, abi: splitterAbi, functionName: "payee", args: [0n] },
      { address: splitter, abi: splitterAbi, functionName: "payee", args: [1n] },
    ],
  })) as [bigint, bigint, `0x${string}`, `0x${string}`];

  const [share0, share1, releasable0, releasable1] = (await rpc.multicall({
    allowFailure: false,
    contracts: [
      { address: splitter, abi: splitterAbi, functionName: "shares", args: [payee0] },
      { address: splitter, abi: splitterAbi, functionName: "shares", args: [payee1] },
      { address: splitter, abi: splitterAbi, functionName: "releasable", args: [wrapper, payee0] },
      { address: splitter, abi: splitterAbi, functionName: "releasable", args: [wrapper, payee1] },
    ],
  })) as [bigint, bigint, bigint, bigint];

  // convertToAssets reverts on 0; shares ≈ assets for USDC, so fall back to
  // the raw share count if conversion fails.
  const conversions = await rpc.multicall({
    allowFailure: true,
    contracts: [feeShares, releasable0, releasable1].map((shares) => ({
      address: wrapper,
      abi: wrapperAbi,
      functionName: "convertToAssets" as const,
      args: [shares] as const,
    })),
  });
  const [feeValue, relValue0, relValue1] = [feeShares, releasable0, releasable1].map(
    (shares, i) => {
      if (shares === 0n) return 0n;
      const c = conversions[i]!;
      return c.status === "success" ? (c.result as bigint) : shares;
    },
  ) as [bigint, bigint, bigint];

  console.log(`💸 Wrapper ${wrapper}`);
  console.log(`   splitter:            ${splitter}`);
  console.log(`   accrued fees:        ${usd(feeValue.toString())} (${feeShares} wrapper shares, unclaimed)`);

  const payees: Array<[`0x${string}`, bigint, bigint]> = [
    [payee0, share0, relValue0],
    [payee1, share1, relValue1],
  ];
  for (const [payee, share, releasableValue] of payees) {
    const cut = Number((share * 10000n) / totalShares) / 100;

    console.log(`   payee ${payee}`);
    console.log(`     split:             ${cut}% of fees`);
    console.log(`     claimable now:     ${usd(releasableValue.toString())}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

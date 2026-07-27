import { createPublicClient, http, parseAbi } from "viem";
import { base } from "viem/chains";
import {
  header,
  newClient,
  PARENT_TAG,
  requireEnv,
  resolveWrapper,
  usd,
} from "./common";

const wrapperAbi = parseAbi([
  "function performanceFeeRecipient() view returns (address)",
  "function convertToAssets(uint256) view returns (uint256)",
]);

const splitterAbi = parseAbi([
  "function releasable(address token, address account) view returns (uint256)",
]);

// Client revenue view: your client performance fee accrues to the fee splitter
// as wrapper shares. Read the amount claimable by your fee wallet on-chain;
// payout is a permissionless PaymentSplitter release() call.
async function main() {
  const { client, organizationId } = newClient("PARENT");

  header("Fee accrual (client revenue)", PARENT_TAG);

  const vault = await resolveWrapper(client, organizationId);
  const wrapper = vault.wrapperAddress as `0x${string}`;
  const clientFeeWallet = requireEnv("CLIENT_FEE_WALLET") as `0x${string}`;

  const rpc = createPublicClient({
    chain: base,
    transport: http("https://mainnet.base.org"),
  });

  const splitter = await rpc.readContract({
    address: wrapper,
    abi: wrapperAbi,
    functionName: "performanceFeeRecipient",
  });

  // Wrapper shares releasable to the client fee wallet (0 until it accrues, or
  // if the wallet isn't a payee on this splitter).
  const releasableShares = await rpc.readContract({
    address: splitter,
    abi: splitterAbi,
    functionName: "releasable",
    args: [wrapper, clientFeeWallet],
  });

  // convertToAssets reverts on 0; shares ≈ assets for USDC, so fall back to
  // the raw share count if conversion fails.
  let claimable = releasableShares;
  if (releasableShares > 0n) {
    const [conversion] = await rpc.multicall({
      allowFailure: true,
      contracts: [
        {
          address: wrapper,
          abi: wrapperAbi,
          functionName: "convertToAssets",
          args: [releasableShares],
        },
      ],
    });
    if (conversion?.status === "success") {
      claimable = conversion.result as bigint;
    }
  }

  console.log(`💸 Wrapper ${wrapper}`);
  console.log(`   splitter:          ${splitter}`);
  console.log(`   client fee wallet: ${clientFeeWallet}`);
  console.log(`   claimable now:     ${usd(claimable.toString())}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

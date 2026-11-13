import type { TurnkeyApiClient } from "@turnkey/sdk-server";

import {
  C,
  apyText,
  chainName,
  DELEGATED_TAG,
  header,
  isSolana,
  pollEarnStatus,
  printPositions,
  sleep,
  usd,
} from "./common";
import {
  INPUT_CHAINS,
  MIN_INVEST_USD,
  POLL_SECONDS,
  SLIPPAGE_BPS,
} from "./config";
import {
  bestVault,
  type Customer,
  type EarnCaip2,
  errorMessage,
  type Holding,
  holdings,
  isPolicyDenial,
  openCustomer,
  printAssetLists,
  printVaults,
  refreshTargets,
  sameAsset,
  swap,
  type Target,
} from "./delegated";

// The automated step, signed by the platform's delegated key. It polls the Earn
// wallet; for each stablecoin balance it finds, it picks the enabled vault with
// the highest APY (excluding rewards it doesn't claim), swaps into that vault's asset if needed (cross-chain, or
// Solana → EVM), and deposits. The policies allow nothing else.
//
// Usage: pnpm watch [--once] [--chain <caip2>]
//   --once   one pass, then exit
//   --chain  only invest in vaults on this chain (to show a cross-chain swap)
//
// Stop the watcher before `pnpm redeem`, or it reinvests the withdrawn funds.

const COOLDOWN_MS = 60_000; // the Balances API can lag behind the chain

async function main() {
  const args = process.argv.slice(2);
  const once = args.includes("--once");
  const chainArg = args.indexOf("--chain");
  const onlyChain = chainArg >= 0 ? args[chainArg + 1] : undefined;

  header("Watch the Earn wallet", DELEGATED_TAG);
  const {
    client,
    subOrgId,
    customer: c,
    lists,
  } = await openCustomer("DELEGATED");
  printAssetLists(lists);
  console.log(
    `👀 Watching ${c.earnEvm} on ${INPUT_CHAINS.filter((ch) => !isSolana(ch)).length} EVM chains and ${c.earnSol} on Solana, every ${POLL_SECONDS}s` +
      (onlyChain ? `, investing only on ${chainName(onlyChain)}` : "") +
      `\n${C.dim}   (Ctrl-C to stop)${C.reset}\n`,
  );

  const failed = new Map<string, string>(); // asset → reason; skipped until restart
  const cooldown = new Map<string, number>(); // asset → until

  for (;;) {
    for (const caip2 of INPUT_CHAINS) {
      const address = isSolana(caip2) ? c.earnSol : c.earnEvm;
      let found: Holding[];
      try {
        found = await holdings(client, subOrgId, address, caip2, lists.inputs);
      } catch (error) {
        console.log(
          `${C.dim}   ${chainName(caip2)}: balance read failed (${errorMessage(error)})${C.reset}`,
        );
        continue;
      }

      for (const h of found) {
        const key = h.asset.caip19;
        if (h.usd < MIN_INVEST_USD || failed.has(key)) continue;
        if ((cooldown.get(key) ?? 0) > Date.now()) continue;

        try {
          // Rates move, so read them now rather than trusting the snapshot
          // from when the watcher started.
          const current = await refreshTargets(client, subOrgId, lists.targets);
          printVaults(current, "\n📈 Current vault APYs:", onlyChain);
          const target = bestVault(current, onlyChain);
          if (!target) {
            console.log(
              `   no open vault${onlyChain ? ` on ${chainName(onlyChain)}` : ""}; nothing to do`,
            );
            continue;
          }
          await invest(client, c, h, target, failed, cooldown);
        } catch (error) {
          const reason = isPolicyDenial(error)
            ? `denied by policy (${errorMessage(error)}). If the asset list changed, re-run \`pnpm onboard-customer\``
            : errorMessage(error);
          failed.set(key, reason);
          console.log(
            `${C.red}✗ ${h.asset.symbol} on ${chainName(h.asset.caip2)}: ${reason}\n  Skipping this asset until the watcher restarts.${C.reset}`,
          );
        }
      }
    }

    if (once) break;
    await sleep(POLL_SECONDS * 1_000);
  }
}

async function invest(
  client: TurnkeyApiClient,
  c: Customer,
  h: Holding,
  target: Target,
  failed: Map<string, string>,
  cooldown: Map<string, number>,
) {
  const amount = BigInt(h.balance.balance!);
  console.log(
    `\n💰 ${h.asset.symbol} on ${chainName(h.asset.caip2)}: ${usd(h.usd)} in the Earn wallet`,
  );
  console.log(
    `   best vault: ${target.name} (${target.symbol} on ${chainName(target.caip2)}), APY ${apyText(target)}`,
  );

  let depositAmount = amount;
  if (!sameAsset(h.asset.caip19, target.caip19)) {
    const result = await swap(client, c, h.asset, target, amount, SLIPPAGE_BPS);
    if (result.kind === "pending") {
      // Not a failure: if it settles later, its output shows up as a balance of
      // the target asset and a later poll deposits it.
      console.log(
        `   swap still pending after the wait; leaving it to settle and moving on`,
      );
      cooldown.set(h.asset.caip19, Date.now() + COOLDOWN_MS);
      return;
    }
    if (result.kind === "failed") {
      failed.set(h.asset.caip19, result.reason);
      console.log(
        `${C.red}✗ swap failed: ${result.reason}\n  Skipping ${h.asset.symbol} on ${chainName(h.asset.caip2)} until the watcher restarts.${C.reset}`,
      );
      return;
    }
    depositAmount = result.outputAmount;
  }

  console.log(
    `🏦 Depositing into ${target.name} on ${chainName(target.caip2)}…`,
  );
  const { depositRequestId } = await client.earnDeposit({
    organizationId: c.subOrgId,
    wrapperAddress: target.wrapperAddress,
    signWith: c.earnEvm,
    assets: depositAmount.toString(),
    caip2: target.caip2 as EarnCaip2,
    sponsor: true,
  });
  await pollEarnStatus("deposit", target.caip2, async () => {
    const { status, depositTxHash, error } = await client.getEarnDepositStatus({
      organizationId: c.subOrgId,
      depositRequestId,
    });
    return { status, txHash: depositTxHash, error };
  });

  // Both the input and the target asset can still show the old balance for a
  // moment; skip them briefly so they aren't acted on twice.
  cooldown.set(h.asset.caip19, Date.now() + COOLDOWN_MS);
  cooldown.set(target.caip19, Date.now() + COOLDOWN_MS);

  await printPositions(client, c.subOrgId, c.earnEvm, "now");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

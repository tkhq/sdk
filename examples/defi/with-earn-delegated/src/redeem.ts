import type { TurnkeyApiClient, v1EarnPosition } from "@turnkey/sdk-server";

import {
  ask,
  chainName,
  DELEGATED_TAG,
  header,
  pct,
  pollEarnStatus,
  printPositions,
  sleep,
  txLink,
  units,
  usd,
} from "./common";
import { SLIPPAGE_BPS, type Caip2 } from "./config";
import {
  type Asset,
  type EarnCaip2,
  holdings,
  openCustomer,
  sameAsset,
  sendEvm,
  swap,
  type Target,
} from "./delegated";

// Signed by the platform's delegated key: returns the customer's money. It
// withdraws from the lowest-APY positions first, swaps anything that isn't
// USDC on Base into USDC on Base, and sends it to the deposit wallet. The
// policies only allow that one return transfer.
//
// Stop `pnpm watch` first, or it reinvests the withdrawn funds.
//
// Usage: pnpm redeem [usd-amount | MAX]
async function main() {
  header("Redeem to the deposit wallet", DELEGATED_TAG);
  const {
    client,
    subOrgId,
    customer: c,
    lists,
  } = await openCustomer("DELEGATED");

  const arg =
    process.argv[2] ?? (await ask('Amount to return (USD, or "MAX")', "MAX"));
  const isMax = arg.trim().toUpperCase() === "MAX";
  let remaining = isMax ? Number.POSITIVE_INFINITY : Number(arg);
  if (!isMax && !(remaining > 0)) throw new Error(`invalid amount "${arg}"`);

  // Positions joined with their vault's net APY and liquidity, lowest APY first.
  const { positions = [] } = await client.listEarnPositions({
    organizationId: subOrgId,
    walletAddress: c.earnEvm,
  });
  const ranked = positions
    .map((p: v1EarnPosition) => ({
      position: p,
      vault: lists.targets.find(
        (t) =>
          t.wrapperAddress.toLowerCase() === p.wrapperAddress?.toLowerCase(),
      ),
    }))
    .filter(
      (x): x is { position: v1EarnPosition; vault: Target } =>
        !!x.vault && BigInt(x.position.currentValue ?? "0") > 0n,
    )
    .sort((a, b) => Number(a.vault.netApyPct) - Number(b.vault.netApyPct));

  if (ranked.length === 0) {
    console.log("No positions to redeem.");
    return;
  }

  // Withdraw, recording how much of each asset actually arrived.
  const withdrawn: { asset: Asset; amount: bigint }[] = [];
  for (const { position, vault } of ranked) {
    if (remaining <= 0) break;

    const value = BigInt(position.currentValue ?? "0");
    const valueUsd = units(value, vault.decimals); // stablecoins ≈ $1
    const liquidity =
      vault.liquidity !== undefined ? BigInt(vault.liquidity) : value;

    let amountValue: string;
    if (valueUsd <= remaining && value <= liquidity) {
      amountValue = "MAX"; // a full exit; avoids leaving dust behind
    } else {
      const wanted = isMax
        ? value
        : BigInt(Math.floor(remaining * 10 ** vault.decimals));
      const capped = [wanted, value, liquidity].reduce((a, b) =>
        a < b ? a : b,
      );
      if (capped <= 0n) {
        console.log(
          `   ${vault.name}: no withdrawable liquidity right now; skipping`,
        );
        continue;
      }
      amountValue = capped.toString();
    }

    console.log(
      `\n🏧 Withdrawing ${amountValue === "MAX" ? "all" : usd(units(BigInt(amountValue), vault.decimals))} from ${vault.name} on ${chainName(vault.caip2)} (net APY ${pct(vault.netApyPct)})`,
    );

    const before = await balanceOf(client, subOrgId, c.earnEvm, vault);
    const { withdrawRequestId } = await client.earnWithdraw({
      organizationId: subOrgId,
      wrapperAddress: vault.wrapperAddress,
      signWith: c.earnEvm,
      amountValue,
      caip2: vault.caip2 as EarnCaip2,
      sponsor: true,
    });
    await pollEarnStatus("withdraw", vault.caip2, async () => {
      const { status, withdrawTxHash, error } =
        await client.getEarnWithdrawStatus({
          organizationId: subOrgId,
          withdrawRequestId,
        });
      return { status, txHash: withdrawTxHash, error };
    });

    const received = await waitForIncrease(
      client,
      subOrgId,
      c.earnEvm,
      vault,
      before,
    );
    withdrawn.push({ asset: vault, amount: received });
    remaining -= units(received, vault.decimals);
  }

  // Swap anything that isn't the return asset into it.
  const ret = lists.returnAsset;
  let toReturn = 0n;
  for (const { asset, amount } of withdrawn) {
    if (amount <= 0n) continue;
    if (sameAsset(asset.caip19, ret.caip19)) {
      toReturn += amount;
      continue;
    }
    console.log(
      `\n🔁 Swapping ${asset.symbol} on ${chainName(asset.caip2)} back to ${ret.symbol} on ${chainName(ret.caip2)}`,
    );
    const result = await swap(client, c, asset, ret, amount, SLIPPAGE_BPS);
    if (result.kind === "completed") {
      toReturn += result.outputAmount;
    } else if (result.kind === "pending") {
      console.log(
        `   still pending; once it settles, run \`pnpm redeem\` again to send the rest`,
      );
    } else {
      console.log(
        `   swap failed: ${result.reason}. The funds stay in the Earn wallet.`,
      );
    }
  }

  if (toReturn > 0n) {
    console.log(
      `\n↩️  Sending ${units(toReturn, ret.decimals)} ${ret.symbol} on ${chainName(ret.caip2)} to the deposit wallet…`,
    );
    const txHash = await sendEvm(
      client,
      subOrgId,
      c.earnEvm,
      ret,
      c.depositEvm,
      toReturn,
    );
    console.log(
      `✅ Returned ${usd(units(toReturn, ret.decimals))} to ${c.depositEvm}\n   ${txLink(ret.caip2, txHash)}`,
    );
  }

  console.log();
  await printPositions(client, subOrgId, c.earnEvm, "after redeem");
}

async function balanceOf(
  client: TurnkeyApiClient,
  organizationId: string,
  address: string,
  asset: Asset,
): Promise<bigint> {
  const [h] = await holdings(
    client,
    organizationId,
    address,
    asset.caip2 as Caip2,
    [asset],
  );
  return h ? BigInt(h.balance.balance!) : 0n;
}

// The Balances API can trail the chain by a few seconds after a withdrawal.
async function waitForIncrease(
  client: TurnkeyApiClient,
  organizationId: string,
  address: string,
  asset: Asset,
  before: bigint,
): Promise<bigint> {
  for (let i = 0; i < 20; i += 1) {
    const now = await balanceOf(client, organizationId, address, asset);
    if (now > before) return now - before;
    await sleep(3_000);
  }
  console.log(
    `   the withdrawal hasn't shown in the balance yet; not returning it this run`,
  );
  return 0n;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

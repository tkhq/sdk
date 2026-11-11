import { C, chainName, DELEGATED_TAG, header } from "./common";
import { MAX_SLIPPAGE_BPS, SLIPPAGE_BPS } from "./config";
import {
  type Asset,
  bestVault,
  type EarnCaip2,
  errorMessage,
  isPolicyDenial,
  openCustomer,
  sendEvm,
} from "./delegated";

// Signed by the platform's delegated key: tries things the policies must deny,
// plus requests they must allow. Only the policy engine's own denial counts as
// "denied", so a request that failed for another reason can't pass by accident.
// Every attempt is tiny (one base unit) or a quote, which moves nothing.

const ELSEWHERE = "0x000000000000000000000000000000000000dEaD";
const WETH_BASE =
  "eip155:8453/erc20:0x4200000000000000000000000000000000000006";

type Outcome = "allowed" | "denied" | "error";
type Check = { label: string; expect: Outcome; run: () => Promise<unknown> };

async function main() {
  header("Validate the delegated user's policies", DELEGATED_TAG);
  const {
    client,
    subOrgId,
    customer: c,
    lists,
  } = await openCustomer("DELEGATED");

  const ret = lists.returnAsset;
  // Another stablecoin on the return asset's chain (e.g. USDT on Base), so the
  // swap checks have a valid pair to quote.
  const other = lists.inputs.find(
    (a) => a.caip2 === ret.caip2 && a.caip19 !== ret.caip19,
  );
  const solanaInputs = lists.inputs.filter((a) =>
    a.caip2.startsWith("solana:"),
  );
  const sol = solanaInputs.find((a) => a.symbol === "USDC") ?? solanaInputs[0];
  const target = bestVault(lists.targets);

  // A 1-unit quote from `signWith`; nothing executes.
  const quote =
    (
      signWith: string,
      from: Asset | string,
      to: Asset | string,
      extra: { slippageBps?: string; destinationAddress?: string } = {},
    ) =>
    () =>
      client.createSwapQuote({
        organizationId: subOrgId,
        signWith,
        inputToken: typeof from === "string" ? from : from.caip19,
        outputToken: typeof to === "string" ? to : to.caip19,
        inputAmount: "1000000",
        slippageBps: SLIPPAGE_BPS,
        ...extra,
      });
  const tooMuchSlippage = String(MAX_SLIPPAGE_BPS + 400);

  const checks: (Check | false | undefined)[] = [
    {
      label: "Send from the deposit wallet (the platform has no rights there)",
      expect: "denied",
      run: () => sendEvm(client, subOrgId, c.depositEvm, ret, c.earnEvm, 1n),
    },
    {
      label: "Swap into a non-stablecoin (USDC → WETH on Base)",
      expect: "denied",
      run: quote(c.earnEvm, ret, WETH_BASE),
    },
    other && {
      label: `Swap above the slippage cap (${other.symbol} → ${ret.symbol}, ${tooMuchSlippage} bps)`,
      expect: "denied",
      run: quote(c.earnEvm, other, ret, { slippageBps: tooMuchSlippage }),
    },
    other && {
      label: `Swap quote signed from the deposit wallet (${other.symbol} → ${ret.symbol})`,
      expect: "denied",
      run: quote(c.depositEvm, other, ret),
    },
    sol &&
      target && {
        label: "Solana → EVM swap to an address that isn't the Earn wallet",
        expect: "denied",
        run: quote(c.earnSol, sol, target, { destinationAddress: ELSEWHERE }),
      },
    target && {
      label: `Earn deposit into ${target.name}, signed from the deposit wallet`,
      expect: "denied",
      run: () =>
        client.earnDeposit({
          organizationId: subOrgId,
          wrapperAddress: target.wrapperAddress,
          signWith: c.depositEvm,
          assets: "1",
          caip2: target.caip2 as EarnCaip2,
          sponsor: true,
        }),
    },
    {
      label:
        "Send from the Earn wallet to an address other than the deposit wallet",
      expect: "denied",
      run: () => sendEvm(client, subOrgId, c.earnEvm, ret, ELSEWHERE, 1n),
    },
    // Controls: requests the policies must allow. Without them, a denial above
    // could just mean a policy reads a field that doesn't exist.
    other && {
      label: `Control: swap quote ${other.symbol} → ${ret.symbol} on ${chainName(ret.caip2)}, from the Earn wallet`,
      expect: "allowed",
      run: quote(c.earnEvm, other, ret),
    },
    sol &&
      target && {
        label: `Control: Solana ${sol.symbol} → ${target.symbol} on ${chainName(target.caip2)}, to the Earn wallet`,
        expect: "allowed",
        run: quote(c.earnSol, sol, target, { destinationAddress: c.earnEvm }),
      },
  ];

  let failures = 0;
  for (const check of checks.filter((x): x is Check => !!x)) {
    let outcome: Outcome = "allowed";
    let detail = "";
    try {
      await check.run();
    } catch (error) {
      outcome = isPolicyDenial(error) ? "denied" : "error";
      detail = errorMessage(error);
    }
    // A control that passed the policy but failed later (e.g. no balance for a
    // quote) still shows the policy allowed it.
    const ok =
      outcome === check.expect ||
      (check.expect === "allowed" && outcome === "error");
    if (!ok) failures += 1;
    const mark = ok ? `${C.green}✓${C.reset}` : `${C.red}✗${C.reset}`;
    console.log(
      `${mark} ${check.label}: ${outcome}${ok ? "" : ` (expected ${check.expect})`}`,
    );
    if (detail) console.log(`    ${C.dim}${detail.slice(0, 300)}${C.reset}`);
  }

  console.log(
    failures === 0
      ? `\n✅ All checks match the policies.`
      : `\n${C.red}${failures} check(s) did not match.${C.reset}`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

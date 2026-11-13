import {
  C,
  chainName,
  DELEGATED_TAG,
  header,
  isSolana,
  printPositions,
  usd,
} from "./common";
import { INPUT_CHAINS } from "./config";
import { errorMessage, holdings, openCustomer } from "./delegated";

// Read-only: shows the customer's sub-org, its wallet addresses, the
// stablecoin balances in each wallet, and the Earn positions. Nothing is
// signed except read requests.
async function main() {
  header("Customer status", DELEGATED_TAG);
  const {
    client,
    subOrgId,
    customer: c,
    lists: { inputs },
  } = await openCustomer("DELEGATED");

  console.log(`🏢 Customer sub-org  ${subOrgId}`);
  console.log(`📬 Deposit wallet    EVM     ${c.depositEvm}`);
  console.log(`                     Solana  ${c.depositSol}`);
  console.log(`💼 Earn wallet       EVM     ${c.earnEvm}`);
  console.log(`                     Solana  ${c.earnSol}`);

  for (const [label, evm, sol] of [
    ["Deposit wallet", c.depositEvm, c.depositSol],
    ["Earn wallet", c.earnEvm, c.earnSol],
  ] as const) {
    console.log(`\n💰 ${label} stablecoins:`);
    let total = 0;
    let any = false;
    for (const caip2 of INPUT_CHAINS) {
      const address = isSolana(caip2) ? sol : evm;
      try {
        const found = await holdings(client, subOrgId, address, caip2, inputs);
        for (const h of found) {
          any = true;
          total += h.usd;
          console.log(
            `   ${usd(h.usd).padStart(10)}  ${h.asset.symbol} on ${chainName(h.asset.caip2)}`,
          );
        }
      } catch (error) {
        console.log(
          `${C.dim}   ${chainName(caip2)}: balance read failed (${errorMessage(error)})${C.reset}`,
        );
      }
    }
    console.log(
      any
        ? `   ${C.bold}${usd(total).padStart(10)}  total${C.reset}`
        : "   (none)",
    );
  }

  console.log();
  await printPositions(client, subOrgId, c.earnEvm, "in Earn");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

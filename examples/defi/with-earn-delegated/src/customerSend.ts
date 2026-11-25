import {
  ask,
  chainName,
  chainSlug,
  header,
  isSolana,
  toRaw,
  txLink,
  USER_TAG,
} from "./common";
import type { Caip2 } from "./config";
import { holdings, openCustomer, sendEvm, sendSolana } from "./delegated";

// Signed by the customer's own root key: moves a stablecoin out of the deposit
// wallet. By default it goes to the Earn wallet, which is the customer putting
// funds to work. Given a `to`, it's also how the customer pays out.
//
// Usage: pnpm customer-send [amount] [asset] [to]
//   asset is SYMBOL-chain, e.g. USDC-base, USDT0-arbitrum, USDC-solana
async function main() {
  const [argAmount, argAsset, argTo] = process.argv.slice(2);

  header("Customer send", USER_TAG);
  const {
    client,
    subOrgId,
    customer: c,
    lists: { inputs },
  } = await openCustomer("CUSTOMER");

  const spec = (argAsset ?? (await ask("Asset (SYMBOL-chain)", "USDC-base")))
    .trim()
    .toLowerCase();
  const asset = inputs.find(
    (a) => `${a.symbol}-${chainSlug(a.caip2)}`.toLowerCase() === spec,
  );
  if (!asset) {
    throw new Error(
      `"${spec}" isn't a supported asset. Options: ${inputs.map((a) => `${a.symbol}-${chainSlug(a.caip2)}`).join(", ")}`,
    );
  }

  const solana = isSolana(asset.caip19);
  const from = solana ? c.depositSol : c.depositEvm;
  const to = argTo ?? (solana ? c.earnSol : c.earnEvm);
  const amountText = argAmount ?? (await ask(`Amount (${asset.symbol})`, "1"));
  const amount = toRaw(amountText, asset.decimals);

  const [held] = (
    await holdings(client, subOrgId, from, asset.caip2 as Caip2, [asset])
  ).filter((h) => h.asset.caip19 === asset.caip19);
  const available = held ? BigInt(held.balance.balance!) : 0n;
  if (amount <= 0n || amount > available) {
    throw new Error(
      `amount must be more than 0 and at most the deposit wallet's ${Number(available) / 10 ** asset.decimals} ${asset.symbol} on ${chainName(asset.caip2)}`,
    );
  }

  const destination =
    to === c.earnEvm || to === c.earnSol ? "the Earn wallet" : to;
  console.log(
    `💸 Sending ${amountText} ${asset.symbol} on ${chainName(asset.caip2)} from the deposit wallet to ${destination} (gas sponsored)…`,
  );

  const txHash = solana
    ? await sendSolana(
        client,
        subOrgId,
        from,
        asset,
        held?.balance.tokenProgram,
        to,
        amount,
      )
    : await sendEvm(client, subOrgId, from, asset, to, amount);

  console.log(`✅ Sent\n   ${txLink(asset.caip2, txHash)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

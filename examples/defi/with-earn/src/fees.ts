import {
  C,
  header,
  newClient,
  PARENT_TAG,
  pollEarnStatus,
  resolveWrapper,
  usd,
} from "./common";

// Client revenue view: your client fee accrues on-chain (to the fee splitter on
// EVM, inside the Kamino vault on Solana) and `list_earn_enabled_vaults`
// reports what is claimable right now to the parent org. Pass "claim" to
// release it to CLIENT_FEE_WALLET with the claim_earn_fees activity.
// Usage: pnpm fees [claim]
async function main() {
  const claim = process.argv[2]?.toLowerCase() === "claim";
  const { client, organizationId } = newClient("PARENT");

  header("Fee accrual (client revenue)", PARENT_TAG);

  const vault = await resolveWrapper(client, organizationId);

  console.log(`💸 Wrapper ${vault.wrapperAddress}`);
  console.log(
    `   client fee:        ${Number(vault.clientFeeBps) / 100}% of yield`,
  );
  console.log(`   client fee wallet: ${vault.clientFeeWallet ?? "?"}`);
  console.log(`   claimable now:     ${usd(vault.claimableClientFee)}`);

  if (!claim) {
    console.log(`\n${C.dim}Run \`pnpm fees claim\` to release it.${C.reset}`);
    return;
  }

  if (!vault.claimableClientFee || BigInt(vault.claimableClientFee) === 0n) {
    console.log("\nNothing to claim yet.");
    return;
  }

  // On Solana the fee wallet must already hold a token account for the vault's
  // mint; the claim never creates one.
  console.log(`\n🏦 Claiming ${usd(vault.claimableClientFee)}…`);

  const { claimRequestId } = await client.claimEarnFees({
    organizationId,
    wrapperAddress: vault.wrapperAddress!,
  });

  await pollEarnStatus("fee claim", async () => {
    const { status, claimTxHash, error } = await client.getClaimEarnFeesStatus({
      organizationId,
      claimRequestId,
    });
    return { status, txHash: claimTxHash, error };
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

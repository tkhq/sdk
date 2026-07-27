import {
  ask,
  CHAIN_CAIP2,
  header,
  newClient,
  pollEarnStatus,
  requireEnv,
  resolveWrapper,
  usd,
  usdcToRaw,
  USER_TAG,
} from "./common";

// Step 6: withdraw USDC back to the end-user wallet (partial or full).
async function main() {
  const { client, organizationId } = newClient("TURNKEY");
  const signWith = requireEnv("SIGN_WITH");
  const sponsor = process.env.SPONSOR === "true";

  header("Withdraw", USER_TAG);

  const vault = await resolveWrapper(client, organizationId);
  const amount =
    process.argv[2] ?? (await ask("Withdraw amount (USDC)", "0.50"));
  const amountValue = usdcToRaw(amount);

  console.log(`\n🏧 Withdrawing ${usd(amountValue)} back to ${signWith}…`);

  const { withdrawRequestId } = await client.earnWithdraw({
    organizationId,
    wrapperAddress: vault.wrapperAddress!,
    signWith,
    amountValue,
    chainCaip2: CHAIN_CAIP2,
    sponsor,
  });

  await pollEarnStatus("withdraw", async () => {
    const { status, withdrawTxHash, error } = await client.earnWithdrawStatus({
      organizationId,
      withdrawRequestId,
    });
    return { status, txHash: withdrawTxHash, error };
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

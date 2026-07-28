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

// Step 6: withdraw USDC back to the end-user wallet. Pass a USDC amount for a
// partial withdraw, or "MAX" to redeem the full balance and close the position.
async function main() {
  const { client, organizationId } = newClient("TURNKEY");
  const signWith = requireEnv("SIGN_WITH");
  const sponsor = process.env.SPONSOR === "true";

  header("Withdraw", USER_TAG);

  const vault = await resolveWrapper(client, organizationId);
  const amount =
    process.argv[2] ?? (await ask('Withdraw amount (USDC, or "MAX")', "0.50"));

  // "MAX" is a backend sentinel for a full exit: it redeems the wallet's entire
  // share balance and closes the position, so it must be passed through verbatim.
  const isMax = amount.trim().toUpperCase() === "MAX";
  const amountValue = isMax ? "MAX" : usdcToRaw(amount);

  console.log(
    `\n🏧 Withdrawing ${isMax ? "the full balance" : usd(amountValue)} back to ${signWith}…`,
  );

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

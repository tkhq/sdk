import { createActivityPoller } from "@turnkey/http";
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

// Step 4: deposit USDC from the end-user wallet into the enabled vault.
async function main() {
  const { client, organizationId } = newClient("TURNKEY");
  const signWith = requireEnv("SIGN_WITH");
  const sponsor = process.env.SPONSOR === "true";

  header("Deposit", USER_TAG);

  const vault = await resolveWrapper(client, organizationId);
  const amount =
    process.argv[2] ?? (await ask("Deposit amount (USDC)", "1.00"));
  const assets = usdcToRaw(amount);

  console.log(`\n💰 Depositing ${usd(assets)} from ${signWith} (gas sponsored: ${sponsor})…`);

  const activityPoller = createActivityPoller({
    client,
    requestFn: client.earnDeposit,
  });
  const activity = await activityPoller({
    type: "ACTIVITY_TYPE_EARN_DEPOSIT",
    timestampMs: String(Date.now()),
    organizationId,
    parameters: {
      wrapperAddress: vault.wrapperAddress!,
      signWith,
      assets,
      chainCaip2: CHAIN_CAIP2,
      sponsor,
    },
  });

  const result = activity.result.earnDepositResult;
  if (!result) {
    throw new Error(`deposit activity ${activity.id} completed without a result`);
  }

  await pollEarnStatus("deposit", async () => {
    const { status, depositTxHash, error } = await client.earnDepositStatus({
      organizationId,
      depositRequestId: result.depositRequestId,
    });
    return { status, txHash: depositTxHash, error };
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

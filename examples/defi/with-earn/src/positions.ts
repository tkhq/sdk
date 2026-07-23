import { header, newClient, printPositions, requireEnv, USER_TAG } from "./common";

// Steps 5 and 7: the end user's position — current value, deposits,
// withdrawals, and accrued yield, in USD.
async function main() {
  const { client, organizationId } = newClient("TURNKEY");
  const signWith = requireEnv("SIGN_WITH");

  header("End-user position", USER_TAG);
  await printPositions(client, organizationId, signWith, "now");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

import { getSuiClient, resolveAddress } from "./shared";

const SUI_COIN_TYPE = "0x2::sui::SUI";
const MIST_PER_SUI = 1_000_000_000n;

/**
 * Format a MIST amount as a human-readable SUI string with 9 decimals.
 */
function formatSui(mist: bigint): string {
  const whole = mist / MIST_PER_SUI;
  const fraction = mist % MIST_PER_SUI;
  const fractionStr = fraction.toString().padStart(9, "0").replace(/0+$/, "");
  return fractionStr.length > 0 ? `${whole}.${fractionStr}` : `${whole}`;
}

async function main() {
  // Address from CLI arg or SUI_ADDRESS env var.
  const address = resolveAddress(process.argv[2]);
  const provider = getSuiClient();

  // Node-provider read: `provider.getBalance` calls `suix_getBalance`.
  const balance = await provider.getBalance({
    owner: address,
    coinType: SUI_COIN_TYPE,
  });

  const totalMist = BigInt(balance.totalBalance);

  console.log(`Address: ${address}`);
  console.log(`Coin type: ${balance.coinType}`);
  console.log(`Coin object count: ${balance.coinObjectCount}`);
  console.log(`Balance (MIST): ${totalMist.toString()}`);
  console.log(`Balance (SUI):  ${formatSui(totalMist)}`);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});

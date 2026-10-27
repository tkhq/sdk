import * as dotenv from "dotenv";
import * as path from "path";

import { energyProviderFromEnv } from "./providers";
import { availableEnergy, initTronWeb, initTurnkey } from "./util";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

// Rent energy for any (activated) address through the configured provider,
// watch the delegation land on-chain, then settle the rental.

const ENERGY_AMOUNT = Number(process.env.ENERGY_AMOUNT ?? 66_000);
const DURATION_SEC = Number(process.env.RENT_DURATION_SEC ?? 3600);

async function main() {
  const tronWeb = initTronWeb();
  const provider = energyProviderFromEnv(tronWeb, initTurnkey());
  const receiver = process.env.USER_ADDRESS!;

  const before = await availableEnergy(tronWeb, receiver);
  const rental = await provider.rent(receiver, ENERGY_AMOUNT, DURATION_SEC);
  console.log(
    `Rented via ${rental.provider}, est. cost ${rental.costSun / 1_000_000} TRX`,
  );

  const deadline = Date.now() + 60_000;
  while ((await availableEnergy(tronWeb, receiver)) < before + ENERGY_AMOUNT) {
    if (Date.now() > deadline)
      throw new Error("delegation not visible in time");
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  console.log(
    `Delegation landed: ${receiver} now has ${await availableEnergy(tronWeb, receiver)} energy`,
  );

  // Settle immediately for demo purposes (JustLend deposit recovery; no-op
  // for marketplace rentals).
  await rental.release();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

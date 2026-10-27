import * as dotenv from "dotenv";
import * as path from "path";

import { tronSaveFromEnv } from "./tronsave";
import { availableEnergy, initTronWeb } from "./util";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

// Rent energy for any (activated) address and watch the delegation land.

const ENERGY_AMOUNT = Number(process.env.ENERGY_AMOUNT ?? 66_000);
const DURATION_SEC = Number(process.env.RENT_DURATION_SEC ?? 3600);
const MAX_PRICE_SUN = Number(process.env.MAX_PRICE_SUN ?? 150);

async function main() {
  const tronSave = tronSaveFromEnv();
  const tronWeb = initTronWeb();
  const receiver = process.env.USER_ADDRESS!;

  console.log("Prepaid balance:", await tronSave.getBalanceSun(), "SUN");

  const quote = await tronSave.estimate(receiver, ENERGY_AMOUNT, DURATION_SEC);
  console.log(
    `Quote: ${quote.unitPriceSun} sun/energy, ~${quote.costSun / 1_000_000} TRX total, ` +
      `${quote.availableResource} energy fillable now`,
  );

  const before = await availableEnergy(tronWeb, receiver);
  const order = await tronSave.rentEnergy(
    receiver,
    ENERGY_AMOUNT,
    DURATION_SEC,
    MAX_PRICE_SUN,
  );
  console.log(`Order ${order.orderId} placed at ${order.unitPriceSun} sun/energy`);

  const deadline = Date.now() + 60_000;
  while ((await availableEnergy(tronWeb, receiver)) < before + ENERGY_AMOUNT) {
    if (Date.now() > deadline) throw new Error("delegation not visible in time");
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  console.log(
    `Delegation landed: ${receiver} now has ${await availableEnergy(tronWeb, receiver)} energy`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

import * as dotenv from "dotenv";
import * as path from "path";

import { energyProviderFromEnv } from "./providers";
import {
  availableEnergy,
  initTronWeb,
  initTurnkey,
  numberFromEnv,
} from "./util";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

// Rent energy for an activated address, watch the delegation land, settle.

const ENERGY_AMOUNT = numberFromEnv("ENERGY_AMOUNT", 66_000);
const DURATION_SEC = numberFromEnv("RENT_DURATION_SEC", 3600);

async function main() {
  const tronWeb = initTronWeb();
  const provider = energyProviderFromEnv(tronWeb, initTurnkey());
  const receiver = process.env.USER_ADDRESS!;

  const before = await availableEnergy(tronWeb, receiver);
  const rental = await provider.rent(receiver, ENERGY_AMOUNT, DURATION_SEC);

  try {
    console.log(
      `Rented via ${rental.provider}, est. cost ${rental.costSun / 1_000_000} TRX`,
    );

    const deadline = Date.now() + 60_000;
    while (
      (await availableEnergy(tronWeb, receiver)) <
      before + ENERGY_AMOUNT
    ) {
      if (Date.now() > deadline) {
        throw new Error("delegation not visible in time");
      }
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
    console.log(
      `Delegation landed: ${receiver} now has ${await availableEnergy(tronWeb, receiver)} energy`,
    );
  } finally {
    try {
      await rental.release();
    } catch (releaseError) {
      console.error(
        `WARNING: rental for ${receiver} was not settled. An on-chain deposit may ` +
          `still be outstanding, and is forfeited if left past expiry.`,
        releaseError,
      );
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

import * as dotenv from "dotenv";
import * as path from "path";

import { energyProviderFromEnv } from "./providers";
import type { EnergyRental } from "./providers";
import {
  availableBandwidth,
  availableEnergy,
  broadcast,
  explorerTxUrl,
  initTronWeb,
  initTurnkey,
  signTronTransaction,
  waitForConfirmation,
} from "./util";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

// A fee-sponsored TRC-20 transfer: the sending wallet holds the token and zero
// TRX, and rides a rented energy delegation plus its free daily bandwidth.

const ENERGY_MARGIN = 1.05;
// Past a day, TronSave bills per started day — see the README on pricing.
const RENT_DURATION_SEC = 3600;
const FEE_LIMIT_SUN = 20_000_000;
const TRANSFER_BANDWIDTH = 345;

type ConstantContractResult = {
  result?: { result?: boolean; message?: string };
  energy_used?: number;
};

async function main() {
  const turnkeyClient = initTurnkey();
  const tronWeb = initTronWeb();
  const provider = energyProviderFromEnv(tronWeb, turnkeyClient);

  const user = process.env.USER_ADDRESS!;
  const recipient = process.env.RECIPIENT_ADDRESS!;
  const token =
    process.env.TOKEN_ADDRESS ?? "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
  const amount = process.env.TOKEN_AMOUNT ?? "1000000";

  const transferParams = [
    { type: "address", value: recipient },
    { type: "uint256", value: amount },
  ];

  // A recipient holding no tokens writes a fresh storage slot and costs about
  // twice the energy; the live estimate covers both cases.
  const estimate = (await tronWeb.transactionBuilder.triggerConstantContract(
    token,
    "transfer(address,uint256)",
    {},
    transferParams,
    user,
  )) as ConstantContractResult;
  if (!estimate?.result?.result) {
    throw new Error(
      `energy estimate failed: ${estimate?.result?.message ?? "unknown"}`,
    );
  }
  if (typeof estimate.energy_used !== "number") {
    throw new Error("energy estimate returned no energy_used");
  }
  const energyNeeded = Math.ceil(estimate.energy_used * ENERGY_MARGIN);
  console.log(`Transfer needs ~${energyNeeded} energy`);

  // Bandwidth is never delegated, so check it before paying for energy.
  const bandwidth = await availableBandwidth(tronWeb, user);
  if (bandwidth < TRANSFER_BANDWIDTH) {
    throw new Error(
      `${user} has ${bandwidth} bandwidth but needs ~${TRANSFER_BANDWIDTH}. The free ` +
        `600/day allowance covers about one transfer, and a wallet with no TRX cannot ` +
        `burn the shortfall: delegate bandwidth to it, or leave it a little TRX.`,
    );
  }

  const deficit = energyNeeded - (await availableEnergy(tronWeb, user));
  let rental: EnergyRental | null = null;
  try {
    if (deficit > 0) {
      rental = await provider.rent(user, deficit, RENT_DURATION_SEC);
      // An accepted order is not a delegation: wait for it on-chain.
      const deadline = Date.now() + 60_000;
      while ((await availableEnergy(tronWeb, user)) < energyNeeded) {
        if (Date.now() > deadline) {
          throw new Error("delegation not visible in time");
        }
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    } else {
      console.log("User already has enough energy; skipping rental");
    }

    // feeLimit caps a call's energy at min(available, feeLimit / energyPrice),
    // so too small a limit silently disables the delegated energy.
    const wrapper = await tronWeb.transactionBuilder.triggerSmartContract(
      token,
      "transfer(address,uint256)",
      { feeLimit: FEE_LIMIT_SUN },
      transferParams,
      user,
    );
    if (!wrapper.result.result) {
      throw new Error(
        `failed to build transfer: ${JSON.stringify(wrapper.result)}`,
      );
    }
    const signedTransfer = await signTronTransaction(
      turnkeyClient,
      user,
      wrapper.transaction,
    );
    const transferTxid = await broadcast(tronWeb, signedTransfer);
    console.log("Sponsored TRC-20 transfer sent:", transferTxid);
    await waitForConfirmation(tronWeb, transferTxid);
    console.log(explorerTxUrl(transferTxid));
  } finally {
    if (rental) {
      try {
        await rental.release();
      } catch (releaseError) {
        // Never let this replace the error that brought us here.
        console.error(
          `WARNING: rental for ${user} was not settled. An on-chain deposit may ` +
            `still be outstanding, and is forfeited if left past expiry.`,
          releaseError,
        );
      }
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

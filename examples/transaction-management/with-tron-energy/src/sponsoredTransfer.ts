import * as dotenv from "dotenv";
import * as path from "path";

import { energyProviderFromEnv } from "./providers";
import {
  availableEnergy,
  broadcast,
  initTronWeb,
  initTurnkey,
  signTronTransaction,
  waitForConfirmation,
} from "./util";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

// A fee-sponsored TRC-20 transfer: the user wallet holds the token and ZERO
// TRX. Energy arrives as a delegation from the configured provider (TronSave
// marketplace or JustLend on-chain), the user signs its own transfer via
// Turnkey riding on that energy plus the account's free daily bandwidth, and
// the rental is settled afterwards. No TRX is ever burned from the user
// wallet.

// If the recipient's token balance is zero the transfer writes a fresh
// storage slot and costs roughly twice the energy — the live estimate below
// handles both cases; this is only the safety margin on top of it.
const ENERGY_MARGIN = 1.05;
const RENT_DURATION_SEC = 3600; // shortest useful block; we broadcast right away
const FEE_LIMIT_SUN = 20_000_000; // 20 TRX backstop; see README

async function main() {
  const turnkeyClient = initTurnkey();
  const tronWeb = initTronWeb();
  const provider = energyProviderFromEnv(tronWeb, turnkeyClient);

  const user = process.env.USER_ADDRESS!;
  const recipient = process.env.RECIPIENT_ADDRESS!;
  const token =
    process.env.TOKEN_ADDRESS ?? "TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf"; // USDT on Nile
  const amount = process.env.TOKEN_AMOUNT ?? "1000000";

  const transferParams = [
    { type: "address", value: recipient },
    { type: "uint256", value: amount },
  ];

  // 1. Estimate the transfer's energy with a constant (free, unsigned) call.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const estimate = (await tronWeb.transactionBuilder.triggerConstantContract(
    token,
    "transfer(address,uint256)",
    {},
    transferParams,
    user,
  )) as any;
  if (!estimate?.result?.result) {
    throw new Error(
      `energy estimate failed: ${estimate?.result?.message ?? "unknown"}`,
    );
  }
  const energyNeeded = Math.ceil((estimate.energy_used ?? 0) * ENERGY_MARGIN);
  console.log(`Transfer needs ~${energyNeeded} energy`);

  // 2. Rent the shortfall via the configured provider, then — regardless of
  // what the provider reported — verify the energy is actually visible on the
  // account before broadcasting. Never trust the order of events.
  const deficit = energyNeeded - (await availableEnergy(tronWeb, user));
  let rental = null;
  if (deficit > 0) {
    rental = await provider.rent(user, deficit, RENT_DURATION_SEC);
    const deadline = Date.now() + 60_000;
    while ((await availableEnergy(tronWeb, user)) < energyNeeded) {
      if (Date.now() > deadline)
        throw new Error("delegation not visible in time");
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  } else {
    console.log("User already has enough energy; skipping rental");
  }

  try {
    // 3. The user signs and broadcasts its own transfer. The feeLimit must
    // still cover the energy cost: the node caps a call's energy at
    // min(available, feeLimit / energyPrice), so a tiny feeLimit would
    // silently disable the delegated energy. With enough delegated energy, no
    // TRX is burned and the user wallet needs none.
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
    console.log("https://nile.tronscan.org/#/transaction/" + transferTxid);
  } finally {
    // 4. Settle the rental whether or not the transfer succeeded: a no-op for
    // marketplace delegations that expire on their own, deposit recovery for
    // JustLend.
    await rental?.release();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

import type { Turnkey } from "@turnkey/sdk-server";
import type { TronWeb } from "tronweb";

import {
  broadcast,
  energyToDelegatableSun,
  signTronTransaction,
  waitForConfirmation,
} from "../util";
import type { EnergyProvider, EnergyRental } from "./types";

// JustLend DAO's EnergyRental contract — the on-chain alternative to
// marketplace APIs: no API key, no prepaid account, no off-chain counterparty.
// A sponsor wallet calls rentResource() with a TRX prepay and the contract
// delegates energy to the receiver; returnResource() settles it. That second
// transaction plus the prepay float is the price of having no off-chain
// dependency, which is why this belongs in the fallback tier.
//
// Prepay has three documented components
// (https://docs.justlend.org/getting_started/concepts/energy_rental/):
//
//   Energy Fee         = amount x unit price x duration
//   Security Deposit   = amount x daily price  (i.e. one day's energy fee)
//   Liquidation Penalty = max(delegated TRX x 0.008%, 20 TRX)
//
// Only part of that is a real cost. The penalty and any unused energy fee are
// refunded on return, but 0.75 days of the security deposit is deducted once
// the rented energy has actually been consumed — the normal case here — so the
// net cost is the energy fee plus that deduction. An order left past expiry is
// liquidated and the penalty is forfeited to the liquidator.
//
// MAINNET ONLY: no public testnet deployment is known. Rentals are priced from
// the live on-chain _rentalRate, a per-SUN-per-second rate scaled by 1e18. The
// receiver must be an activated, non-contract address.

const JUSTLEND_ENERGY_RENTAL_MAINNET = "TU2MJ5Veik1LRAgjeSzEdvmDYx7mefJZvd";
const RESOURCE_TYPE_ENERGY = 1;
const SECONDS_PER_DAY = 86_400;
const MAX_DURATION_SEC = 30 * SECONDS_PER_DAY;
const LIQUIDATION_PENALTY_RATE = 0.00008; // 0.008% of delegated TRX
const LIQUIDATION_PENALTY_MIN_SUN = 20_000_000; // 20 TRX

export class JustLendEnergyRental implements EnergyProvider {
  readonly name = "justlend";

  constructor(
    private readonly tronWeb: TronWeb,
    private readonly turnkeyClient: Turnkey,
    /** Turnkey-held wallet that pays the prepay and signs rent/return. */
    private readonly sponsor: string,
    private readonly contract: string = JUSTLEND_ENERGY_RENTAL_MAINNET,
  ) {}

  async rent(
    receiver: string,
    energy: number,
    durationSec: number,
  ): Promise<EnergyRental> {
    if (durationSec > MAX_DURATION_SEC) {
      throw new Error(
        `JustLend rentals are capped at 30 days; got ${durationSec}s`,
      );
    }
    // The contract denominates rentals in delegated stake (SUN), not energy.
    const trxSun = await energyToDelegatableSun(
      this.tronWeb,
      energy,
      this.sponsor,
    );

    // _rentalRate returns the current per-second rate, scaled by 1e18.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rateResult =
      (await this.tronWeb.transactionBuilder.triggerConstantContract(
        this.contract,
        "_rentalRate(uint256,uint256)",
        {},
        [
          { type: "uint256", value: String(trxSun) },
          { type: "uint256", value: String(RESOURCE_TYPE_ENERGY) },
        ],
        this.sponsor,
      )) as any;
    const rateHex = rateResult?.constant_result?.[0];
    if (!rateResult?.result?.result || !rateHex) {
      throw new Error("JustLend _rentalRate read failed");
    }
    const rate = BigInt(`0x${rateHex}`);
    const feeForSeconds = (seconds: number) =>
      (BigInt(trxSun) * rate * BigInt(seconds)) / 10n ** 18n;

    const energyFeeSun = feeForSeconds(durationSec);
    const securityDepositSun = feeForSeconds(SECONDS_PER_DAY);
    const liquidationPenaltySun = BigInt(
      Math.max(
        LIQUIDATION_PENALTY_MIN_SUN,
        Math.ceil(trxSun * LIQUIDATION_PENALTY_RATE),
      ),
    );
    const prepaySun = Number(
      energyFeeSun + securityDepositSun + liquidationPenaltySun,
    );
    // What the rental actually costs once refunds settle, as distinct from the
    // prepay that has to be funded up front.
    const netCostSun = Number(energyFeeSun + (securityDepositSun * 3n) / 4n);

    // Reclaims the penalty and the unconsumed prepay. Not optional: an order
    // left past expiry is liquidated.
    const release = async () => {
      const returnTxid = await this.trigger(
        "returnResource(address,uint256,uint256)",
        receiver,
        trxSun,
        0,
      );
      console.log(`[justlend] returned delegation: ${returnTxid}`);
    };

    let txid: string;
    try {
      txid = await this.trigger(
        "rentResource(address,uint256,uint256)",
        receiver,
        trxSun,
        prepaySun,
      );
    } catch (rentError) {
      // The rental may have executed even though this call failed to confirm,
      // in which case the prepay is already committed on-chain. Attempt to
      // return it rather than leave it to be liquidated; a return that reverts
      // because nothing was rented is the harmless case.
      await release().catch(() => {});
      throw rentError;
    }

    console.log(
      `[justlend] rented ${trxSun / 1_000_000} TRX of stake for ${receiver}: ` +
        `prepay ${prepaySun / 1_000_000} TRX, net cost after refunds ` +
        `~${netCostSun / 1_000_000} TRX: ${txid}`,
    );

    return { provider: this.name, costSun: netCostSun, release };
  }

  private async trigger(
    selector: string,
    receiver: string,
    trxSun: number,
    callValueSun: number,
  ): Promise<string> {
    const wrapper = await this.tronWeb.transactionBuilder.triggerSmartContract(
      this.contract,
      selector,
      { callValue: callValueSun, feeLimit: 100_000_000 },
      [
        { type: "address", value: receiver },
        { type: "uint256", value: String(trxSun) },
        { type: "uint256", value: String(RESOURCE_TYPE_ENERGY) },
      ],
      this.sponsor,
    );
    if (!wrapper.result.result) {
      throw new Error(
        `JustLend ${selector} build failed: ${JSON.stringify(wrapper.result)}`,
      );
    }
    const signed = await signTronTransaction(
      this.turnkeyClient,
      this.sponsor,
      wrapper.transaction,
    );
    const txid = await broadcast(this.tronWeb, signed);
    await waitForConfirmation(this.tronWeb, txid);
    return txid;
  }
}

import type { Turnkey } from "@turnkey/sdk-server";
import type { TronWeb } from "tronweb";

import {
  broadcast,
  energyToDelegatableSun,
  signTronTransaction,
  waitForConfirmation,
} from "../util";
import type { EnergyProvider, EnergyRental } from "./types";

// JustLend DAO's EnergyRental contract: the on-chain alternative to a
// marketplace API — no API key, no prepaid account, no off-chain counterparty.
// A sponsor calls rentResource() with a TRX prepay and the contract delegates
// energy to the receiver until returnResource() settles it. The rental is
// open-ended — the contract is never told a duration, so `durationSec` only
// sizes the prepay.
//
// Prepay must cover the rent plus a liquidation penalty, per
// https://docs.justlend.org/getting_started/concepts/energy_rental/:
//
//   rent    = amount x _rentalRate x seconds
//   penalty = max(minFee(), amount x feeRatio() / 1e18)
//
// One day of rent is the contract's own floor; funding less reverts with
// "resource rent: Not enough security deposit". The penalty and any unused
// rent are refunded on return, but 0.75 days is kept once the energy has been
// consumed — the normal case here — so that is the real cost. Leaving an order
// past expiry forfeits the penalty to a liquidator.
//
// The receiver must be an activated, non-contract address.

const ENERGY_RENTAL_MAINNET = "TU2MJ5Veik1LRAgjeSzEdvmDYx7mefJZvd";
const ENERGY_RENTAL_NILE = "TSos1xxjqMrGKBxycVmtgrnFvv9M6FDFUX";
const RESOURCE_TYPE_ENERGY = 1;
const SECONDS_PER_DAY = 86_400;
const MAX_DURATION_SEC = 30 * SECONDS_PER_DAY;
const MIN_BILLED_SEC = (SECONDS_PER_DAY * 3) / 4;

function defaultContract(): string {
  return (process.env.TRON_FULL_HOST ?? "").includes("nile")
    ? ENERGY_RENTAL_NILE
    : ENERGY_RENTAL_MAINNET;
}

const max = (a: bigint, b: bigint) => (a > b ? a : b);

export class JustLendEnergyRental implements EnergyProvider {
  readonly name = "justlend";

  constructor(
    private readonly tronWeb: TronWeb,
    private readonly turnkeyClient: Turnkey,
    /** Turnkey-held wallet that pays the prepay and signs rent/return. */
    private readonly sponsor: string,
    private readonly contract: string = defaultContract(),
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

    // Penalty parameters are per-network contract state, not constants.
    const [rate, minFeeSun, feeRatio] = await Promise.all([
      this.readUint("_rentalRate(uint256,uint256)", [
        { type: "uint256", value: String(trxSun) },
        { type: "uint256", value: String(RESOURCE_TYPE_ENERGY) },
      ]),
      this.readUint("minFee()", []),
      this.readUint("feeRatio()", []),
    ]);

    const rentFor = (seconds: number) =>
      (BigInt(trxSun) * rate * BigInt(Math.ceil(seconds))) / 10n ** 18n;
    const penaltySun = max(minFeeSun, (BigInt(trxSun) * feeRatio) / 10n ** 18n);

    const prepaySun = Number(
      rentFor(Math.max(durationSec, SECONDS_PER_DAY)) + penaltySun,
    );
    const netCostSun = Number(rentFor(Math.max(durationSec, MIN_BILLED_SEC)));

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
      // The rental may have executed even though this call never confirmed, so
      // try to return it rather than leave the prepay to be liquidated. A
      // revert here means nothing was rented, which is the harmless case.
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

  private async readUint(
    selector: string,
    params: { type: string; value: string }[],
  ): Promise<bigint> {
    const result =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (await this.tronWeb.transactionBuilder.triggerConstantContract(
        this.contract,
        selector,
        {},
        params,
        this.sponsor,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      )) as any;
    const hex = result?.constant_result?.[0];
    if (!result?.result?.result || !hex) {
      throw new Error(`JustLend ${selector} read failed`);
    }
    return BigInt(`0x${hex}`);
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

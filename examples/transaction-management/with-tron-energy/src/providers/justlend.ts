import type { Turnkey } from "@turnkey/sdk-server";
import type { TronWeb } from "tronweb";

import {
  broadcast,
  energyToDelegatableSun,
  signTronTransaction,
  waitForConfirmation,
} from "../util";
import type { EnergyProvider, EnergyRental } from "./types";

// JustLend DAO's EnergyRental contract (https://justlend.org) — the on-chain
// alternative to marketplace APIs: no API key, no prepaid account, no
// off-chain counterparty. A sponsor wallet calls rentResource() with a TRX
// prepay (occupation fee + a refundable security deposit, min 40 TRX) and the
// contract delegates energy to the receiver. The deposit comes back when
// returnResource() is called — skip it past expiry and the order can be
// liquidated, forfeiting the deposit. That second transaction plus the
// deposit float is the price of having no off-chain dependency; for short
// rentals JustLend is typically several times costlier than a marketplace,
// which is why it belongs in the fallback tier, not the primary one.
//
// MAINNET ONLY: no public testnet deployment is known. Rentals are priced
// from the live on-chain _rentalRate; prepay overestimates are refunded
// proportionally on return, so the margin below errs high on purpose.
// Constraints: the receiver must be an activated, non-contract address.

const JUSTLEND_ENERGY_RENTAL_MAINNET = "TU2MJ5Veik1LRAgjeSzEdvmDYx7mefJZvd";
const RESOURCE_TYPE_ENERGY = 1;
const SECURITY_DEPOSIT_MIN_SUN = 40_000_000; // 40 TRX
const SECURITY_DEPOSIT_RATE = 0.05;
// Prepay must cover the rental duration plus the protocol's settlement
// buffer; one extra day on top is refunded pro-rata, so err high.
const PREPAY_BUFFER_SEC = 2 * 86_400;

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

    const occupationSun =
      (BigInt(trxSun) * rate * BigInt(durationSec + PREPAY_BUFFER_SEC)) /
      10n ** 18n;
    const depositSun = BigInt(
      Math.max(
        SECURITY_DEPOSIT_MIN_SUN,
        Math.ceil(trxSun * SECURITY_DEPOSIT_RATE),
      ),
    );
    const prepaySun = Number(occupationSun + depositSun);

    const txid = await this.trigger(
      "rentResource(address,uint256,uint256)",
      receiver,
      trxSun,
      prepaySun,
    );
    console.log(
      `[justlend] rented ${trxSun / 1_000_000} TRX of energy for ${receiver} ` +
        `(prepay ~${prepaySun / 1_000_000} TRX, deposit refunds on return): ${txid}`,
    );

    return {
      provider: this.name,
      costSun: prepaySun,
      // Reclaims the unused prepay and the security deposit. Not optional:
      // orders left past expiry can be liquidated.
      release: async () => {
        const returnTxid = await this.trigger(
          "returnResource(address,uint256,uint256)",
          receiver,
          trxSun,
          0,
        );
        console.log(
          `[justlend] returned delegation, deposit reclaimed: ${returnTxid}`,
        );
      },
    };
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

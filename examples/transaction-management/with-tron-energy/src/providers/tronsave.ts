// Minimal TronSave client (https://docs.tronsave.io). TronSave rents staked
// energy as a short-lived on-chain delegation to any address. Orders are paid
// from a prepaid internal account tied to the API key — top it up by sending
// TRX to the deposit address shown by GET /user-info — so a rental is a
// single HTTP call with no on-chain payment leg. Delegations expire on their
// own; there is nothing to undelegate, so release() is a no-op.

import { numberFromEnv } from "../util";
import type { EnergyProvider, EnergyRental } from "./types";

export interface TronSaveEstimate {
  /** Market price in SUN per unit of energy. */
  unitPriceSun: number;
  /** Estimated total cost in SUN. */
  costSun: number;
  /** Energy the market can delegate instantly right now. */
  availableResource: number;
}

interface Envelope<T> {
  error: boolean;
  message?: string;
  data?: T;
}

// Wire shapes below use TronSave's own field names; everything this module
// returns is renamed to carry its unit, so `estimateTrx` stops being load
// bearing past this boundary.

interface EstimateBuyResourceResponse {
  /** Market unit price, in SUN per unit of energy. */
  unitPrice: number;
  /** Total order cost, in SUN — not TRX, despite the name. */
  estimateTrx: number;
  /** Energy the market can delegate instantly right now. */
  availableResource: number;
}

interface UserInfoResponse {
  /** Internal prepaid account balance, in SUN. */
  balance: string;
}

export class TronSave implements EnergyProvider {
  readonly name = "tronsave";

  constructor(
    private readonly apiKey: string,
    /** Refuse rentals above this unit price, in SUN per energy. */
    private readonly maxPriceSun: number = 150,
    // Mainnet API. The dev API (https://api-dev.tronsave.io/v2) delegates on
    // the Nile testnet instead.
    private readonly baseUrl: string = "https://api.tronsave.io/v2",
  ) {}

  async rent(
    receiver: string,
    energy: number,
    durationSec: number,
  ): Promise<EnergyRental> {
    const order = await this.placeOrder(
      receiver,
      energy,
      durationSec,
      this.maxPriceSun,
    );
    console.log(
      `[tronsave] order ${order.orderId} filled at ${order.unitPriceSun} sun/energy ` +
        `(~${order.costSun / 1_000_000} TRX)`,
    );
    // The delegation expires on its own — nothing to settle.
    return {
      provider: this.name,
      costSun: order.costSun,
      release: async () => {},
    };
  }

  async estimate(
    receiver: string,
    energyAmount: number,
    durationSec: number,
  ): Promise<TronSaveEstimate> {
    const data = await this.request<EstimateBuyResourceResponse>(
      "/estimate-buy-resource",
      {
        method: "POST",
        body: {
          resourceType: "ENERGY",
          receiver,
          resourceAmount: energyAmount,
          durationSec,
          unitPrice: "MEDIUM",
        },
      },
    );
    return {
      unitPriceSun: data.unitPrice,
      costSun: Math.ceil(data.estimateTrx),
      availableResource: data.availableResource,
    };
  }

  /**
   * Buy the delegation. `maxPriceSun` caps the accepted market price, and the
   * order settings make it fill-or-fail: a sweep-style caller broadcasts
   * right after the delegation lands, so a partial or deferred fill is
   * useless.
   */
  async placeOrder(
    receiver: string,
    energyAmount: number,
    durationSec: number,
    maxPriceSun: number,
  ): Promise<{ orderId: string; unitPriceSun: number; costSun: number }> {
    const quote = await this.estimate(receiver, energyAmount, durationSec);
    if (quote.unitPriceSun > maxPriceSun) {
      throw new Error(
        `TronSave price ${quote.unitPriceSun} sun/energy exceeds the ${maxPriceSun} sun cap`,
      );
    }
    if (quote.availableResource < energyAmount) {
      throw new Error(
        `TronSave market can only fill ${quote.availableResource}/${energyAmount} energy right now`,
      );
    }
    const balanceSun = await this.getBalanceSun();
    if (balanceSun < BigInt(quote.costSun)) {
      throw new Error(
        `TronSave prepaid balance is ${Number(balanceSun) / 1_000_000} TRX, ` +
          `below the ${quote.costSun / 1_000_000} TRX this order needs — top up the ` +
          `deposit address from GET /user-info`,
      );
    }
    const data = await this.request<{ orderId: string }>("/buy-resource", {
      method: "POST",
      apiKey: true,
      body: {
        resourceType: "ENERGY",
        receiver,
        resourceAmount: energyAmount,
        durationSec,
        unitPrice: "MEDIUM",
        options: {
          allowPartialFill: false,
          onlyCreateWhenFulfilled: true,
          preventDuplicateIncompleteOrders: true,
          maxPriceAccepted: maxPriceSun,
        },
      },
    });
    return {
      orderId: data.orderId,
      unitPriceSun: quote.unitPriceSun,
      costSun: quote.costSun,
    };
  }

  /** Prepaid internal-account balance, in SUN. */
  async getBalanceSun(): Promise<bigint> {
    const data = await this.request<UserInfoResponse>("/user-info", {
      method: "GET",
      apiKey: true,
    });
    return BigInt(data.balance);
  }

  private async request<T>(
    path: string,
    init: { method: "GET" | "POST"; body?: unknown; apiKey?: boolean },
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: init.method,
      headers: {
        "Content-Type": "application/json",
        ...(init.apiKey ? { apikey: this.apiKey } : {}),
      },
      ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
      signal: AbortSignal.timeout(15_000),
    });
    let json: Envelope<T> | undefined;
    try {
      json = (await response.json()) as Envelope<T>;
    } catch {
      // fall through to the status-based error below
    }
    if (!response.ok || !json || json.error || json.data === undefined) {
      throw new Error(
        `TronSave ${path} failed (${response.status}): ${json?.message ?? "no response body"}`,
      );
    }
    return json.data;
  }
}

export function tronSaveFromEnv(): TronSave {
  const apiKey = process.env.TRONSAVE_API_KEY;
  if (!apiKey) throw new Error("TRONSAVE_API_KEY is not set");
  return new TronSave(
    apiKey,
    numberFromEnv("MAX_PRICE_SUN", 150),
    process.env.TRONSAVE_API_BASE_URL || undefined,
  );
}

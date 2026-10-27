// Minimal TronSave client (https://docs.tronsave.io). TronSave rents staked
// energy as a short-lived on-chain delegation to any address. Orders are paid
// from a prepaid internal account tied to the API key — top it up by sending
// TRX to the deposit address shown by GET /user-info — so a rental is a
// single HTTP call with no on-chain payment leg. Delegations expire on their
// own; there is nothing to undelegate.

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

export class TronSave {
  constructor(
    private readonly apiKey: string,
    // The dev API delegates on the Nile testnet.
    private readonly baseUrl: string = "https://api-dev.tronsave.io/v2",
  ) {}

  async estimate(
    receiver: string,
    energyAmount: number,
    durationSec: number,
  ): Promise<TronSaveEstimate> {
    const data = await this.request<{
      unitPrice: number;
      estimateTrx: number;
      availableResource: number;
    }>("/estimate-buy-resource", {
      method: "POST",
      body: {
        resourceType: "ENERGY",
        receiver,
        resourceAmount: energyAmount,
        durationSec,
        unitPrice: "MEDIUM",
      },
    });
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
  async rentEnergy(
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
    const data = await this.request<{ balance: string }>("/user-info", {
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
  return new TronSave(apiKey, process.env.TRONSAVE_API_BASE_URL || undefined);
}

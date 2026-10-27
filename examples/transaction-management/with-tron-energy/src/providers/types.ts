// A source of delegated Tron energy. Implementations differ in where the
// energy comes from (a rental marketplace, an on-chain protocol, your own
// stake) but expose the same two-step contract: rent, then release.

export interface EnergyRental {
  provider: string;
  /** Estimated total cost in SUN (marketplace fee or on-chain prepay). */
  costSun: number;
  /**
   * Settle the rental after the sponsored transaction confirms. For
   * marketplace rentals that expire on their own this is a no-op; for
   * JustLend it submits returnResource to reclaim the refundable deposit
   * (skipping it eventually forfeits the deposit to liquidation).
   */
  release(): Promise<void>;
}

export interface EnergyProvider {
  readonly name: string;
  /**
   * Acquire `energy` for `receiver` for roughly `durationSec`. Resolves once
   * the order/transaction is accepted — callers must still verify the
   * delegation is visible on the receiver via getAccountResources before
   * broadcasting anything that depends on it.
   */
  rent(
    receiver: string,
    energy: number,
    durationSec: number,
  ): Promise<EnergyRental>;
}

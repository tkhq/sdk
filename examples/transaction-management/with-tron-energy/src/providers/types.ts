export interface EnergyRental {
  provider: string;
  /** Expected net cost in SUN, after any refund the provider owes back. */
  costSun: number;
  /** No-op where the delegation expires on its own; on-chain settlement otherwise. */
  release(): Promise<void>;
}

export interface EnergyProvider {
  readonly name: string;
  /**
   * Acquire `energy` for `receiver`. Resolves once the order is accepted —
   * callers must still confirm the delegation is visible on the receiver
   * before broadcasting anything that depends on it.
   */
  rent(
    receiver: string,
    energy: number,
    durationSec: number,
  ): Promise<EnergyRental>;
}

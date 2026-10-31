import type { Turnkey } from "@turnkey/sdk-server";
import type { TronWeb } from "tronweb";

import { JustLendEnergyRental } from "./justlend";
import { tronSaveFromEnv } from "./tronsave";
import type { EnergyProvider } from "./types";

export type { EnergyProvider, EnergyRental } from "./types";
export { TronSave, tronSaveFromEnv } from "./tronsave";
export { JustLendEnergyRental } from "./justlend";

/** Resolve the provider named by ENERGY_PROVIDER (default: tronsave). */
export function energyProviderFromEnv(
  tronWeb: TronWeb,
  turnkeyClient: Turnkey,
): EnergyProvider {
  const name = (process.env.ENERGY_PROVIDER ?? "tronsave").toLowerCase();
  if (name === "tronsave") return tronSaveFromEnv();
  if (name === "justlend") {
    const sponsor = process.env.SPONSOR_ADDRESS;
    if (!sponsor) {
      throw new Error("ENERGY_PROVIDER=justlend requires SPONSOR_ADDRESS");
    }
    return new JustLendEnergyRental(
      tronWeb,
      turnkeyClient,
      sponsor,
      process.env.JUSTLEND_CONTRACT_ADDRESS || undefined,
    );
  }
  throw new Error(
    `Unknown ENERGY_PROVIDER '${name}' (supported: tronsave, justlend)`,
  );
}

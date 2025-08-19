import { WebWalletManager } from "./web/manager";
import { isReactNative, isWeb } from "@utils";
import type { TWalletManagerConfig, WalletManagerBase } from "@types";
import { MobileWalletManager } from "./mobile/manager";

/**
 * Creates and initializes a wallet manager instance based on the runtime environment.
 *
 * - If the environment is React Native, it creates and initializes a `MobileWalletManager`.
 * - If the environment is Web, it creates and initializes a `WebWalletManager`.
 * - Throws an error if the environment is neither supported.
 *
 * @param cfg - Configuration object used to initialize the wallet manager.
 * @returns A promise that resolves to an initialized `WalletManagerBase` instance.
 * @throws {Error} If the environment is not supported (neither React Native nor Web).
 */
export async function createWalletManager(
  cfg: TWalletManagerConfig,
): Promise<WalletManagerBase> {
  if (isReactNative()) {
    const manager = new MobileWalletManager(cfg);
    await manager.init(cfg);
    return manager;
  } else if (isWeb()) {
    const manager = new WebWalletManager(cfg);
    await manager.init(cfg);
    return manager;
  } else {
    throw new Error("Unsupported environment for wallet manager");
  }
}

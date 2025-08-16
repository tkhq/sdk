import { WebWalletManager } from "./web/manager";
import { isReactNative, isWeb } from "@utils";
import type { TWalletManagerConfig, WalletManagerBase } from "@types";
import { MobileWalletManager } from "./mobile/manager";

export async function createWalletManager(
  cfg: TWalletManagerConfig,
): Promise<WalletManagerBase> {
  if (isReactNative()) {
    const manager = new MobileWalletManager(cfg);
    await manager.init(cfg);
    return manager;
  } else if (isWeb()) {
    console.log("config: ", cfg);
    const manager = new WebWalletManager(cfg);
    await manager.init(cfg);
    return manager;
  } else {
    throw new Error("Unsupported environment for wallet manager.");
  }
}

import { WebWalletManager } from "./web/manager";
import { isReactNative, isWeb } from "@utils";
import type { TWalletManagerConfig, WalletManagerBase } from "@types";

export async function createWalletManager(
  cfg: TWalletManagerConfig,
): Promise<WalletManagerBase> {
  if (isReactNative()) {
    try {
      // const { MobileWalletManager } = await import("../mobile/base");
      // return new MobileWalletManager(cfg);
      throw new Error(
        "WalletManager is not yet implemented for React Native. Please use WebWalletManager.",
      );
    } catch (error) {
      throw new Error(
        `Failed to load wallet manager for react-native: ${error}`,
      );
    }
  } else if (isWeb()) {
    const manager = new WebWalletManager(cfg);
    await manager.init(cfg);
    return manager;
  } else {
    throw new Error("Unsupported environment for wallet manager.");
  }
}

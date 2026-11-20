import type { WalletProvider } from "@turnkey/core";
import { useTurnkey } from "../../../providers/client/Hook";

/** @internal */
export const canDisconnect = (
  provider: WalletProvider,
  shouldShowDisconnect?: boolean,
) => {
  return (
    shouldShowDisconnect &&
    provider.connectedAddresses &&
    provider.connectedAddresses.length > 0
  );
};

/**
 * Returns the wallet auth action of the auth modal. With `callbacks.onWalletConnected` set,
 * it connects the wallet and hands it over to the host instead of logging in through the SDK.
 * @internal
 */
export const useWalletAuthAction = (sessionKey?: string | undefined) => {
  const { loginOrSignupWithWallet, connectWalletAccount, callbacks } =
    useTurnkey();

  return async (provider: WalletProvider) => {
    if (callbacks?.onWalletConnected) {
      const account = await connectWalletAccount(provider);
      await callbacks.onWalletConnected({
        walletProvider: provider,
        account,
        ...(sessionKey && { sessionKey }),
      });
      return;
    }
    await loginOrSignupWithWallet({
      walletProvider: provider,
      ...(sessionKey && { sessionKey }),
    });
  };
};

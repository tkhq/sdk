import type { WalletProvider } from "@turnkey/core";

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

import { ActionButton } from "../../design/Buttons";
import { EthereumLogo, SolanaLogo } from "../../design/Svg";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronRight, faClose } from "@fortawesome/free-solid-svg-icons";
import { useEffect, useState } from "react";
import clsx from "clsx";
import type { WalletProvider } from "@turnkey/core";
import { isEthereumProvider, isSolanaProvider } from "@turnkey/core";
import { useModal } from "../../../providers/modal/Hook";
import { useTurnkey } from "../../../providers/client/Hook";
import { ConnectedIndicator } from "../../design/ConnectedIndicator";
import { canDisconnect } from "./utils";

interface ExternalWalletChainSelectorProps {
  providers: WalletProvider[];
  onDisconnect?: ((provider: WalletProvider) => Promise<void>) | undefined;
  onSelect: (provider: WalletProvider) => Promise<void>;
}
export function ExternalWalletChainSelector(
  props: ExternalWalletChainSelectorProps,
) {
  const { providers, onSelect, onDisconnect } = props;

  const { walletProviders } = useTurnkey();
  const { isMobile, popPage } = useModal();

  const [loadingProvider, setLoadingProvider] = useState<WalletProvider>();

  // we find matching providers in current state
  const currentProviders = providers
    .map((inputProvider) =>
      walletProviders.find(
        (p) =>
          p.interfaceType === inputProvider.interfaceType &&
          p.chainInfo.namespace === inputProvider.chainInfo.namespace,
      ),
    )
    .filter((p): p is WalletProvider => p !== undefined);

  // if no providers are found then that means that the user entered this screen
  // while WalletConnect was still initializing, and then it failed to initialize
  useEffect(() => {
    if (currentProviders.length === 0) {
      popPage();
    }
  }, [currentProviders.length, popPage]);

  const shouldShowDisconnect = onDisconnect !== undefined;

  const handleSelect = async (provider: WalletProvider) => {
    setLoadingProvider(provider);
    if (canDisconnect(provider, shouldShowDisconnect)) {
      await onDisconnect!(provider);
    } else {
      await onSelect(provider);
    }
    setLoadingProvider(undefined);
  };

  return (
    <div
      className={clsx(
        "flex flex-col w-72 gap-4 mt-11 items-center justify-center",
        isMobile ? "w-full" : "w-72",
      )}
    >
      <img src={providers[0]?.info.icon} className="size-14 rounded-full" />
      <span className="text-sm text-center text-icon-text-light dark:text-icon-text-dark">
        {providers[0]?.info.name ?? "This wallet provider"}
        {" supports multiple chains. Select which chain you would like to use."}
      </span>
      <div className="w-full flex flex-col gap-2">
        {providers.map((p) => {
          const [isHovering, setIsHovering] = useState(false);
          return (
            <ActionButton
              key={p.chainInfo.namespace}
              loading={loadingProvider === p}
              loadingText="Preparing..."
              onClick={() => handleSelect(p)}
              {...(!isMobile && {
                // This looks weird on mobile since there's no hover state
                onMouseEnter: () => setIsHovering(true),
                onMouseLeave: () => setIsHovering(false),
              })}
              className="relative overflow-hidden flex items-center justify-start gap-2 w-full text-inherit bg-button-light dark:bg-button-dark"
            >
              {isEthereumProvider(p) ? (
                <div className="relative">
                  <EthereumLogo className="size-5" />
                  {canDisconnect(p, shouldShowDisconnect) && (
                    <ConnectedIndicator isPinging />
                  )}
                </div>
              ) : isSolanaProvider(p) ? (
                <div className="relative">
                  <SolanaLogo className="size-5" />
                  {canDisconnect(p, shouldShowDisconnect) && (
                    <ConnectedIndicator isPinging />
                  )}
                </div>
              ) : (
                // we should never reach here
                // if we do then it means we forgot to update the auth component after adding a new chain
                <div className="relative">
                  <span className="size-5 flex items-center justify-center rounded bg-gray-300 dark:bg-gray-700">
                    ?
                  </span>
                </div>
              )}

              <div className="flex flex-col items-start">
                {isEthereumProvider(p)
                  ? "EVM"
                  : isSolanaProvider(p)
                    ? "Solana"
                    : // we should never reach here
                      // if we do then it means we forgot to update the auth component after adding a new chain
                      `?`}
                {canDisconnect(p, shouldShowDisconnect) && (
                  <span className="text-xs text-icon-text-light dark:text-icon-text-dark">
                    Connected: {p.connectedAddresses[0]?.slice(0, 4)}...
                    {p.connectedAddresses[0]?.slice(-3)}
                  </span>
                )}
              </div>

              <FontAwesomeIcon
                className={clsx(
                  `absolute transition-all duration-200`,
                  isHovering ? "right-4" : "-right-4",
                  canDisconnect(p, shouldShowDisconnect)
                    ? "text-danger-light dark:text-danger-dark"
                    : "text-icon-text-light dark:text-icon-text-dark",
                )}
                size={canDisconnect(p, shouldShowDisconnect) ? "lg" : "1x"}
                icon={
                  canDisconnect(p, shouldShowDisconnect)
                    ? faClose
                    : faChevronRight
                }
              />
            </ActionButton>
          );
        })}
      </div>
    </div>
  );
}

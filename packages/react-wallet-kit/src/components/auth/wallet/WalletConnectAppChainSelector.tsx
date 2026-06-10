import { ActionButton } from "../../design/Buttons";
import { EthereumLogo, SolanaLogo } from "../../design/Svg";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronRight } from "@fortawesome/free-solid-svg-icons";
import { useState } from "react";
import clsx from "clsx";
import { Chain, type WalletConnectAppEntry } from "@turnkey/core";
import { useModal } from "../../../providers/modal/Hook";

interface WalletConnectAppChainSelectorProps {
  apps: WalletConnectAppEntry[];
  onSelect: (app: WalletConnectAppEntry) => Promise<void>;
}

/**
 * A chain selector specifically for WalletConnect app entries.
 * Displays available chains for a wallet app and allows the user to select one.
 */
export function WalletConnectAppChainSelector(
  props: WalletConnectAppChainSelectorProps,
) {
  const { apps, onSelect } = props;
  const { isMobile } = useModal();
  const [loadingApp, setLoadingApp] = useState<WalletConnectAppEntry>();

  const handleSelect = async (app: WalletConnectAppEntry) => {
    setLoadingApp(app);
    try {
      await onSelect(app);
    } finally {
      setLoadingApp(undefined);
    }
  };

  const first = apps[0];

  return (
    <div
      className={clsx(
        "flex flex-col w-72 gap-4 mt-11 items-center justify-center",
        isMobile ? "w-full" : "w-72",
      )}
    >
      <img src={first?.icon} className="size-14 rounded-full" />
      <span className="text-sm text-center text-icon-text-light dark:text-icon-text-dark">
        {first?.name ?? "This wallet"}
        {" supports multiple chains. Select which chain you would like to use."}
      </span>
      <div className="w-full flex flex-col gap-2">
        {apps.map((app) => {
          const [isHovering, setIsHovering] = useState(false);
          const isEthereum = app.chain === Chain.Ethereum;
          const isSolana = app.chain === Chain.Solana;

          return (
            <ActionButton
              key={app.chain}
              loading={loadingApp === app}
              loadingText="Preparing..."
              onClick={() => handleSelect(app)}
              {...(!isMobile && {
                onMouseEnter: () => setIsHovering(true),
                onMouseLeave: () => setIsHovering(false),
              })}
              className="relative overflow-hidden flex items-center justify-start gap-2 w-full text-inherit bg-button-light dark:bg-button-dark"
            >
              {isEthereum ? (
                <EthereumLogo className="size-5" />
              ) : isSolana ? (
                <SolanaLogo className="size-5" />
              ) : (
                <span className="size-5 flex items-center justify-center rounded bg-gray-300 dark:bg-gray-700">
                  ?
                </span>
              )}

              <div className="flex flex-col items-start">
                {isEthereum ? "EVM" : isSolana ? "Solana" : "Unknown"}
              </div>

              <FontAwesomeIcon
                className={clsx(
                  "absolute transition-all duration-200 text-icon-text-light dark:text-icon-text-dark",
                  isHovering ? "right-4" : "-right-4",
                )}
                icon={faChevronRight}
              />
            </ActionButton>
          );
        })}
      </div>
    </div>
  );
}

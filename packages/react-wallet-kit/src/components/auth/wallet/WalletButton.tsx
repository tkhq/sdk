import { ActionButton } from "../../design/Buttons";
import { EthereumLogo, SolanaLogo } from "../../design/Svg";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronRight, faClose } from "@fortawesome/free-solid-svg-icons";
import { useState, ReactNode } from "react";
import clsx from "clsx";
import { ConnectedIndicator } from "../../design/ConnectedIndicator";
import type { Chain } from "@turnkey/core";

export const WALLET_BUTTON_HEIGHT = 56; // Height of each wallet button in pixels.

interface WalletButtonProps {
  icon: string | ReactNode;
  name: string;
  chains: Array<{
    namespace: Chain;
    isConnected: boolean;
  }>;
  onClick: () => void;
  shouldShowDisconnect?: boolean;
  isMobile?: boolean;
}

export function WalletButton(props: WalletButtonProps) {
  const {
    icon,
    name,
    chains,
    onClick,
    shouldShowDisconnect = false,
    isMobile = false,
  } = props;
  const [isHovering, setIsHovering] = useState(false);

  return (
    <ActionButton
      {...(!isMobile && {
        // This looks weird on mobile since there's no hover state
        onMouseEnter: () => setIsHovering(true),
        onMouseLeave: () => setIsHovering(false),
      })}
      onClick={onClick}
      style={{ height: `${WALLET_BUTTON_HEIGHT}px` }}
      className="relative flex items-center justify-between w-full text-inherit bg-button-light dark:bg-button-dark overflow-hidden"
    >
      <div className="flex items-center gap-2 overflow-hidden w-3/4 ">
        {typeof icon === "string" ? (
          <img
            src={icon}
            alt={name}
            className="size-6 rounded-full flex-shrink-0"
          />
        ) : (
          icon
        )}
        <span className="text-ellipsis whitespace-nowrap overflow-hidden">
          {name}
        </span>
      </div>
      <div className={clsx(`flex items-center transition-all gap-1`)}>
        {chains.map((c, idx) => {
          let Logo;
          if (c.namespace === "ethereum") {
            Logo = EthereumLogo;
          } else if (c.namespace === "solana") {
            Logo = SolanaLogo;
          } else {
            // we should never reach here
            // if we do then it means we forgot to update the auth component after adding a new chain
            throw new Error(
              `Unsupported provider namespace. Expected Ethereum or Solana.`,
            );
          }

          const delay = 50 + idx * 30; // Staggered delay: leftmost has largest
          return (
            <div
              key={c.namespace}
              style={{ transitionDelay: `${delay}ms` }}
              className={clsx(
                "relative",
                "size-4",
                "transition-all duration-200",
                isHovering ? "-translate-x-8" : "translate-x-0",
              )}
            >
              <Logo className="size-4" />
              {c.isConnected && <ConnectedIndicator isPinging={isHovering} />}
            </div>
          );
        })}
      </div>
      <FontAwesomeIcon
        className={clsx(
          `absolute transition-all duration-200`,
          isHovering ? "right-4" : "-right-4",
          chains.length === 1 && chains[0]!.isConnected && shouldShowDisconnect
            ? "text-danger-light dark:text-danger-dark"
            : "text-icon-text-light dark:text-icon-text-dark",
        )}
        size={
          chains.length === 1 && chains[0]!.isConnected && shouldShowDisconnect
            ? "lg"
            : "1x"
        }
        icon={
          chains.length === 1 && chains[0]!.isConnected && shouldShowDisconnect
            ? faClose
            : faChevronRight
        }
      />
    </ActionButton>
  );
}

import { WalletProvider, WalletType } from "@turnkey/wallet-stamper";
import { ActionButton } from "../design/Buttons";
import { useModal } from "../../providers";
import { EthereumLogo, SolanaLogo } from "../design/Svg";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronRight } from "@fortawesome/free-solid-svg-icons";
import { useEffect, useState } from "react";
import clsx from "clsx";

interface WalletAuthButtonProps {
  onContinue: () => void;
}
export function WalletAuthButton(props: WalletAuthButtonProps) {
  const { onContinue } = props;
  return (
    <div className="flex flex-col w-full">
      <ActionButton
        onClick={onContinue}
        className="w-full text-inherit bg-button-light dark:bg-button-dark"
      >
        Continue with wallet
      </ActionButton>
    </div>
  );
}

export function ExternalWalletChainSelector(
  props: ExternalWalletSelectorProps,
) {
  const { providers, onSelect } = props;

  return (
    <div className="flex flex-col w-72 gap-4 mt-11 items-center justify-center">
      <img src={providers[0]?.info.icon} className="size-14 rounded-full" />
      <span className="text-sm text-center text-icon-text-light dark:text-icon-text-dark">
        {providers[0]?.info.name ?? "This wallet provider"}
        {" supports multiple chains. Select which chain you would like to use."}
      </span>
      {providers.map((p) => (
        <ActionButton
          key={p.type}
          onClick={() => onSelect(p)}
          className="relative flex items-center justify-start gap-2 w-full text-inherit bg-button-light dark:bg-button-dark"
        >
          {p.type === "ethereum" ? (
            <EthereumLogo className="size-5" />
          ) : (
            <SolanaLogo className="size-5" />
          )}
          {p.type === "ethereum" ? "EVM" : "Solana"}
        </ActionButton>
      ))}
    </div>
  );
}

interface ExternalWalletSelectorProps {
  providers: WalletProvider[];
  onSelect: (provider: WalletProvider) => void;
}
export function ExternalWalletSelector(props: ExternalWalletSelectorProps) {
  const { providers, onSelect } = props;
  const { pushPage, popPage } = useModal();

  // Group providers by name
  const grouped = providers.reduce<Record<string, WalletProvider[]>>(
    (acc, provider) => {
      const name = provider.info.name;
      if (!acc[name]) acc[name] = [];
      acc[name].push(provider);
      return acc;
    },
    {},
  );
  const handleSelectGroup = (group: WalletProvider[]) => {
    if (group.length === 1) {
      onSelect(group[0]!);
    } else {
      pushPage({
        key: `Select chain`,
        content: (
          <ExternalWalletChainSelector providers={group} onSelect={onSelect} />
        ),
      });
    }
  };

  useEffect(() => {
    // Don't show the selector if there's only one wallet provider
    const groupedValues = Object.values(grouped);
    if (groupedValues.length === 1) {
      popPage(); // Remove this page from the stack so user doesn't get stuck in an infinite loop when pressing back
      handleSelectGroup(groupedValues[0]!);
    }
  }, [grouped]);

  return Object.keys(grouped).length === 0 ? (
    <div className="flex flex-col w-72 h-40 mt-4 gap-2 justify-center items-center text-xs text-center text-icon-text-light dark:text-icon-text-dark">
      <span className="text-sm font-medium">
        No wallet providers available.
      </span>
      <span>
        Only wallets supporting EIP-1193 (Ethereum) or the Solana wallet
        standard are supported.
      </span>
    </div>
  ) : (
    <div className="w-72 min-h-42 max-h-64 mt-12 overflow-y-auto tk-scrollbar p-0.5">
      <div className="flex flex-col gap-2">
        {Object.entries(grouped).map(
          ([name, group]: [string, WalletProvider[]]) => {
            const [isHovering, setIsHovering] = useState(false);
            const first = group[0];
            const chainTypes = group.map((p: WalletProvider) => p.type);

            return (
              <ActionButton
                key={name}
                onMouseEnter={() => setIsHovering(true)}
                onMouseLeave={() => setIsHovering(false)}
                onClick={() => handleSelectGroup(group)}
                className="relative flex items-center justify-between w-full text-inherit bg-button-light dark:bg-button-dark overflow-hidden"
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <img
                    src={first?.info.icon}
                    alt={first?.info.name}
                    className="size-6 rounded-full"
                  />
                  {first?.info.name}
                </div>
                <div className={clsx(`flex items-center transition-all gap-1`)}>
                  {chainTypes.includes(WalletType.Ethereum) && (
                    <EthereumLogo
                      className={clsx(
                        `size-4 transition-all delay-150 duration-200`,
                        isHovering ? "-translate-x-8" : "translate-x-0",
                      )}
                    />
                  )}
                  {chainTypes.includes(WalletType.Solana) && (
                    <SolanaLogo
                      className={clsx(
                        `size-4 transition-all delay-100 duration-200`,
                        isHovering ? "-translate-x-8" : "translate-x-0",
                      )}
                    />
                  )}
                </div>
                <FontAwesomeIcon
                  className={clsx(
                    `size-4 absolute text-icon-text-light dark:text-icon-text-dark transition-all duration-200`,
                    isHovering ? "right-4" : "-right-4",
                  )}
                  icon={faChevronRight}
                />
              </ActionButton>
            );
          },
        )}
      </div>
    </div>
  );
}

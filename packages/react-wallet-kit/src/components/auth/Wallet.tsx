import { WalletProvider, WalletType } from "@turnkey/wallet-stamper";
import { ActionButton } from "../design/Buttons";
import { useModal } from "../../providers/modal/Hook";
import { EthereumLogo, SolanaLogo } from "../design/Svg";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronRight, faClose } from "@fortawesome/free-solid-svg-icons";
import { useEffect, useState } from "react";
import clsx from "clsx";

interface WalletAuthButtonProps {
  onContinue: () => Promise<void>;
}
export function WalletAuthButton(props: WalletAuthButtonProps) {
  const { onContinue } = props;
  const [isLoading, setIsLoading] = useState(false);

  const handleContinue = async () => {
    setIsLoading(true);

    try {
      await Promise.resolve(onContinue());
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <div className="flex flex-col w-full">
      <ActionButton
        onClick={handleContinue}
        loading={isLoading}
        className="w-full text-inherit bg-button-light dark:bg-button-dark"
      >
        Continue with wallet
      </ActionButton>
    </div>
  );
}

const canUnlink = (provider: WalletProvider, shouldShowUnlink?: boolean) => {
  return (
    shouldShowUnlink &&
    provider.connectedAddresses &&
    provider.connectedAddresses.length > 0
  );
};

export function ExternalWalletChainSelector(
  props: ExternalWalletSelectorProps,
) {
  const { providers, onSelect, onUnlink } = props;
  const { isMobile } = useModal();
  const shouldShowUnlink = onUnlink !== undefined;

  const handleSelect = (provider: WalletProvider) => {
    if (canUnlink(provider, shouldShowUnlink)) {
      onUnlink!(provider);
    } else {
      onSelect(provider);
    }
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
              key={p.type}
              onClick={() => handleSelect(p)}
              onMouseEnter={() => setIsHovering(true)}
              onMouseLeave={() => setIsHovering(false)}
              className="relative overflow-hidden flex items-center justify-start gap-2 w-full text-inherit bg-button-light dark:bg-button-dark"
            >
              {p.type === "ethereum" ? (
                <div className="relative">
                  <EthereumLogo className="size-5" />
                  {canUnlink(p, shouldShowUnlink) && (
                    <ConnectedIndicator isPinging />
                  )}
                </div>
              ) : (
                <div className="relative">
                  <SolanaLogo className="size-5" />
                  {canUnlink(p, shouldShowUnlink) && (
                    <ConnectedIndicator isPinging />
                  )}
                </div>
              )}
              <div className="flex flex-col items-start">
                {p.type === "ethereum" ? "EVM" : "Solana"}
                {canUnlink(p, shouldShowUnlink) && (
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
                  canUnlink(p, shouldShowUnlink)
                    ? "text-danger-light dark:text-danger-dark"
                    : "text-icon-text-light dark:text-icon-text-dark",
                )}
                size={canUnlink(p, shouldShowUnlink) ? "lg" : "1x"}
                icon={canUnlink(p, shouldShowUnlink) ? faClose : faChevronRight}
              />
            </ActionButton>
          );
        })}
      </div>
    </div>
  );
}

interface ExternalWalletSelectorProps {
  providers: WalletProvider[];
  onUnlink?: ((provider: WalletProvider) => void) | undefined;
  onSelect: (provider: WalletProvider) => void;
}
export function ExternalWalletSelector(props: ExternalWalletSelectorProps) {
  const { providers, onUnlink, onSelect } = props;
  const { pushPage, popPage, isMobile } = useModal();

  const shouldShowUnlink = onUnlink !== undefined;

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
      if (canUnlink(group[0]!, shouldShowUnlink)) {
        onUnlink!(group[0]!);
      } else {
        onSelect(group[0]!);
      }
    } else {
      pushPage({
        key: `Select chain`,
        content: (
          <ExternalWalletChainSelector
            providers={group}
            onUnlink={onUnlink}
            onSelect={onSelect}
          />
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
    <div
      className={clsx(
        "flex flex-col h-40 mt-4 gap-2 justify-center items-center text-xs text-center text-icon-text-light dark:text-icon-text-dark",
        isMobile ? "w-full" : "w-72",
      )}
    >
      <span className="text-sm font-medium">
        No wallet providers available.
      </span>
      <span>
        Only wallets supporting EIP-1193 (Ethereum) or the Solana wallet
        standard are supported.
      </span>
    </div>
  ) : (
    <div
      className={clsx(
        "w-72 min-h-42 max-h-64 mt-12 overflow-y-auto tk-scrollbar p-0.5",
        isMobile ? "w-full" : "w-72",
      )}
    >
      <div className="flex flex-col gap-2">
        {Object.entries(grouped).map(
          ([name, group]: [string, WalletProvider[]]) => {
            const [isHovering, setIsHovering] = useState(false);
            const first = group[0];

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
                  {group.map((c, idx) => {
                    const Logo =
                      c.type === WalletType.Ethereum
                        ? EthereumLogo
                        : SolanaLogo;
                    const delay = 50 + idx * 30; // Staggered delay: leftmost has largest
                    return (
                      <div
                        key={c.type}
                        style={{ transitionDelay: `${delay}ms` }}
                        className={clsx(
                          "relative",
                          "size-4",
                          "transition-all duration-200",
                          isHovering ? "-translate-x-8" : "translate-x-0",
                        )}
                      >
                        <Logo className="size-4" />
                        {canUnlink(c, shouldShowUnlink) && (
                          <ConnectedIndicator isPinging={isHovering} />
                        )}
                      </div>
                    );
                  })}
                </div>
                <FontAwesomeIcon
                  className={clsx(
                    `absolute transition-all duration-200`,
                    isHovering ? "right-4" : "-right-4",
                    group.length === 1 && canUnlink(group[0]!, shouldShowUnlink)
                      ? "text-danger-light dark:text-danger-dark"
                      : "text-icon-text-light dark:text-icon-text-dark",
                  )}
                  size={
                    group.length === 1 && canUnlink(group[0]!, shouldShowUnlink)
                      ? "lg"
                      : "1x"
                  }
                  icon={
                    group.length === 1 && canUnlink(group[0]!, shouldShowUnlink)
                      ? faClose
                      : faChevronRight
                  }
                />
              </ActionButton>
            );
          },
        )}
      </div>
    </div>
  );
}

interface UnlinkWalletScreenProps {
  provider: WalletProvider;
  onUnlink: (provider: WalletProvider) => Promise<void>;
}

export function UnlinkWalletScreen(props: UnlinkWalletScreenProps) {
  const { provider, onUnlink } = props;
  const { isMobile } = useModal();
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);

  const handleUnlink = async () => {
    setIsLoading(true);
    setHasError(false);
    try {
      await onUnlink(provider);
    } catch {
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={clsx("mt-8", isMobile ? "w-full" : "w-96")}>
      <div className="mt-6 mb-5 flex flex-col items-center gap-3">
        <img src={provider.info.icon ?? ""} className="size-14 rounded-full" />
        <div
          className={clsx(
            "text-2xl font-bold text-center",
            hasError && "text-danger-light dark:text-danger-dark",
          )}
        >
          {hasError
            ? "You can't unlink this wallet!"
            : `Unlink ${provider.info.name}`}
        </div>
        <div className="text-icon-text-light dark:text-icon-text-dark text-center !p-0">
          {hasError
            ? `Try unlinking directly from the ${provider.info.name} app`
            : "You can always link this wallet again later."}
        </div>
      </div>

      <div className="flex my-2 mt-0">
        <ActionButton
          onClick={handleUnlink}
          loading={isLoading}
          className={clsx(
            "w-full max-w-md bg-danger-light dark:bg-danger-dark text-primary-text-light dark:text-primary-text-dark",
            hasError && "animate-shake opacity-50",
          )}
          spinnerClassName="text-primary-danger-text-light dark:text-primary-danger-text-dark"
        >
          Unlink Wallet
        </ActionButton>
      </div>
    </div>
  );
}

interface ConnectedIndicatorProps {
  isPinging?: boolean;
}
export function ConnectedIndicator(props: ConnectedIndicatorProps) {
  const { isPinging = false } = props;
  return (
    <div className="flex absolute top-[-2px] right-0">
      {isPinging && (
        <div className="absolute animate-ping size-[6px] bg-green-500 rounded-full border border-modal-background-light dark:border-modal-background-dark" />
      )}
      <div className="size-[6px] bg-green-500 rounded-full border border-modal-background-light dark:border-modal-background-dark" />
    </div>
  );
}

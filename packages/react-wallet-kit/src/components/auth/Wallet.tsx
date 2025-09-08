import { ActionButton } from "../design/Buttons";
import { useModal } from "../../providers/modal/Hook";
import { EthereumLogo, SolanaLogo } from "../design/Svg";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronRight,
  faClose,
  faLaptop,
  faMobileScreen,
} from "@fortawesome/free-solid-svg-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import type { WalletProvider } from "@turnkey/core";
import { QRCodeSVG as QRCode } from "qrcode.react";
import { SuccessPage } from "../design/Success";
import { isEthereumProvider, isSolanaProvider } from "@turnkey/core";
import { useTurnkey } from "../../providers/client/Hook";

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
        name="wallet-auth-button"
        onClick={handleContinue}
        loading={isLoading}
        className="w-full text-inherit bg-button-light dark:bg-button-dark"
      >
        Continue with wallet
      </ActionButton>
    </div>
  );
}

const canDisconnect = (
  provider: WalletProvider,
  shouldShowDisconnect?: boolean,
) => {
  return (
    shouldShowDisconnect &&
    provider.connectedAddresses &&
    provider.connectedAddresses.length > 0
  );
};

export function ExternalWalletChainSelector(
  props: ExternalWalletSelectorProps,
) {
  const { providers, onSelect, onDisconnect } = props;
  const { isMobile } = useModal();
  const shouldShowDisconnect = onDisconnect !== undefined;

  const handleSelect = (provider: WalletProvider) => {
    if (canDisconnect(provider, shouldShowDisconnect)) {
      onDisconnect!(provider);
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
              key={p.chainInfo.namespace}
              onClick={() => handleSelect(p)}
              onMouseEnter={() => setIsHovering(true)}
              onMouseLeave={() => setIsHovering(false)}
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

interface ExternalWalletSelectorProps {
  providers: WalletProvider[];
  onDisconnect?: ((provider: WalletProvider) => Promise<void>) | undefined;
  onSelect: (provider: WalletProvider) => Promise<void>;
}
export function ExternalWalletSelector(props: ExternalWalletSelectorProps) {
  const { providers, onDisconnect, onSelect } = props;
  const { pushPage, popPage, isMobile } = useModal();

  const shouldShowDisconnect = onDisconnect !== undefined;

  // Group providers by name
  const grouped = providers.reduce<Record<string, WalletProvider[]>>(
    (acc, provider) => {
      const name = provider.info.name;
      if (!acc[name]) acc[name] = [];
      acc[name]!.push(provider);
      return acc;
    },
    {},
  );

  const handleSelectGroup = (group: WalletProvider[]) => {
    if (group.length === 1) {
      if (canDisconnect(group[0]!, shouldShowDisconnect)) {
        onDisconnect!(group[0]!);
      } else {
        onSelect(group[0]!);
      }
    } else {
      pushPage({
        key: `Select chain`,
        content: (
          <ExternalWalletChainSelector
            providers={group}
            onDisconnect={onDisconnect}
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
                    let Logo;
                    if (isEthereumProvider(c)) {
                      Logo = EthereumLogo;
                    } else if (isSolanaProvider(c)) {
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
                        key={c.chainInfo.namespace}
                        style={{ transitionDelay: `${delay}ms` }}
                        className={clsx(
                          "relative",
                          "size-4",
                          "transition-all duration-200",
                          isHovering ? "-translate-x-8" : "translate-x-0",
                        )}
                      >
                        <Logo className="size-4" />
                        {canDisconnect(c, shouldShowDisconnect) && (
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
                    group.length === 1 &&
                      canDisconnect(group[0]!, shouldShowDisconnect)
                      ? "text-danger-light dark:text-danger-dark"
                      : "text-icon-text-light dark:text-icon-text-dark",
                  )}
                  size={
                    group.length === 1 &&
                    canDisconnect(group[0]!, shouldShowDisconnect)
                      ? "lg"
                      : "1x"
                  }
                  icon={
                    group.length === 1 &&
                    canDisconnect(group[0]!, shouldShowDisconnect)
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

interface DisconnectWalletScreenProps {
  provider: WalletProvider;
  onDisconnect: (provider: WalletProvider) => Promise<void>;
}

export function DisconnectWalletScreen(props: DisconnectWalletScreenProps) {
  const { provider, onDisconnect } = props;
  const { isMobile } = useModal();
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);

  const handleDisconnect = async () => {
    setIsLoading(true);
    setHasError(false);
    try {
      await onDisconnect(provider);
    } catch (err) {
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
            ? "You can't disconnect this wallet!"
            : `Disconnect ${provider.info.name}`}
        </div>
        <div className="text-icon-text-light dark:text-icon-text-dark text-center !p-0">
          {hasError
            ? `Try disconnecting directly from the ${provider.info.name} app`
            : "You can always connect this wallet again later."}
        </div>
      </div>

      <div className="flex my-2 mt-0">
        <ActionButton
          onClick={handleDisconnect}
          loading={isLoading}
          className={clsx(
            "w-full max-w-md bg-danger-light dark:bg-danger-dark text-primary-text-light dark:text-primary-text-dark",
            hasError && "animate-shake opacity-50",
          )}
          spinnerClassName="text-primary-danger-text-light dark:text-primary-danger-text-dark"
        >
          Disconnect Wallet
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
        <div className="absolute animate-ping size-[6px] bg-success-light dark:bg-success-dark rounded-full border border-modal-background-light dark:border-modal-background-dark" />
      )}
      <div className="size-[6px] bg-success-light dark:bg-success-dark rounded-full border border-modal-background-light dark:border-modal-background-dark" />
    </div>
  );
}
export interface WalletConnectScreenProps {
  provider: WalletProvider;
  successPageDuration: number | undefined;
  onAction: (provider: WalletProvider) => Promise<void>;
  onDisconnect?: (provider: WalletProvider) => Promise<void>;
}

export function WalletConnectScreen(props: WalletConnectScreenProps) {
  const { provider, successPageDuration, onAction, onDisconnect } = props;
  const { pushPage, closeModal, isMobile } = useModal();
  const { getWalletProviders } = useTurnkey();
  const hasRan = useRef(false);

  const [walletConnectProvider, setWalletConnectProvider] =
    useState<WalletProvider>();
  const connectedAccount = walletConnectProvider?.connectedAddresses[0];

  useEffect(() => {
    setWalletConnectProvider(provider);
  }, [provider]);

  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [disconnectError, setDisconnectError] = useState(false);

  // kick off authentication/pairing or signing on mount or when URI changes
  useMemo(() => {
    (async () => {
      if (hasRan.current) return;
      try {
        await onAction(walletConnectProvider ?? provider);
        hasRan.current = true;
        pushPage({
          key: "Connect Success",
          content: (
            <SuccessPage
              text="Successfully connected to WalletConnect!"
              onComplete={closeModal}
              duration={successPageDuration}
            />
          ),
          preventBack: true,
          showTitle: false,
        });
      } catch (e) {}
    })();
  }, [walletConnectProvider?.uri]);

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    setDisconnectError(false);
    try {
      await onDisconnect?.(walletConnectProvider ?? provider);
      const newProviders = await getWalletProviders();
      setWalletConnectProvider(
        newProviders.find((p) => p.interfaceType === provider.interfaceType),
      );
    } catch (err) {
      setDisconnectError(true);
    } finally {
      setIsDisconnecting(false);
    }
  };
  return (
    <div className="p-3 flex flex-col items-center">
      {connectedAccount ? (
        <div
          className={clsx(
            "mt-8 flex flex-col items-center gap-3",
            isMobile ? "w-full" : "w-96",
          )}
        >
          <div className="w-full justify-between flex items-center flex-1">
            <div
              className={clsx(
                "flex items-center justify-center bg-icon-background-light dark:bg-icon-background-dark rounded-full p-2 text-icon-text-light dark:text-icon-text-dark",
                isMobile ? "size-18" : "size-24",
              )}
            >
              <FontAwesomeIcon
                icon={faMobileScreen}
                size={isMobile ? "3x" : "4x"}
              />
            </div>

            <div className="flex flex-row items-center justify-center space-x-2.5 font-medium text-icon-text-light dark:text-icon-text-dark">
              <div className="flex items-center justify-center">
                <img
                  className="size-5"
                  src={walletConnectProvider.info.icon}
                  alt="Wallet connect logo"
                />
                <img
                  className="size-5 absolute animate-ping"
                  src={walletConnectProvider.info.icon}
                  alt="Wallet connect logo"
                />
              </div>

              <span>
                {connectedAccount?.slice(0, 3)}...
                {connectedAccount?.slice(-3)}
              </span>
            </div>

            <div
              className={clsx(
                "flex items-center justify-center bg-icon-background-light dark:bg-icon-background-dark rounded-full p-2 text-icon-text-light dark:text-icon-text-dark",
                isMobile ? "size-18" : "size-24",
              )}
            >
              <FontAwesomeIcon icon={faLaptop} size={isMobile ? "3x" : "4x"} />
            </div>
          </div>

          <div
            className={clsx(
              "flex flex-row items-center mt-5 text-2xl font-bold text-center",
            )}
          >
            Already connected
          </div>
          <div className="text-icon-text-light dark:text-icon-text-dark text-center text-xs flex flex-col space-y-2 !p-0">
            <span>
              Please open the wallet app on your phone to sign the message.
            </span>
            {isDisconnecting ? (
              <span className="text-danger-light dark:text-danger-dark opacity-50">
                Disconnecting...
              </span>
            ) : disconnectError ? (
              <span className="text-danger-light dark:text-danger-dark opacity-50">
                Error disconnecting wallet.
              </span>
            ) : (
              <span>
                Need to connect a different wallet?{" "}
                <span
                  className="text-danger-light dark:text-danger-dark cursor-pointer underline"
                  onClick={handleDisconnect}
                >
                  Disconnect
                </span>{" "}
                this wallet first.
              </span>
            )}
          </div>
        </div>
      ) : (
        <div
          className={clsx(
            "mt-8 flex flex-col items-center gap-3",
            isMobile ? "w-full" : "w-96",
          )}
        >
          {walletConnectProvider?.uri && (
            // @ts-expect-error: qrcode.react uses a different React type version
            <QRCode
              className="    
              border border-modal-background-dark/20 dark:border-modal-background-light/20
              shadow-[0_0_42px] shadow-primary-light/50
              dark:shadow-[0_0_42px] dark:shadow-primary-dark/50"
              value={walletConnectProvider.uri}
              imageSettings={{
                src: walletConnectProvider.info.icon ?? "",
                width: 24,
                height: 24,
                excavate: true,
              }}
              size={200}
            />
          )}
          <div className={clsx("text-2xl font-bold text-center")}>
            Use your phone
          </div>
          <div className="text-icon-text-light dark:text-icon-text-dark text-center !p-0">
            Scan this QR code with your WalletConnect-compatible wallet to
            connect
          </div>
        </div>
      )}
    </div>
  );
}

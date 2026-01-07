import { ActionButton, BaseButton } from "../design/Buttons";
import { EthereumLogo, SolanaLogo } from "../design/Svg";
import { Spinner } from "../design/Spinners";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowUpRightFromSquare,
  faCheck,
  faChevronRight,
  faClose,
  faCopy,
  faLaptop,
  faMobileScreen,
  faQrcode,
  faSearch,
} from "@fortawesome/free-solid-svg-icons";
import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import clsx from "clsx";
import type { WalletProvider } from "@turnkey/core";
import { QRCodeSVG as QRCode } from "qrcode.react";
import { SuccessPage } from "../design/Success";
import { isEthereumProvider, isSolanaProvider } from "@turnkey/core";
import { useModal } from "../../providers/modal/Hook";
import { useTurnkey } from "../../providers/client/Hook";
import {
  findWalletConnectProvider,
  isWalletConnect,
  useDebouncedCallback,
} from "../../utils/utils";
import { ActionPage } from "./Action";
import { Input } from "@headlessui/react";
import qrIcon from "../../assets/qr-icon.svg";

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
  shouldShowDisconnect?: boolean
) => {
  return (
    shouldShowDisconnect &&
    provider.connectedAddresses &&
    provider.connectedAddresses.length > 0
  );
};

interface ExternalWalletChainSelectorProps {
  providers: WalletProvider[];
  onDisconnect?: ((provider: WalletProvider) => Promise<void>) | undefined;
  onSelect: (provider: WalletProvider) => Promise<void>;
}
export function ExternalWalletChainSelector(
  props: ExternalWalletChainSelectorProps
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
          p.chainInfo.namespace === inputProvider.chainInfo.namespace
      )
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
        isMobile ? "w-full" : "w-72"
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
                    : "text-icon-text-light dark:text-icon-text-dark"
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

interface WalletButtonProps {
  icon: string;
  name: string;
  chains: Array<{
    // TODO (Amir): this is supposed to be generic but, maybe this should be typed
    namespace: string;
    isConnected: boolean;
  }>;
  onClick: () => void;
  shouldShowDisconnect?: boolean;
  isMobile?: boolean;
}

function WalletButton(props: WalletButtonProps) {
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
        <img
          src={icon}
          alt={name}
          className="size-6 rounded-full flex-shrink-0"
        />
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
              `Unsupported provider namespace. Expected Ethereum or Solana.`
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
                isHovering ? "-translate-x-8" : "translate-x-0"
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
            : "text-icon-text-light dark:text-icon-text-dark"
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

interface ExternalWalletSelectorProps {
  onDisconnect?: ((provider: WalletProvider) => Promise<void>) | undefined;
  onSelect: (provider: WalletProvider) => Promise<void>;
  onWCConnect?: (provider: WalletProvider) => Promise<void>;
  onWCDisconnect?: (provider: WalletProvider) => Promise<void>;
  onWCSign?: (provider: WalletProvider) => Promise<void>;
}
export function ExternalWalletSelector(props: ExternalWalletSelectorProps) {
  const { onDisconnect, onSelect, onWCConnect, onWCSign, onWCDisconnect } =
    props;

  const { pushPage, popPage, isMobile } = useModal();
  const { walletProviders } = useTurnkey();

  const shouldShowDisconnect = onDisconnect !== undefined;

  // Group providers by name
  const grouped = walletProviders.reduce<Record<string, WalletProvider[]>>(
    (acc, provider) => {
      const name = provider.info.name;
      if (!acc[name]) acc[name] = [];
      acc[name]!.push(provider);
      return acc;
    },
    {}
  );

  const handleSelectGroup = (group: WalletProvider[]) => {
    if (group.length === 1) {
      if (canDisconnect(group[0]!, shouldShowDisconnect)) {
        onDisconnect!(group[0]!);
      } else {
        onSelect(group[0]!);
      }
    } else {
      if (isWalletConnect(group[0]!)) {
        // For wallet connect, conditionally take us to he correct screen:
        // For mobile, take us to the ShowAllWalletsScreen -> MobileWalletConnectScreen.
        // For web, take us to the ExternalWalletChainSelector -> WalletConnectScreen

        // For the Connect screen (not signup/login), we should always route to the desktop WalletConnect flow if we're able to disconnect the wallet.
        // That's why we check canDisconnect here.
        if (isMobile && !canDisconnect(group[0]!, shouldShowDisconnect)) {
          pushPage({
            key: "Connect WalletConnect",
            content: (
              <ShowAllWalletsScreen
                onSelect={async (provider) => {
                  pushPage({
                    key: `Open app`,
                    content: (
                      <MobileWalletConnectScreen
                        provider={provider} // This is the provider object for the mobile wallet app (e.g. MetaMask, Rainbow, etc.). There is just for name, icon and app link. Connection happens with the WalletConnect provider
                        onConnect={onWCConnect!}
                        onSign={onWCSign}
                        onSelectQRCode={async () => {
                          pushPage({
                            key: `Select chain`,
                            content: (
                              <ExternalWalletChainSelector
                                providers={group} // Interesting
                                onDisconnect={onDisconnect}
                                onSelect={async (provider) => {
                                  // For WalletConnect desktop, we route to a dedicated screen
                                  // to handle the connection process, as it requires a different flow (pairing via QR code or deep link)
                                  pushPage({
                                    key: "Connect WalletConnect",
                                    content: (
                                      <WalletConnectScreen
                                        provider={provider}
                                        onAction={(onWCSign ?? onWCConnect)!} // For desktop flow, we can just use onWCSign since it will also connect. The onWCConnect is only needed for the ConnectWallet screen. In that case onWCSign won't be passed in
                                        onDisconnect={onWCDisconnect!}
                                        successPageDuration={undefined}
                                      />
                                    ),
                                  });
                                }}
                              />
                            ),
                          });
                        }}
                        successPageDuration={undefined} // TODO (Amir): wat do we want here?
                      />
                    ),
                  });
                }}
                onSelectQRCode={async () => {
                  pushPage({
                    key: `Select chain`,
                    content: (
                      <ExternalWalletChainSelector
                        providers={group} // Interesting
                        onDisconnect={onDisconnect}
                        onSelect={async (provider) => {
                          // For WalletConnect desktop, we route to a dedicated screen
                          // to handle the connection process, as it requires a different flow (pairing via QR code or deep link)
                          pushPage({
                            key: "Connect WalletConnect",
                            content: (
                              <WalletConnectScreen
                                provider={provider}
                                onAction={(onWCSign ?? onWCConnect)!} // For desktop flow, we can just use onWCSign since it will also connect. The onWCConnect is only needed for the ConnectWallet screen. In that case onWCSign won't be passed in
                                onDisconnect={onWCDisconnect!}
                                successPageDuration={undefined}
                              />
                            ),
                          });
                        }}
                      />
                    ),
                  });
                }}
              />
            ),
          });
        } else {
          pushPage({
            key: `Select chain`,
            content: (
              <ExternalWalletChainSelector
                providers={group}
                onDisconnect={onDisconnect}
                onSelect={async (provider) => {
                  // this is a wallet connect provider, so we need to show the WalletConnect screen

                  // for WalletConnect we route to a dedicated screen
                  // to handle the connection process, as it requires a different flow (pairing via QR code or deep link)
                  pushPage({
                    key: "Connect WalletConnect",
                    content: (
                      <WalletConnectScreen
                        provider={provider}
                        onAction={(onWCSign ?? onWCConnect)!} // For desktop flow, we can just use onWCSign since it will also connect. The onWCConnect is only needed for the ConnectWallet screen. In that case onWCSign won't be passed in
                        onDisconnect={onWCDisconnect!}
                        onSelectAllWallets={async () => {
                          popPage();
                          pushPage({
                            key: "Connect WalletConnect",
                            content: (
                              <ShowAllWalletsScreen
                                onSelect={async (provider) => {
                                  pushPage({
                                    key: `Open app`,
                                    content: (
                                      <MobileWalletConnectScreen
                                        provider={provider} // This is the provider object for the mobile wallet app (e.g. MetaMask, Rainbow, etc.). There is just for name, icon and app link. Connection happens with the WalletConnect provider
                                        onConnect={onWCConnect!}
                                        onSign={onWCSign}
                                        onSelectQRCode={async () => {
                                          pushPage({
                                            key: `Select chain`,
                                            content: (
                                              <ExternalWalletChainSelector
                                                providers={group} // Interesting
                                                onDisconnect={onDisconnect}
                                                onSelect={async (provider) => {
                                                  // For WalletConnect desktop, we route to a dedicated screen
                                                  // to handle the connection process, as it requires a different flow (pairing via QR code or deep link)
                                                  pushPage({
                                                    key: "Connect WalletConnect",
                                                    content: (
                                                      <WalletConnectScreen
                                                        provider={provider}
                                                        onAction={
                                                          (onWCSign ??
                                                            onWCConnect)!
                                                        } // For desktop flow, we can just use onWCSign since it will also connect. The onWCConnect is only needed for the ConnectWallet screen. In that case onWCSign won't be passed in
                                                        onDisconnect={
                                                          onWCDisconnect!
                                                        }
                                                        successPageDuration={
                                                          undefined
                                                        }
                                                      />
                                                    ),
                                                  });
                                                }}
                                              />
                                            ),
                                          });
                                        }}
                                        successPageDuration={undefined} // TODO (Amir): wat do we want here?
                                      />
                                    ),
                                  });
                                }}
                                onSelectQRCode={async () => {
                                  pushPage({
                                    key: `Select chain`,
                                    content: (
                                      <ExternalWalletChainSelector
                                        providers={group} // Interesting
                                        onDisconnect={onDisconnect}
                                        onSelect={async (provider) => {
                                          // For WalletConnect desktop, we route to a dedicated screen
                                          // to handle the connection process, as it requires a different flow (pairing via QR code or deep link)
                                          pushPage({
                                            key: "Connect WalletConnect",
                                            content: (
                                              <WalletConnectScreen
                                                provider={provider}
                                                onAction={
                                                  (onWCSign ?? onWCConnect)!
                                                } // For desktop flow, we can just use onWCSign since it will also connect. The onWCConnect is only needed for the ConnectWallet screen. In that case onWCSign won't be passed in
                                                onDisconnect={onWCDisconnect!}
                                                successPageDuration={undefined}
                                              />
                                            ),
                                          });
                                        }}
                                      />
                                    ),
                                  });
                                }}
                              />
                            ),
                          });
                        }}
                        successPageDuration={undefined}
                      />
                    ),
                  });
                }}
              />
            ),
          });
        }

        return;
      }
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
        isMobile ? "w-full" : "w-80"
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
        "min-h-42 max-h-64 mt-12 overflow-y-auto tk-scrollbar p-0.5",
        isMobile ? "w-full" : "w-80"
      )}
    >
      <div className="flex flex-col gap-2">
        {Object.entries(grouped).map(
          ([name, group]: [string, WalletProvider[]]) => {
            const first = group[0];

            return (
              <WalletButton
                key={name}
                icon={first?.info.icon ?? ""}
                name={first?.info.name ?? ""}
                chains={group.map((c) => ({
                  namespace: c.chainInfo.namespace,
                  isConnected: !!canDisconnect(c, shouldShowDisconnect),
                }))}
                onClick={() => handleSelectGroup(group)}
                shouldShowDisconnect={shouldShowDisconnect}
                isMobile={isMobile}
              />
            );
          }
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
            hasError && "text-danger-light dark:text-danger-dark"
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
            hasError && "animate-shake opacity-50"
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
interface QRCodeDisplayProps {
  uri: string;
  icon: string;
  isLoading?: boolean;
}

function QRCodeDisplay(props: QRCodeDisplayProps) {
  const { uri, icon, isLoading } = props;

  return (
    <div className="relative inline-block">
      {/* @ts-expect-error: qrcode.react uses a different React type version */}
      <QRCode
        className={clsx(
          "block border border-modal-background-dark/20 dark:border-modal-background-light/20",
          "shadow-[0_0_42px] shadow-primary-light/50 dark:shadow-[0_0_42px] dark:shadow-primary-dark/50",
          isLoading && "blur-sm"
        )}
        value={uri}
        imageSettings={{
          src: icon,
          width: 24,
          height: 24,
          excavate: true,
        }}
        size={200}
      />
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Spinner className="size-12" strokeWidth={2} />
        </div>
      )}
    </div>
  );
}

export interface WalletConnectScreenProps {
  provider: WalletProvider;
  successPageDuration: number | undefined;
  onAction: (provider: WalletProvider) => Promise<void>;
  onDisconnect?: (provider: WalletProvider) => Promise<void>;
  onSelectAllWallets?: () => Promise<void>;
}

export function WalletConnectScreen(props: WalletConnectScreenProps) {
  const {
    provider: inputProvider,
    onAction,
    onDisconnect,
    onSelectAllWallets,
    successPageDuration,
  } = props;

  const { pushPage, popPages, closeModal, isMobile } = useModal();
  const { walletProviders } = useTurnkey();

  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [disconnectError, setDisconnectError] = useState(false);
  const [showConnectedScreen, setShowConnectedScreen] = useState(
    inputProvider.connectedAddresses?.length > 0
  );
  const [showCopied, setShowCopied] = useState(false);

  // Use a ref to track the latest provider for use in callbacks
  const latestProviderRef = useRef<WalletProvider | null>(null);

  // Find the current provider state
  const provider = findWalletConnectProvider(
    walletProviders,
    inputProvider.chainInfo.namespace
  );

  // if provider is not found then that means that the user entered this screen
  // while WalletConnect was still initializing, and then it failed to initialize
  useEffect(() => {
    if (!provider) {
      // we have to go back two pages here since thats the screen
      // we get wallet providers from state
      popPages(2);
    }
  }, [provider, popPages]);

  const connectedAccount = provider?.connectedAddresses?.[0] ?? null;

  // Initial connection effect
  useEffect(() => {
    if (provider) {
      latestProviderRef.current = provider;

      // we don't try to connect if WalletConnect is still initializing or we are already connecting
      if (!isConnecting && !provider.isLoading) {
        setShowConnectedScreen(provider.connectedAddresses?.length > 0);
        runAction(provider);
      }
    }
  }, [provider]);

  // Handle the connection action - uses the ref to get latest provider
  const runAction = useDebouncedCallback(
    async (targetProvider: WalletProvider) => {
      setIsConnecting(true);

      try {
        await onAction(targetProvider);
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
      } catch {
        // noop
      } finally {
        setIsConnecting(false);
      }
    },
    100
  );

  const handleCopy = () => {
    setShowCopied(true);
    navigator.clipboard.writeText(`${provider?.uri}`);
    setTimeout(() => {
      setShowCopied(false);
    }, 1500);
  };

  // Handle disconnection - uses the ref to get the correct provider after state update
  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    setDisconnectError(false);

    try {
      // Use the current provider from ref for disconnect
      await onDisconnect?.(latestProviderRef.current!);
    } catch (err) {
      console.error("Error disconnecting wallet:", err);
      setDisconnectError(true);
    } finally {
      setIsDisconnecting(false);
      setShowConnectedScreen(false);
    }
  };

  return (
    <div className="p-3 flex flex-col items-center">
      {showConnectedScreen ? (
        <div
          className={clsx(
            "mt-8 flex flex-col items-center gap-3",
            isMobile ? "w-full" : "w-96"
          )}
        >
          <div className="w-full justify-between flex items-center flex-1">
            <div
              className={clsx(
                "flex items-center justify-center bg-icon-background-light dark:bg-icon-background-dark rounded-full p-2 text-icon-text-light dark:text-icon-text-dark",
                isMobile ? "size-18" : "size-24"
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
                  src={provider?.info.icon}
                  alt="Wallet connect logo"
                />
                <img
                  className="size-5 absolute animate-ping"
                  src={provider?.info.icon}
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
                isMobile ? "size-18" : "size-24"
              )}
            >
              <FontAwesomeIcon icon={faLaptop} size={isMobile ? "3x" : "4x"} />
            </div>
          </div>

          <div
            className={clsx(
              "flex flex-row items-center mt-5 text-2xl font-bold text-center"
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
            isMobile ? "w-full" : "w-96"
          )}
        >
          <QRCodeDisplay
            uri={
              provider?.isLoading
                ? "https://www.turnkey.com/"
                : (provider?.uri ?? "")
            }
            icon={provider?.info.icon ?? ""}
            isLoading={!!provider?.isLoading}
          />

          <BaseButton
            onClick={handleCopy}
            className={clsx(
              "text-xs font-semibold bg-transparent border-none text-icon-text-light dark:text-icon-text-dark",
              "flex flex-row items-center gap-x-2 px-3 py-2 rounded-full transition-all",
              "hover:bg-icon-background-light dark:hover:bg-icon-background-dark active:scale-95",
              provider?.isLoading && "invisible pointer-events-none"
            )}
          >
            <span>Copy link</span>

            <div className="relative">
              <FontAwesomeIcon
                icon={showCopied ? faCheck : faCopy}
                className={clsx(
                  "transition-colors",
                  showCopied
                    ? "text-success-light dark:text-success-dark"
                    : "text-icon-text-light dark:text-icon-text-dark"
                )}
              />
              {showCopied && (
                <FontAwesomeIcon
                  icon={faCheck}
                  className="absolute inset-0 m-auto text-success-light dark:text-success-dark animate-ping"
                />
              )}
            </div>
          </BaseButton>

          <div className={clsx("text-2xl font-bold text-center")}>
            {provider?.isLoading
              ? "Initializing WalletConnect..."
              : "Use your phone"}
          </div>
          <div className="text-icon-text-light dark:text-icon-text-dark text-center !p-0">
            {provider?.isLoading
              ? "Preparing your connection. This will only take a moment."
              : "Scan this QR code with your WalletConnect-compatible wallet to connect"}
          </div>
          {onSelectAllWallets && (
            <span className="text-icon-text-light dark:text-icon-text-dark text-center text-xs !p-0 mt-2">
              Not what you're looking for?{" "}
              <span
                className="text-primary-light dark:text-primary-dark cursor-pointer underline"
                onClick={() => {
                  popPages(2);
                  onSelectAllWallets();
                }}
              >
                See all WalletConnect apps.
              </span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}

interface ShowAllWalletsScreenProps {
  onSelect: (targetApp: WalletProvider) => Promise<void>;
  onSelectQRCode: () => Promise<void>;
}

const WALLET_BUTTON_HEIGHT = 56; // Height of each wallet button in pixels. TODO (Amir): Once we separate into multiple files, have these exported in a "global" or "consts" file or something in the same folder
const BUFFER_SIZE = 5; // Number of items to render outside visible area

export function ShowAllWalletsScreen(props: ShowAllWalletsScreenProps) {
  const { onSelect, onSelectQRCode } = props;
  const { walletProviders, walletConnectApps, disconnectWalletAccount } =
    useTurnkey();
  const { isMobile, pushPage } = useModal();

  const [searchQuery, setSearchQuery] = useState("");
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 20 });
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Group wallets by name
  const grouped = useMemo(
    () =>
      walletConnectApps.reduce<Record<string, WalletProvider[]>>(
        (acc, provider) => {
          const name = provider.info.name;
          if (!acc[name]) acc[name] = [];
          acc[name]!.push(provider);
          return acc;
        },
        {}
      ),
    [walletConnectApps]
  );

  // Convert to array and filter by search query
  const walletEntries = useMemo(() => {
    const entries = Object.entries(grouped);
    if (!searchQuery.trim()) return entries;

    const query = searchQuery.toLowerCase();
    return entries.filter(([name]) => name.toLowerCase().includes(query));
  }, [grouped, searchQuery]);

  const handleSelectGroup = useCallback(
    (group: WalletProvider[]) => {
      if (group.length === 1) {
        disconnectAndSelect(group[0]!);
      } else {
        pushPage({
          key: `Select chain`,
          content: (
            <ExternalWalletChainSelector
              providers={group}
              onSelect={disconnectAndSelect}
            />
          ),
        });
      }
    },
    [walletProviders, onSelect, pushPage]
  );

  // To make our lives easier and avoid confusing the end user, we always disconnect
  // the existing WalletConnect session before starting a new one.
  // Note that this doesn't happen for desktop wallet connecting (QR code or native browser extension)
  const disconnectAndSelect = async (targetApp: WalletProvider) => {
    const walletConnectProvider = findWalletConnectProvider(
      walletProviders,
      targetApp.chainInfo.namespace
    );

    if (
      walletConnectProvider &&
      walletConnectProvider.connectedAddresses.length > 0
    ) {
      await disconnectWalletAccount(walletConnectProvider);
    }
    await onSelect(targetApp);
  };

  // Handle scroll to update visible range
  const handleScroll = useDebouncedCallback(() => {
    if (!scrollContainerRef.current) return;

    const scrollTop = scrollContainerRef.current.scrollTop;
    const containerHeight = scrollContainerRef.current.clientHeight;

    const start = Math.max(
      0,
      Math.floor(scrollTop / WALLET_BUTTON_HEIGHT) - BUFFER_SIZE
    );
    const end = Math.min(
      walletEntries.length,
      Math.ceil((scrollTop + containerHeight) / WALLET_BUTTON_HEIGHT) +
        BUFFER_SIZE
    );

    setVisibleRange({ start, end });
  }, 50);

  // Update visible range when search results change
  useEffect(() => {
    setVisibleRange({ start: 0, end: Math.min(20, walletEntries.length) });
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [walletEntries.length]);

  // Debounced search handler
  const debouncedSetSearch = useDebouncedCallback(
    (value: string) => setSearchQuery(value),
    300
  );

  const visibleItems = useMemo(
    () => walletEntries.slice(visibleRange.start, visibleRange.end),
    [walletEntries, visibleRange]
  );

  const totalHeight = walletEntries.length * WALLET_BUTTON_HEIGHT;
  const offsetY = visibleRange.start * WALLET_BUTTON_HEIGHT;

  return (
    <div
      className={clsx(
        "flex flex-col mt-10 gap-3",
        isMobile ? "w-full" : "w-80"
      )}
    >
      {/* Search Input. TODO (Amir): Make this separate component */}
      <div className="w-full flex items-center gap-2 rounded-md text-inherit bg-button-light dark:bg-button-dark border border-modal-background-dark/20 dark:border-modal-background-light/20 focus-within:outline-primary-light focus-within:dark:outline-primary-dark focus-within:outline-[1px] focus-within:outline-offset-0 box-border transition-all">
        <FontAwesomeIcon
          icon={faSearch}
          className="relative text-icon-text-light dark:text-icon-text-dark px-2"
        />
        <Input
          type="text"
          autoCapitalize="none"
          autoComplete="off"
          placeholder="Search wallets..."
          onChange={(e) => debouncedSetSearch(e.target.value)}
          className="w-full py-3 bg-transparent border-none text-inherit placeholder-icon-text-light dark:placeholder-icon-text-dark focus:outline-none focus:ring-0 focus:border-none"
        />

        {searchQuery && (
          <BaseButton
            className="flex text-icon-text-light dark:text-icon-text-dark text-sm border-none self-stretch px-2 items-center justify-center"
            onClick={() => {
              setSearchQuery("");
              const input =
                scrollContainerRef.current?.previousElementSibling?.querySelector(
                  "input"
                );
              if (input instanceof HTMLInputElement) {
                input.value = "";
              }
            }}
          >
            Clear
          </BaseButton>
        )}
      </div>

      {/* Wallet List with Virtual Scrolling */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className={clsx("min-h-42 max-h-72 overflow-y-auto tk-scrollbar p-0.5")}
      >
        <div style={{ height: totalHeight, position: "relative" }}>
          <div
            style={{
              transform: `translateY(${offsetY}px)`,
              position: "absolute",
              width: "100%",
            }}
            className="flex flex-col gap-2"
          >
            {/* QR Code option always on top (only when not searching) */}
            {visibleRange.start === 0 && !searchQuery && (
              <WalletButton
                key="qr-code-walletconnect"
                icon={qrIcon}
                name="Scan QR Code"
                chains={[
                  { namespace: "ethereum", isConnected: false },
                  { namespace: "solana", isConnected: false },
                ]}
                onClick={onSelectQRCode}
                isMobile={isMobile}
              />
            )}

            {/* Wallet Buttons */}
            {visibleItems.map(([name, group]: [string, WalletProvider[]]) => {
              const first = group[0];

              return (
                <WalletButton
                  key={name}
                  icon={first?.info.icon ?? ""}
                  name={first?.info.name ?? ""}
                  chains={group.map((c) => ({
                    namespace: c.chainInfo.namespace,
                    isConnected: false,
                  }))}
                  onClick={() => handleSelectGroup(group)}
                  shouldShowDisconnect={false}
                  isMobile={isMobile}
                />
              );
            })}
          </div>
        </div>

        {/* No results message */}
        {searchQuery && walletEntries.length === 0 && (
          <div className="flex items-center justify-center w-full h-40 text-center text-icon-text-light dark:text-icon-text-dark">
            No wallets found matching "{searchQuery}"
          </div>
        )}
      </div>

      {/* Results count */}
      {searchQuery && walletEntries.length > 0 && (
        <div className="text-xs text-center text-icon-text-light dark:text-icon-text-dark">
          Showing {walletEntries.length} wallet
          {walletEntries.length !== 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
}

interface MobileWalletConnectScreenProps {
  provider: WalletProvider;
  successPageDuration: number | undefined;
  onConnect: (provider: WalletProvider) => Promise<void>;
  onSign?: ((provider: WalletProvider) => Promise<void>) | undefined;
  onSelectQRCode: () => Promise<void>;
}
export function MobileWalletConnectScreen(
  props: MobileWalletConnectScreenProps
) {
  const {
    provider: targetApp,
    onConnect,
    onSign,
    onSelectQRCode,
    successPageDuration,
  } = props;

  const { pushPage, popPages, closeModal, isMobile } = useModal();
  const { walletProviders } = useTurnkey();

  const latestProviderRef = useRef<WalletProvider | null>(null);

  const [isConnecting, setIsConnecting] = useState(false);
  const [canSign, setCanSign] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [shouldStartConnecting, setShouldStartConnecting] = useState(isMobile);

  // Find the current WalletConnect provider state
  const walletConnectProvider = findWalletConnectProvider(
    walletProviders,
    targetApp.chainInfo.namespace
  );

  // if provider is not found then that means that the user entered this screen
  // while WalletConnect was still initializing, and then it failed to initialize
  useEffect(() => {
    if (!walletConnectProvider) {
      // we have to go back two pages here since thats the screen
      // we get wallet providers from state
      popPages(2);
    }
  }, [walletConnectProvider, popPages]);

  // Initial connection effect
  useEffect(() => {
    if (!shouldStartConnecting) return;

    if (walletConnectProvider) {
      latestProviderRef.current = walletConnectProvider;

      // we don't try to connect if WalletConnect is still initializing or we are already connecting
      if (!isConnecting && !walletConnectProvider.isLoading) {
        if (walletConnectProvider.connectedAddresses.length > 0) {
          // Connection already established. Try to connect if possible
          if (onSign) {
            setCanSign(true);
          } else {
            setCompleted(true);
          }
        } else {
          // Start connection flow
          setCanSign(false);
          handleOpenApp(
            `wc?uri=${encodeURIComponent(
              latestProviderRef?.current?.uri ?? ""
            )}`
          );
          runConnectAction(walletConnectProvider);
        }
      }
    }
  }, [walletConnectProvider, shouldStartConnecting]);

  // Handle the connection action - uses the ref to get latest provider
  const runConnectAction = useDebouncedCallback(
    async (targetProvider: WalletProvider) => {
      setIsConnecting(true);

      try {
        await onConnect(targetProvider);
        if (onSign) {
          setCanSign(true);
        } else {
          // Skip signing step if no signature is required (Connect only, not signup/login)
          setCompleted(true);
        }
      } catch {
        // noop
      } finally {
        setIsConnecting(false);
      }
    },
    100
  );

  // Handle the sign action - uses the ref to get latest provider
  const runSignAction = useDebouncedCallback(
    async (targetProvider: WalletProvider) => {
      setIsConnecting(true);

      try {
        await onSign!(targetProvider);
        setCompleted(true);
      } catch {
        // noop
      } finally {
        setIsConnecting(false);
      }
    },
    100
  );

  const handleOpenApp = (linkParams?: string) => {
    const link = `${targetApp.uri}${linkParams ? `${linkParams}` : ""}`;
    window.location.href = link;
  };

  useEffect(() => {
    if (completed) {
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
    }
  }, [completed]);

  return (
    <div
      className={clsx(
        "flex flex-col items-center justify-center py-5 text-center",
        isMobile ? "w-full" : "w-auto"
      )}
    >
      {!shouldStartConnecting ? (
        <div
          className={clsx(
            "flex flex-col gap-4 mt-6 items-center justify-center",
            isMobile ? "w-full" : "w-96"
          )}
        >
          <img src={targetApp.info.icon} className="size-14 rounded-full" />
          <span className="text-sm text-center text-icon-text-light dark:text-icon-text-dark">
            {"You can connect"} {targetApp.info.name ?? "this wallet provider"}
            {
              " using your mobile device. Open this page on your mobile device to continue or scan the QR code with your wallet app."
            }
          </span>
          <span className="text-sm text-center text-icon-text-light dark:text-icon-text-dark">
            {"Already on mobile?"}{" "}
            <span
              className="text-primary-light dark:text-primary-dark cursor-pointer underline"
              onClick={() => setShouldStartConnecting(true)}
            >
              Try opening {targetApp.info.name} anyways.
            </span>
          </span>

          <ActionButton
            onClick={onSelectQRCode}
            className="w-full text-inherit bg-button-light dark:bg-button-dark"
          >
            <div className="flex flex-row w-full justify-center items-center gap-2">
              Scan QR code
              <FontAwesomeIcon
                icon={faQrcode}
                size="lg"
                className="text-icon-text-light dark:text-icon-text-dark"
              />
            </div>
          </ActionButton>
        </div>
      ) : canSign ? (
        <div
          className={clsx(
            "flex flex-col gap-4 mt-6 items-center justify-center",
            isMobile ? "w-full" : "w-72"
          )}
        >
          <img src={targetApp.info.icon} className="size-14 rounded-full" />
          <span className="text-sm text-center text-icon-text-light dark:text-icon-text-dark">
            {targetApp.info.name ?? "This wallet provider"}
            {
              " is connected! Please sign the login request using the app to continue."
            }
          </span>
          <ActionButton
            onClick={() => {
              handleOpenApp();
              runSignAction(latestProviderRef.current!);
            }}
            loading={isConnecting}
            loadingText="Check the app..."
            className="w-full text-inherit bg-button-light dark:bg-button-dark"
          >
            <div className="flex flex-row w-full justify-center items-center gap-1.5">
              Sign login request
              <FontAwesomeIcon
                icon={faArrowUpRightFromSquare}
                size="sm"
                className="text-icon-text-light dark:text-icon-text-dark"
              />
            </div>
          </ActionButton>
        </div>
      ) : (
        <div className="flex flex-col">
          <ActionPage
            // Run the action from a separate useEffect. No need to pass it here
            title={`Connecting to ${targetApp.info.name}`}
            icon={
              <img
                className="size-11 rounded-full"
                src={targetApp.info.icon || ""}
              />
            }
          />
          <div className="text-icon-text-light text-sm dark:text-icon-text-dark text-center !p-0">
            App not opening? Please ensure you have {targetApp.info.name}{" "}
            installed or{" "}
            <span
              className="text-primary-light dark:text-primary-dark cursor-pointer underline"
              onClick={() => {
                handleOpenApp(
                  `wc?uri=${encodeURIComponent(
                    latestProviderRef?.current?.uri ?? ""
                  )}`
                );
              }}
            >
              try opening {targetApp.info.name} again.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

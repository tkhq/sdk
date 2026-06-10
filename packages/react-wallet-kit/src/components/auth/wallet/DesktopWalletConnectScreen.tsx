import { BaseButton } from "../../design/Buttons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCheck,
  faCopy,
  faLaptop,
  faMobileScreen,
} from "@fortawesome/free-solid-svg-icons";
import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import type { WalletProvider } from "@turnkey/core";
import { SuccessPage } from "../../design/Success";
import { useModal } from "../../../providers/modal/Hook";
import { useTurnkey } from "../../../providers/client/Hook";
import {
  findWalletConnectProvider,
  useDebouncedCallback,
} from "../../../utils/utils";
import { QRCodeDisplay } from "./QRCodeDisplay";

export interface DesktopWalletConnectScreenProps {
  provider: WalletProvider;
  successPageDuration?: number | undefined;
  onAction: (provider: WalletProvider) => Promise<void>;
  onDisconnect?: (provider: WalletProvider) => Promise<void>;
  onSelectAllWallets?: (() => Promise<void>) | undefined;
}

export function DesktopWalletConnectScreen(
  props: DesktopWalletConnectScreenProps,
) {
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
    inputProvider.connectedAddresses?.length > 0,
  );
  const [showCopied, setShowCopied] = useState(false);

  // Use a ref to track the latest provider for use in callbacks
  const latestProviderRef = useRef<WalletProvider | null>(null);

  // Find the current provider state
  const provider = findWalletConnectProvider(
    walletProviders,
    inputProvider.chainInfo.namespace,
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
    100,
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
              provider?.isLoading && "invisible pointer-events-none",
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
                    : "text-icon-text-light dark:text-icon-text-dark",
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

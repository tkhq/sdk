import { ActionButton } from "../../design/Buttons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowUpRightFromSquare,
  faQrcode,
} from "@fortawesome/free-solid-svg-icons";
import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import type { Chain, WalletProvider } from "@turnkey/core";
import { SuccessPage } from "../../design/Success";
import { useModal } from "../../../providers/modal/Hook";
import { useTurnkey } from "../../../providers/client/Hook";
import {
  findWalletConnectProvider,
  useDebouncedCallback,
} from "../../../utils/utils";
import { ActionPage } from "../Action";

interface MobileWalletConnectScreenProps {
  provider: WalletProvider;
  successPageDuration?: number | undefined;
  onConnect: (provider: WalletProvider) => Promise<void>;
  onSign?: ((provider: WalletProvider) => Promise<void>) | undefined;
  onSelectQRCode: (chain?: Chain | undefined) => Promise<void>;
}
export function MobileWalletConnectScreen(
  props: MobileWalletConnectScreenProps,
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
    targetApp.chainInfo.namespace,
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
              latestProviderRef?.current?.uri ?? "",
            )}`,
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
    100,
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
    100,
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
        isMobile ? "w-full" : "w-auto",
      )}
    >
      {!shouldStartConnecting ? (
        <div
          className={clsx(
            "flex flex-col gap-4 mt-6 items-center justify-center",
            isMobile ? "w-full" : "w-96",
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
            onClick={() =>
              // At this point, the user already selected the chian. So we can pass it in to redirect directly to the QR code for that chain
              onSelectQRCode(targetApp.chainInfo.namespace)
            }
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
            isMobile ? "w-full" : "w-72",
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
                    latestProviderRef?.current?.uri ?? "",
                  )}`,
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

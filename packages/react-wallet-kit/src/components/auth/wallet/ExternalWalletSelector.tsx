import { useEffect } from "react";
import clsx from "clsx";
import {
  WalletSource,
  type ConnectedWallet,
  type WalletAccount,
  type WalletProvider,
} from "@turnkey/core";
import { useModal } from "../../../providers/modal/Hook";
import { useTurnkey } from "../../../providers/client/Hook";
import { isWalletConnect } from "../../../utils/utils";
import { WalletButton } from "./WalletButton";
import { ExternalWalletChainSelector } from "./ExternalWalletChainSelector";
import { WalletConnectFlow } from "./WalletConnectFlow";
import { canDisconnect } from "./utils";
import { ActionPage } from "../Action";
import { SuccessPage } from "../../design/Success";
import { DisconnectWalletScreen } from "./DisconnectWalletScreen";
import { WalletSelectorMode } from "../../../types/base";

// Re-export for consumers
export { WalletSelectorMode } from "../../../types/base";

interface AuthModeProps {
  mode: WalletSelectorMode.Auth;
  /** Session key for the auth flow */
  sessionKey?: string | undefined;
}

interface ConnectModeProps {
  mode: WalletSelectorMode.Connect;
  /** Called when a wallet is successfully connected or disconnected */
  onSuccess: (type: "connect" | "disconnect", account: WalletAccount) => void;
  /** Duration to show success page (ms). If 0 or undefined, closes immediately */
  successPageDuration?: number | undefined;
}

export type ExternalWalletSelectorProps = AuthModeProps | ConnectModeProps;

export function ExternalWalletSelector(props: ExternalWalletSelectorProps) {
  const { mode } = props;

  const { pushPage, popPage, closeModal, isMobile } = useModal();
  const {
    walletProviders,
    wallets,
    loginOrSignupWithWallet,
    connectWalletAccount,
    disconnectWalletAccount,
  } = useTurnkey();

  // Derive config based on mode
  const isConnectMode = mode === WalletSelectorMode.Connect;
  const sessionKey = isConnectMode ? undefined : props.sessionKey;
  const shouldShowDisconnect = isConnectMode;
  const successPageDuration = isConnectMode
    ? props.successPageDuration
    : undefined;
  const onSuccess = isConnectMode ? props.onSuccess : undefined;

  // Auth mode: show ActionPage and call loginOrSignupWithWallet
  const handleAuthSelect = async (provider: WalletProvider) => {
    pushPage({
      key: "Wallet Login/Signup",
      content: (
        <ActionPage
          title={`Authenticating with ${provider.info.name}...`}
          action={async () => {
            await loginOrSignupWithWallet({
              walletProvider: provider,
              ...(sessionKey && { sessionKey }),
            });
          }}
          icon={
            <img
              className="size-11 rounded-full"
              src={provider.info.icon || ""}
            />
          }
        />
      ),
      showTitle: false,
    });
  };

  // Connect mode: show ActionPage, connect wallet, show success
  const handleConnectSelect = async (provider: WalletProvider) => {
    pushPage({
      key: `Connect ${provider.info.name}`,
      content: (
        <ActionPage
          title={`Connecting ${provider.info.name}`}
          icon={
            <img
              className="size-11 rounded-full"
              src={provider.info.icon || ""}
            />
          }
          closeOnComplete={false}
          action={async () => {
            const account = await connectWalletAccount(provider);
            onSuccess?.("connect", account);
            if (successPageDuration && successPageDuration > 0) {
              pushPage({
                key: "Connecting Success",
                content: (
                  <SuccessPage
                    text="Successfully connected wallet!"
                    onComplete={() => closeModal()}
                    duration={successPageDuration}
                  />
                ),
                preventBack: true,
                showTitle: false,
              });
            } else {
              closeModal();
            }
          }}
        />
      ),
      showTitle: false,
    });
  };

  // Connect mode: show disconnect confirmation, then disconnect
  const handleDisconnect = async (provider: WalletProvider) => {
    pushPage({
      key: `Disconnect ${provider.info.name}`,
      content: (
        <DisconnectWalletScreen
          provider={provider}
          onDisconnect={async () => {
            const address = provider.connectedAddresses[0];

            // Find the matching account from connected wallets
            const connectedWallets = wallets.filter(
              (w): w is ConnectedWallet => w.source === WalletSource.Connected,
            );
            const matchedAccount = connectedWallets
              .flatMap((w) => w.accounts)
              .find((a) => a.address === address);

            await disconnectWalletAccount(provider);
            onSuccess?.("disconnect", matchedAccount!);

            if (successPageDuration && successPageDuration > 0) {
              pushPage({
                key: "Disconnect Success",
                content: (
                  <SuccessPage
                    text="Successfully disconnected wallet!"
                    onComplete={() => closeModal()}
                    duration={successPageDuration}
                  />
                ),
                preventBack: true,
                showTitle: false,
              });
            } else {
              closeModal();
            }
          }}
        />
      ),
      showTitle: false,
    });
  };

  // Select the appropriate handler based on mode
  const onSelect = isConnectMode ? handleConnectSelect : handleAuthSelect;

  // Group providers by name
  const grouped = walletProviders.reduce<Record<string, WalletProvider[]>>(
    (acc, provider) => {
      const name = provider.info.name;
      if (!acc[name]) acc[name] = [];
      acc[name]!.push(provider);
      return acc;
    },
    {},
  );

  const pushStandardChainSelector = (group: WalletProvider[]) => {
    pushPage({
      key: `Select chain`,
      content: (
        <ExternalWalletChainSelector
          providers={group}
          onSelect={onSelect}
          onDisconnect={isConnectMode ? handleDisconnect : undefined}
        />
      ),
    });
  };

  const pushWalletConnectFlow = (group: WalletProvider[]) => {
    pushPage({
      key: "WalletConnect",
      content: (
        <WalletConnectFlow
          providers={group}
          mode={mode}
          sessionKey={sessionKey}
          onDisconnect={isConnectMode ? handleDisconnect : undefined}
        />
      ),
      showTitle: false,
    });
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Selection handlers
  // ─────────────────────────────────────────────────────────────────────────────

  const handleSelectGroup = (group: WalletProvider[]) => {
    const provider = group[0]!;
    const isConnected = !!canDisconnect(provider, shouldShowDisconnect);

    // Single chain - direct action
    if (group.length === 1) {
      if (isConnected) {
        handleDisconnect(provider);
      } else {
        onSelect(provider);
      }
      return;
    }

    // Multiple chains - need chain selector
    if (isWalletConnect(provider)) {
      pushWalletConnectFlow(group);
    } else {
      pushStandardChainSelector(group);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Auto-navigation when only one provider group exists
  // ─────────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    const groupedValues = Object.values(grouped);
    if (groupedValues.length === 1) {
      popPage(); // Remove this page to prevent back-button loops
      handleSelectGroup(groupedValues[0]!);
    }
  }, [grouped]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────────

  if (Object.keys(grouped).length === 0) {
    return (
      <div
        className={clsx(
          "flex flex-col h-40 mt-4 gap-2 justify-center items-center text-xs text-center text-icon-text-light dark:text-icon-text-dark",
          isMobile ? "w-full" : "w-80",
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
    );
  }

  return (
    <div
      className={clsx(
        "min-h-42 max-h-64 mt-12 overflow-y-auto tk-scrollbar p-0.5",
        isMobile ? "w-full" : "w-80",
      )}
    >
      <div className="flex flex-col gap-2">
        {Object.entries(grouped).map(([name, group]) => {
          const first = group[0]!;
          return (
            <WalletButton
              key={name}
              icon={first.info.icon ?? ""}
              name={first.info.name ?? ""}
              chains={group.map((c) => ({
                namespace: c.chainInfo.namespace,
                isConnected: !!canDisconnect(c, shouldShowDisconnect),
              }))}
              onClick={() => handleSelectGroup(group)}
              shouldShowDisconnect={shouldShowDisconnect}
              isMobile={isMobile}
            />
          );
        })}
      </div>
    </div>
  );
}

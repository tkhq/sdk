import { useEffect } from "react";
import clsx from "clsx";
import type { WalletProvider } from "@turnkey/core";
import { useModal } from "../../../providers/modal/Hook";
import { useTurnkey } from "../../../providers/client/Hook";
import { isWalletConnect } from "../../../utils/utils";
import { WalletButton } from "./WalletButton";
import { ExternalWalletChainSelector } from "./ExternalWalletChainSelector";
import { DesktopWalletConnectScreen } from "./DesktopWalletConnectScreen";
import { MobileWalletConnectScreen } from "./MobileWalletConnectScreen";
import { ShowAllWalletsScreen } from "./ShowAllWalletsScreen";
import { canDisconnect } from "./utils";

interface ExternalWalletSelectorProps {
  onSelect: (provider: WalletProvider) => Promise<void>;
  onDisconnect?: ((provider: WalletProvider) => Promise<void>) | undefined;
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
    {},
  );

  const pushStandardChainSelector = (group: WalletProvider[]) => {
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
  };

  const pushDesktopQRCodeScreen = (
    provider: WalletProvider,
    onSelectAllWallets?: () => Promise<void>,
  ) => {
    pushPage({
      key: "Connect WalletConnect",
      content: (
        <DesktopWalletConnectScreen
          provider={provider}
          // For desktop flow, onWCSign handles both connect + sign. onWCConnect is only needed for ConnectWallet screen.
          onAction={(onWCSign ?? onWCConnect)!}
          onDisconnect={onWCDisconnect!}
          onSelectAllWallets={onSelectAllWallets}
        />
      ),
    });
  };

  const pushDesktopChainSelector = (
    group: WalletProvider[],
    onSelectAllWallets?: () => Promise<void>,
  ) => {
    pushPage({
      key: `Select chain`,
      content: (
        <ExternalWalletChainSelector
          providers={group}
          onDisconnect={onDisconnect}
          onSelect={async (provider) =>
            pushDesktopQRCodeScreen(provider, onSelectAllWallets)
          }
        />
      ),
    });
  };

  /** Mobile: Deep link screen to open wallet app */
  const pushMobileDeepLinkScreen = (
    provider: WalletProvider,
    group: WalletProvider[],
  ) => {
    pushPage({
      key: `Open app`,
      content: (
        <MobileWalletConnectScreen
          provider={provider}
          onConnect={onWCConnect!}
          onSign={onWCSign}
          onSelectQRCode={async (chain) => {
            // Fallback to QR code if deep link doesn't work
            const chainProvider = group.find(
              (p) => p.chainInfo.namespace === chain,
            )!;
            pushDesktopQRCodeScreen(chainProvider);
          }}
        />
      ),
    });
  };

  /** Mobile: Show all WalletConnect-compatible apps */
  const pushMobileAppSelector = (group: WalletProvider[]) => {
    pushPage({
      key: "Connect WalletConnect",
      content: (
        <ShowAllWalletsScreen
          onSelect={async (provider) =>
            pushMobileDeepLinkScreen(provider, group)
          }
          onSelectQRCode={async () => pushDesktopChainSelector(group)}
        />
      ),
    });
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Selection handlers
  // ─────────────────────────────────────────────────────────────────────────────

  const handleWalletConnectGroup = (
    group: WalletProvider[],
    isConnected: boolean,
  ) => {
    // Mobile flow: App list -> deep link to wallet app
    // Desktop flow: Chain selector -> QR code
    //
    // Exception: For "Connect Wallet" screen (disconnect possible),
    // always use desktop flow since it shows connection status.
    const useDesktopFlow = !isMobile || isConnected;

    if (useDesktopFlow) {
      pushDesktopChainSelector(group, async () => {
        popPage();
        pushMobileAppSelector(group);
      });
    } else {
      pushMobileAppSelector(group);
    }
  };

  const handleSelectGroup = (group: WalletProvider[]) => {
    const provider = group[0]!;
    const isConnected = !!canDisconnect(provider, shouldShowDisconnect);

    // Single chain - direct action
    if (group.length === 1) {
      if (isConnected) {
        onDisconnect!(provider);
      } else {
        onSelect(provider);
      }
      return;
    }

    // Multiple chains - need chain selector
    if (isWalletConnect(provider)) {
      handleWalletConnectGroup(group, isConnected);
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

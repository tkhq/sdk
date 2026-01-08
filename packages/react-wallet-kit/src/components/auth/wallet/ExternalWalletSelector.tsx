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

  const pushWalletConnectScreen = (
    provider: WalletProvider,
    onSelectAllWallets?: () => Promise<void>,
  ) => {
    // Desktop QR code flow.
    pushPage({
      key: "Connect WalletConnect",
      content: (
        <DesktopWalletConnectScreen
          provider={provider}
          onAction={(onWCSign ?? onWCConnect)!} // For desktop flow, we can just use onWCSign since it will also connect. The onWCConnect is only needed for the ConnectWallet screen. In that case onWCSign won't be passed in
          onDisconnect={onWCDisconnect!}
          onSelectAllWallets={onSelectAllWallets}
        />
      ),
    });
  };

  const pushChainSelector = (
    group: WalletProvider[],
    onSelectAllWallets?: () => Promise<void>,
  ) => {
    pushPage({
      key: `Select chain`,
      content: (
        <ExternalWalletChainSelector
          providers={group}
          onDisconnect={onDisconnect}
          onSelect={async (provider) => {
            // For WalletConnect desktop, we route to a dedicated screen
            // to handle the connection process, as it requires a different flow (pairing via QR code or deep link)
            pushWalletConnectScreen(provider, onSelectAllWallets);
          }}
        />
      ),
    });
  };

  const pushMobileWalletConnectScreen = (
    provider: WalletProvider,
    group: WalletProvider[],
  ) => {
    pushPage({
      key: `Open app`,
      content: (
        <MobileWalletConnectScreen
          provider={provider} // This is the provider object for the mobile wallet app (e.g. MetaMask, Rainbow, etc.). There is just for name, icon and app link. Connection happens with the WalletConnect provider
          onConnect={onWCConnect!}
          onSign={onWCSign}
          onSelectQRCode={async (chain) => {
            pushWalletConnectScreen(
              group.find((p) => p.chainInfo.namespace === chain)!,
            );
          }}
        />
      ),
    });
  };

  const pushShowAllWalletsScreen = (group: WalletProvider[]) => {
    pushPage({
      key: "Connect WalletConnect",
      content: (
        <ShowAllWalletsScreen
          onSelect={async (provider) => {
            pushMobileWalletConnectScreen(provider, group);
          }}
          onSelectQRCode={async () => {
            pushChainSelector(group);
          }}
        />
      ),
    });
  };

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
          pushShowAllWalletsScreen(group);
        } else {
          pushChainSelector(group, async () => {
            popPage();
            pushShowAllWalletsScreen(group);
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
  ) : (
    <div
      className={clsx(
        "min-h-42 max-h-64 mt-12 overflow-y-auto tk-scrollbar p-0.5",
        isMobile ? "w-full" : "w-80",
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
          },
        )}
      </div>
    </div>
  );
}

import { useEffect } from "react";
import type { WalletProvider } from "@turnkey/core";
import { useModal } from "../../../providers/modal/Hook";
import { useTurnkey } from "../../../providers/client/Hook";
import { ExternalWalletChainSelector } from "./ExternalWalletChainSelector";
import { DesktopWalletConnectScreen } from "./DesktopWalletConnectScreen";
import { DisconnectWalletScreen } from "./DisconnectWalletScreen";
import { MobileWalletConnectScreen } from "./MobileWalletConnectScreen";
import { ShowAllWalletsScreen } from "./ShowAllWalletsScreen";
import { WalletSelectorMode } from "../../../types/base";

interface WalletConnectFlowProps {
  /** The WalletConnect provider group (one per chain) */
  providers: WalletProvider[];
  /** The mode determines the flow behavior */
  mode: WalletSelectorMode;
  /** Session key for auth flow (only used when mode is Auth) */
  sessionKey?: string | undefined;
  /** Custom disconnect handler (e.g. to show success page). Falls back to a simple disconnect + pop. */
  onDisconnect?: ((provider: WalletProvider) => Promise<void>) | undefined;
}

/**
 * Orchestrates the WalletConnect connection flow.
 *
 * Desktop flow: Chain selector → QR code screen
 * Mobile flow: App selector → Deep link screen (with QR fallback)
 */
export function WalletConnectFlow(props: WalletConnectFlowProps) {
  const { providers, mode, sessionKey, onDisconnect } = props;

  const { pushPage, popPage, isMobile } = useModal();
  const {
    connectWalletAccount,
    disconnectWalletAccount,
    loginOrSignupWithWallet,
  } = useTurnkey();

  const isConnectMode = mode === WalletSelectorMode.Connect;

  // Check if any provider in the group is already connected
  const isConnected =
    isConnectMode && providers.some((p) => p.connectedAddresses?.length > 0);

  // ─────────────────────────────────────────────────────────────────────────────
  // WalletConnect action handlers
  // ─────────────────────────────────────────────────────────────────────────────

  const handleAction = async (provider: WalletProvider) => {
    if (mode === WalletSelectorMode.Auth) {
      // Auth flow: loginOrSignupWithWallet handles connect + sign
      await loginOrSignupWithWallet({
        walletProvider: provider,
        ...(sessionKey && { sessionKey }),
      });
    } else {
      // Connect-only flow
      await connectWalletAccount(provider);
    }
  };

  const handleDisconnect = async (provider: WalletProvider) => {
    await disconnectWalletAccount(provider);
  };

  /** Push the DisconnectWalletScreen for a connected provider */
  const pushDisconnectScreen = async (provider: WalletProvider) => {
    if (onDisconnect) {
      await onDisconnect(provider);
      return;
    }
    pushPage({
      key: `Disconnect ${provider.info.name}`,
      content: (
        <DisconnectWalletScreen
          provider={provider}
          onDisconnect={async (p) => {
            await handleDisconnect(p);
            popPage();
          }}
        />
      ),
      showTitle: false,
    });
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Screen navigation helpers
  // ─────────────────────────────────────────────────────────────────────────────

  const pushDesktopQRCodeScreen = (
    provider: WalletProvider,
    onSelectAllWallets?: () => Promise<void>,
  ) => {
    pushPage({
      key: "Connect WalletConnect",
      content: (
        <DesktopWalletConnectScreen
          provider={provider}
          onAction={handleAction}
          onDisconnect={handleDisconnect}
          onSelectAllWallets={onSelectAllWallets}
        />
      ),
    });
  };

  const pushDesktopChainSelector = (
    onSelectAllWallets?: () => Promise<void>,
  ) => {
    pushPage({
      key: `Select chain`,
      content: (
        <ExternalWalletChainSelector
          providers={providers}
          onDisconnect={isConnectMode ? pushDisconnectScreen : undefined}
          onSelect={async (provider) =>
            pushDesktopQRCodeScreen(provider, onSelectAllWallets)
          }
        />
      ),
    });
  };

  /** Mobile: Deep link screen to open wallet app */
  const pushMobileDeepLinkScreen = (provider: WalletProvider) => {
    pushPage({
      key: `Open app`,
      content: (
        <MobileWalletConnectScreen
          provider={provider}
          onConnect={async (p) => {
            await connectWalletAccount(p);
          }}
          onSign={
            mode === WalletSelectorMode.Auth
              ? async (p) => {
                  await loginOrSignupWithWallet({
                    walletProvider: p,
                    ...(sessionKey && { sessionKey }),
                  });
                }
              : undefined
          }
          onSelectQRCode={async (chain) => {
            // Fallback to QR code if deep link doesn't work
            const chainProvider = providers.find(
              (p) => p.chainInfo.namespace === chain,
            )!;
            pushDesktopQRCodeScreen(chainProvider);
          }}
        />
      ),
    });
  };

  /** Mobile: Show all WalletConnect-compatible apps */
  const pushMobileAppSelector = () => {
    pushPage({
      key: "Connect WalletConnect",
      content: (
        <ShowAllWalletsScreen
          onSelect={async (provider) => pushMobileDeepLinkScreen(provider)}
          onSelectQRCode={async () => pushDesktopChainSelector()}
        />
      ),
    });
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Flow selection
  // ─────────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    // Mobile flow: App list -> deep link to wallet app
    // Desktop flow: Chain selector -> QR code
    //
    // Exception: For "Connect Wallet" screen (disconnect possible),
    // always use desktop flow since it shows connection status.
    const useDesktopFlow = !isMobile || isConnected;

    // Pop the WalletConnectFlow page itself so the back button on the next
    // screen returns to the wallet list, not this empty orchestrator page.
    popPage();

    if (useDesktopFlow) {
      pushDesktopChainSelector(async () => {
        pushMobileAppSelector();
      });
    } else {
      pushMobileAppSelector();
    }
  }, []);

  // This component doesn't render anything - it just orchestrates navigation
  return null;
}

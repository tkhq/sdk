import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faQrcode } from "@fortawesome/free-solid-svg-icons";
import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import clsx from "clsx";
import {
  Chain,
  type WalletConnectAppEntry,
  type WalletProvider,
} from "@turnkey/core";
import { useModal } from "../../../providers/modal/Hook";
import { useTurnkey } from "../../../providers/client/Hook";
import { useWalletConnect } from "../../../providers/WalletConnectProvider";
import {
  findWalletConnectProvider,
  useDebouncedCallback,
} from "../../../utils/utils";
import { WalletButton, WALLET_BUTTON_HEIGHT } from "./WalletButton";
import { WalletConnectAppChainSelector } from "./WalletConnectAppChainSelector";
import { SearchInputBox } from "../../design/Inputs";
import { Spinner } from "../../design/Spinners";

interface ShowAllWalletsScreenProps {
  onSelect: (provider: WalletProvider) => Promise<void>;
  onSelectQRCode: () => Promise<void>;
}

const BUFFER_SIZE = 5; // Number of items to render outside visible area

export function ShowAllWalletsScreen(props: ShowAllWalletsScreenProps) {
  const { onSelect, onSelectQRCode } = props;
  const { walletProviders, disconnectWalletAccount } = useTurnkey();
  const { walletConnectApps, isLoadingApps } = useWalletConnect();
  const { isMobile, pushPage, popPage } = useModal();

  const [searchQuery, setSearchQuery] = useState("");
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 20 });
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // ─────────────────────────────────────────────────────────────────────────────
  // Data processing
  // ─────────────────────────────────────────────────────────────────────────────

  // Group wallet apps by id (same wallet across different chains)
  const grouped = useMemo(
    () =>
      walletConnectApps.reduce<Record<string, WalletConnectAppEntry[]>>(
        (acc, app) => {
          if (!acc[app.id]) acc[app.id] = [];
          acc[app.id]!.push(app);
          return acc;
        },
        {},
      ),
    [walletConnectApps],
  );

  // Filter by search query
  const walletEntries = useMemo(() => {
    const entries = Object.entries(grouped);
    if (!searchQuery.trim()) return entries;

    const query = searchQuery.toLowerCase();
    return entries.filter(([_, group]) => {
      const walletName = group[0]?.name?.toLowerCase() ?? "";
      return walletName.includes(query);
    });
  }, [grouped, searchQuery]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Selection handlers
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Merges WalletConnectAppEntry (display info) with the actual WalletProvider
   * and triggers selection. Disconnects any existing session first.
   */
  const selectApp = useCallback(
    async (targetApp: WalletConnectAppEntry) => {
      const provider = findWalletConnectProvider(
        walletProviders,
        targetApp.chain,
      );

      if (!provider) {
        // WalletConnect provider not ready - go back
        popPage();
        return;
      }

      // Disconnect existing session to avoid confusion
      if (provider.connectedAddresses.length > 0) {
        await disconnectWalletAccount(provider);
      }

      // Merge app display info with the actual provider
      const mergedProvider: WalletProvider = {
        ...provider,
        uri: targetApp.uri,
        info: {
          ...provider.info,
          name: targetApp.name,
          icon: targetApp.icon,
        },
      };

      await onSelect(mergedProvider);
    },
    [walletProviders, disconnectWalletAccount, onSelect, popPage],
  );

  const handleSelectGroup = useCallback(
    (group: WalletConnectAppEntry[]) => {
      if (group.length === 1) {
        selectApp(group[0]!);
      } else {
        pushPage({
          key: `Select chain`,
          content: (
            <WalletConnectAppChainSelector apps={group} onSelect={selectApp} />
          ),
        });
      }
    },
    [selectApp, pushPage],
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // Virtual scrolling
  // ─────────────────────────────────────────────────────────────────────────────

  const handleScroll = useDebouncedCallback(() => {
    if (!scrollContainerRef.current) return;

    const { scrollTop, clientHeight } = scrollContainerRef.current;

    const start = Math.max(
      0,
      Math.floor(scrollTop / WALLET_BUTTON_HEIGHT) - BUFFER_SIZE,
    );
    const end = Math.min(
      walletEntries.length,
      Math.ceil((scrollTop + clientHeight) / WALLET_BUTTON_HEIGHT) +
        BUFFER_SIZE,
    );

    setVisibleRange({ start, end });
  }, 50);

  // Reset scroll when search results change
  useEffect(() => {
    setVisibleRange({ start: 0, end: Math.min(20, walletEntries.length) });
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [walletEntries.length]);

  const debouncedSetSearch = useDebouncedCallback(
    (value: string) => setSearchQuery(value),
    300,
  );

  const visibleItems = useMemo(
    () => walletEntries.slice(visibleRange.start, visibleRange.end),
    [walletEntries, visibleRange],
  );

  const totalHeight = walletEntries.length * WALLET_BUTTON_HEIGHT;
  const offsetY = visibleRange.start * WALLET_BUTTON_HEIGHT;

  // ─────────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────────

  if (isLoadingApps) {
    return (
      <div className="flex flex-col items-center py-5">
        <Spinner strokeWidth={2} className="w-12 h-12" />
      </div>
    );
  }

  return (
    <div
      className={clsx(
        "flex flex-col mt-10 gap-3",
        isMobile ? "w-full" : "w-80",
      )}
    >
      <SearchInputBox
        value={searchQuery}
        onChange={debouncedSetSearch}
        onClear={() => setSearchQuery("")}
        placeholder="Search wallets..."
      />

      {/* Wallet List with Virtual Scrolling */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className={clsx(
          "min-h-42 overflow-y-auto tk-scrollbar p-0.5",
          isMobile ? "max-h-80" : "max-h-72", // We actually want a bit more height on mobile. Easier to scroll thru with finger. Large heights on desktop look weird
        )}
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
                icon={
                  <div className="flex items-center justify-center size-6 rounded-full text-icon-text-light dark:text-icon-text-dark bg-icon-background-light dark:bg-icon-background-dark">
                    <FontAwesomeIcon icon={faQrcode} />
                  </div>
                }
                name="Scan QR Code"
                chains={[
                  { namespace: Chain.Ethereum, isConnected: false },
                  { namespace: Chain.Solana, isConnected: false },
                ]}
                onClick={onSelectQRCode}
                isMobile={isMobile}
              />
            )}

            {/* Wallet Buttons */}
            {visibleItems.map(
              ([id, group]: [string, WalletConnectAppEntry[]]) => {
                const first = group[0];

                return (
                  <WalletButton
                    key={id}
                    icon={first?.icon ?? ""}
                    name={first?.name ?? ""}
                    chains={group.map((app) => ({
                      namespace: app.chain,
                      isConnected: false,
                    }))}
                    onClick={() => handleSelectGroup(group)}
                    shouldShowDisconnect={false}
                    isMobile={isMobile}
                  />
                );
              },
            )}
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

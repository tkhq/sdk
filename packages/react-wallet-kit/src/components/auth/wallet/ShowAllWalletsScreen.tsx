import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faQrcode } from "@fortawesome/free-solid-svg-icons";
import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import clsx from "clsx";
import { Chain, type WalletProvider } from "@turnkey/core";
import { useModal } from "../../../providers/modal/Hook";
import { useTurnkey } from "../../../providers/client/Hook";
import {
  findWalletConnectProvider,
  useDebouncedCallback,
} from "../../../utils/utils";
import { WalletButton, WALLET_BUTTON_HEIGHT } from "./WalletButton";
import { ExternalWalletChainSelector } from "./ExternalWalletChainSelector";
import { SearchInputBox } from "../../design/Inputs";

interface ShowAllWalletsScreenProps {
  onSelect: (targetApp: WalletProvider) => Promise<void>;
  onSelectQRCode: () => Promise<void>;
}

const BUFFER_SIZE = 5; // Number of items to render outside visible area

export function ShowAllWalletsScreen(props: ShowAllWalletsScreenProps) {
  const { onSelect, onSelectQRCode } = props;
  const { walletProviders, walletConnectApps, disconnectWalletAccount } =
    useTurnkey();
  const { isMobile, pushPage } = useModal();

  const [searchQuery, setSearchQuery] = useState("");
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 20 });
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Group wallets by uuid
  const grouped = useMemo(
    () =>
      walletConnectApps.reduce<Record<string, WalletProvider[]>>(
        (acc, provider) => {
          const uuid = provider.info.uuid!;
          if (!acc[uuid]) acc[uuid] = [];
          acc[uuid]!.push(provider);
          return acc;
        },
        {},
      ),
    [walletConnectApps],
  );

  // Convert to array and filter by search query
  const walletEntries = useMemo(() => {
    const entries = Object.entries(grouped);
    if (!searchQuery.trim()) return entries;

    const query = searchQuery.toLowerCase();
    return entries.filter(([_, group]) => {
      // Search by wallet name
      const walletName = group[0]?.info.name?.toLowerCase() ?? "";
      return walletName.includes(query);
    });
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
    [walletProviders, onSelect, pushPage],
  );

  // To make our lives easier and avoid confusing the end user, we always disconnect
  // the existing WalletConnect session before starting a new one.
  // Note that this doesn't happen for desktop wallet connecting (QR code or native browser extension)
  const disconnectAndSelect = async (targetApp: WalletProvider) => {
    const walletConnectProvider = findWalletConnectProvider(
      walletProviders,
      targetApp.chainInfo.namespace,
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
      Math.floor(scrollTop / WALLET_BUTTON_HEIGHT) - BUFFER_SIZE,
    );
    const end = Math.min(
      walletEntries.length,
      Math.ceil((scrollTop + containerHeight) / WALLET_BUTTON_HEIGHT) +
        BUFFER_SIZE,
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
    300,
  );

  const visibleItems = useMemo(
    () => walletEntries.slice(visibleRange.start, visibleRange.end),
    [walletEntries, visibleRange],
  );

  const totalHeight = walletEntries.length * WALLET_BUTTON_HEIGHT;
  const offsetY = visibleRange.start * WALLET_BUTTON_HEIGHT;

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

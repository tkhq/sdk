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
import { WalletButton } from "./WalletButton";
import { WalletConnectAppChainSelector } from "./WalletConnectAppChainSelector";
import { SearchInputBox } from "../../design/Inputs";
import { Spinner } from "../../design/Spinners";
import { BUFFER_SIZE, INITIAL_VISIBLE_ROWS, ROW_STRIDE } from "./constants";
import { WalletButtonSkeleton } from "./WalletButtonSkeleton";

type RowRange = { start: number; end: number };

const sameRange = (a: RowRange, b: RowRange) =>
  a.start === b.start && a.end === b.end;

interface ShowAllWalletsScreenProps {
  onSelect: (provider: WalletProvider) => Promise<void>;
  onSelectQRCode: () => Promise<void>;
}

export function ShowAllWalletsScreen(props: ShowAllWalletsScreenProps) {
  const { onSelect, onSelectQRCode } = props;
  const { walletProviders, disconnectWalletAccount } = useTurnkey();
  const { walletConnectApps, isLoadingApps } = useWalletConnect();
  const { isMobile, pushPage, popPage } = useModal();

  const [searchQuery, setSearchQuery] = useState("");
  // renderRange (buffered, debounced) governs which real WalletButtons are mounted.
  // viewportRange (unbuffered, rAF-synchronous) governs the skeleton layer behind them.
  const [renderRange, setRenderRange] = useState<RowRange>({
    start: 0,
    end: INITIAL_VISIBLE_ROWS,
  });
  const [viewportRange, setViewportRange] = useState<RowRange>({
    start: 0,
    end: INITIAL_VISIBLE_ROWS,
  });
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const rafIdRef = useRef<number | null>(null);

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

  // The QR-code row takes the slot at global row 0 when not searching.
  // renderRange/viewportRange are in *global* row indices, so wallet entry i
  // lives at global row (qrRowCount + i).
  const qrRowCount = searchQuery ? 0 : 1;
  const totalRows = walletEntries.length + qrRowCount;

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

  const computeRange = useCallback(
    (buffer: number): RowRange | null => {
      if (!scrollContainerRef.current) return null;
      const { scrollTop, clientHeight } = scrollContainerRef.current;
      return {
        start: Math.max(0, Math.floor(scrollTop / ROW_STRIDE) - buffer),
        end: Math.min(
          totalRows,
          Math.ceil((scrollTop + clientHeight) / ROW_STRIDE) + buffer,
        ),
      };
    },
    [totalRows],
  );

  const handleScroll = useDebouncedCallback(() => {
    const next = computeRange(BUFFER_SIZE);
    if (next) setRenderRange((prev) => (sameRange(prev, next) ? prev : next));
  }, 50);

  const onScroll = useCallback(() => {
    if (rafIdRef.current === null) {
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null;
        const next = computeRange(0);
        if (next)
          setViewportRange((prev) => (sameRange(prev, next) ? prev : next));
      });
    }
    handleScroll();
  }, [computeRange, handleScroll]);

  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  // Reset scroll when search results change (or QR row toggles)
  useEffect(() => {
    const initial: RowRange = {
      start: 0,
      end: Math.min(INITIAL_VISIBLE_ROWS, totalRows),
    };
    setRenderRange(initial);
    setViewportRange(initial);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [totalRows]);

  const debouncedSetSearch = useDebouncedCallback(
    (value: string) => setSearchQuery(value),
    300,
  );

  // renderRange is in global row indices; subtract qrRowCount to slice walletEntries
  const visibleItems = useMemo(() => {
    const sliceStart = Math.max(0, renderRange.start - qrRowCount);
    const sliceEnd = Math.max(0, renderRange.end - qrRowCount);
    return walletEntries.slice(sliceStart, sliceEnd);
  }, [walletEntries, renderRange, qrRowCount]);

  const totalHeight = totalRows * ROW_STRIDE;
  const offsetY = renderRange.start * ROW_STRIDE;

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
        onScroll={onScroll}
        className={clsx(
          "min-h-42 overflow-y-auto tk-scrollbar p-0.5",
          isMobile ? "max-h-80" : "max-h-72", // We actually want a bit more height on mobile. Easier to scroll thru with finger. Large heights on desktop look weird
        )}
      >
        <div style={{ height: totalHeight, position: "relative" }}>
          {/* Skeleton layer - sync with viewport via rAF, covered by real items once renderRange catches up */}
          <div
            style={{
              transform: `translateY(${viewportRange.start * ROW_STRIDE}px)`,
              position: "absolute",
              width: "100%",
            }}
            className="flex flex-col gap-2"
            aria-hidden="true"
          >
            {Array.from({
              length: Math.max(0, viewportRange.end - viewportRange.start),
            }).map((_, i) => (
              <WalletButtonSkeleton
                key={`skeleton-${viewportRange.start + i}`}
              />
            ))}
          </div>
          <div
            style={{
              transform: `translateY(${offsetY}px)`,
              position: "absolute",
              width: "100%",
            }}
            className="flex flex-col gap-2"
          >
            {/* QR Code option always on top (only when not searching) */}
            {qrRowCount > 0 && renderRange.start === 0 && (
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

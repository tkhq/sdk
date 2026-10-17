import { useEffect, useState } from "react";
import {
  buildWalletConnectAppEntries,
  type WalletConnectAppEntry,
} from "@turnkey/react-native-wallet-kit";
import { TURNKEY_CONFIG } from "@/constants/turnkey";

const walletConfig = TURNKEY_CONFIG.walletConfig;
const namespaces = [
  ...(walletConfig?.chains.ethereum?.walletConnectNamespaces ?? []),
  ...(walletConfig?.chains.solana?.walletConnectNamespaces ?? []),
];

// apps without a mobile link are skipped since there's no QR fallback on mobile
async function buildEntries(
  projectId: string,
): Promise<WalletConnectAppEntry[]> {
  const entries = await buildWalletConnectAppEntries(projectId, namespaces);
  return entries.filter((entry) => entry.uri);
}

// cache so the directory is only fetched once
let entriesPromise: Promise<WalletConnectAppEntry[]> | undefined;

export function useWalletConnectApps() {
  const [walletConnectApps, setWalletConnectApps] = useState<
    WalletConnectAppEntry[]
  >([]);
  const [isLoadingApps, setIsLoadingApps] = useState(true);

  useEffect(() => {
    const projectId = walletConfig?.walletConnect?.projectId;
    if (!projectId) {
      setIsLoadingApps(false);
      return;
    }

    entriesPromise ??= buildEntries(projectId).catch((error) => {
      entriesPromise = undefined;
      throw error;
    });

    let cancelled = false;
    entriesPromise
      .then((entries) => !cancelled && setWalletConnectApps(entries))
      .catch((error) => console.error("Failed to load wallet list:", error))
      .finally(() => !cancelled && setIsLoadingApps(false));

    return () => {
      cancelled = true;
    };
  }, []);

  return { walletConnectApps, isLoadingApps };
}

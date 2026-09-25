import { useEffect, useState } from "react";
import {
  Chain,
  fetchWalletConnectApps,
  type WalletConnectAppEntry,
} from "@turnkey/react-native-wallet-kit";
import { TURNKEY_CONFIG } from "@/constants/turnkey";

const walletConfig = TURNKEY_CONFIG.walletConfig;
const CHAIN_NAMESPACES: [Chain, string[]][] = [
  [
    Chain.Ethereum,
    walletConfig?.chains.ethereum?.walletConnectNamespaces ?? [],
  ],
  [Chain.Solana, walletConfig?.chains.solana?.walletConnectNamespaces ?? []],
];

// unlike buildWalletConnectAppEntries: one entry per supported chain, skip apps with no mobile link
async function buildEntries(
  projectId: string,
): Promise<WalletConnectAppEntry[]> {
  const apps = await fetchWalletConnectApps(projectId);

  return apps.flatMap((app) => {
    const uri = app.mobile?.native || app.mobile?.universal;
    if (!uri) return [];

    return CHAIN_NAMESPACES.filter(
      ([, namespaces]) =>
        namespaces.length > 0 &&
        namespaces.every((ns) => app.chains.includes(ns)),
    ).map(([chain]) => ({
      id: app.id,
      name: app.name,
      icon: app.image_url?.md ?? "",
      uri,
      chain,
    }));
  });
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

"use client";

import {
  createContext,
  useContext as useReactContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import type { WalletProvider } from "@turnkey/core";
import { buildWalletConnectProviders } from "../utils/utils";
import { useTurnkey } from "./client/Hook";

interface WalletConnectState {
  /** List of WalletConnect-compatible wallet apps (for mobile deep linking) */
  walletConnectApps: WalletProvider[];
  /** Whether we're currently fetching wallet apps */
  isLoadingApps: boolean;
}

const initialState: WalletConnectState = {
  walletConnectApps: [],
  isLoadingApps: false,
};

export type WalletConnectContextType = WalletConnectState;

const WalletConnectContext = createContext<WalletConnectContextType | null>(
  null,
);

interface WalletConnectProviderProps {
  children: ReactNode;
}

/**
 * @internal
 * WalletConnectProvider provides context for WalletConnect wallet apps.
 *
 * Automatically fetches wallet apps on mount using the projectId from config.
 * This is an internal provider - not exported as part of the public API.
 */
export function WalletConnectProvider({
  children,
}: WalletConnectProviderProps) {
  const { config } = useTurnkey();
  const projectId = config?.walletConfig?.walletConnect?.projectId;

  const [state, setState] = useState<WalletConnectState>(initialState);

  const fetchWalletConnectApps = useCallback(async (pid: string) => {
    setState((s) => ({ ...s, isLoadingApps: true }));
    try {
      const apps = await buildWalletConnectProviders({ projectId: pid });
      setState({ walletConnectApps: apps, isLoadingApps: false });
    } catch {
      setState((s) => ({ ...s, isLoadingApps: false }));
    }
  }, []);

  // Auto-fetch wallet apps on mount if projectId is available
  useEffect(() => {
    if (projectId) {
      fetchWalletConnectApps(projectId);
    }
  }, [projectId, fetchWalletConnectApps]);

  return (
    <WalletConnectContext.Provider value={state}>
      {children}
    </WalletConnectContext.Provider>
  );
}

export function useWalletConnect(): WalletConnectContextType {
  const ctx = useReactContext(WalletConnectContext);
  if (!ctx) {
    throw new Error(
      "useWalletConnect must be used within WalletConnectProvider.",
    );
  }
  return ctx;
}

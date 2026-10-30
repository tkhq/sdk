"use client";

import {
  createContext,
  useCallback,
  useContext as useReactContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { TListSupportedAssetsBody, v1AssetMetadata } from "@turnkey/core";
import { useTurnkey } from "./client/Hook";

type Caip2 = TListSupportedAssetsBody["caip2"];

const assetsCache = new Map<Caip2, v1AssetMetadata[]>();
const inflight = new Map<Caip2, Promise<void>>();

function cacheSnapshot(): Record<string, v1AssetMetadata[]> {
  return Object.fromEntries(assetsCache);
}

interface SupportedAssetsState {
  assetsByCaip2: Record<string, v1AssetMetadata[]>;
  ensureAssets: (caip2s: Caip2[]) => Promise<void>;
}

const SupportedAssetsContext = createContext<SupportedAssetsState | null>(null);

/**
 * @internal
 * Caches `listSupportedAssets` results in memory for the page session.
 * A chain is fetched once, then reused. Later chains are added to the same map.
 */
export function SupportedAssetsProvider({ children }: { children: ReactNode }) {
  const { httpClient } = useTurnkey();
  const mounted = useRef(true);
  const [assetsByCaip2, setAssetsByCaip2] = useState(cacheSnapshot);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const ensureAssets = useCallback(
    async (caip2s: Caip2[]) => {
      if (!httpClient) return;

      const missing = caip2s.filter((caip2) => !assetsCache.has(caip2));
      if (missing.length === 0) return;

      await Promise.all(
        missing.map(async (caip2) => {
          let pending = inflight.get(caip2);
          if (!pending) {
            pending = httpClient
              .listSupportedAssets({ caip2 })
              .then((response) => {
                assetsCache.set(caip2, response.assets ?? []);
              })
              .finally(() => {
                inflight.delete(caip2);
              });
            inflight.set(caip2, pending);
          }
          await pending.catch(() => undefined);
        }),
      );

      if (mounted.current) setAssetsByCaip2(cacheSnapshot());
    },
    [httpClient],
  );

  return (
    <SupportedAssetsContext.Provider value={{ assetsByCaip2, ensureAssets }}>
      {children}
    </SupportedAssetsContext.Provider>
  );
}

export function useSupportedAssets(): SupportedAssetsState {
  const ctx = useReactContext(SupportedAssetsContext);
  if (!ctx) {
    throw new Error(
      "useSupportedAssets must be used within SupportedAssetsProvider.",
    );
  }
  return ctx;
}

import { Session, TurnkeyError, TurnkeyErrorCodes } from "@turnkey/sdk-types";
import {
  StamperType,
  TurnkeyActivityConsensusNeededError,
  TurnkeyActivityError,
  buildWalletConnectAppEntries as buildCoreWalletConnectAppEntries,
} from "@turnkey/core";
import type {
  Wallet,
  WalletConnectAppEntry,
  WalletProvider,
} from "@turnkey/core";
import { useCallback, useRef, useState } from "react";

export const SESSION_WARNING_THRESHOLD_MS = 60 * 1000; // 1 minute in milliseconds

export const authErrors = {
  // Passkey-related errors
  passkey: {
    createFailed: "Passkey not created. Please try again.",
    loginFailed: "Failed to login with passkey. Please try again.",
    timeoutOrNotAllowed:
      "The operation either timed out or was not allowed. Please try again.",
  },

  // OTP-related errors
  otp: {
    sendFailed: "Failed to send OTP",
    invalidEmail: "Invalid email address.",
    invalidPhone: "Invalid phone number.",
  },

  // OAuth-related errors
  oauth: {
    loginFailed: "Failed to login with OAuth provider",
  },

  // Sub-organization-related errors
  suborg: {
    fetchFailed: "Failed to fetch account",
    createFailed: "Failed to create account.",
  },
};

export const useDebouncedCallback = <T extends (...args: any[]) => void>(
  fn: T,
  wait = 100,
): T => {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  return useCallback(
    (...args: any[]) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        fnRef.current(...(args as Parameters<T>));
        timer.current = null;
      }, wait);
    },
    [wait],
  ) as T;
};

export const isValidSession = (session?: Session | undefined): boolean => {
  return session?.expiry !== undefined && session.expiry * 1000 > Date.now();
};

// Use the session key for internal refreshes so they don't prompt the user.
// Falls back to the caller's stamper when there's no session.
export const resolveRefreshStamper = (
  session: Session | undefined,
  stampWith?: StamperType,
): StamperType | undefined =>
  isValidSession(session) ? StamperType.ApiKey : stampWith;

export async function withTurnkeyErrorHandling<T>(
  fn: () => Promise<T>,
  sessionExpireFn?: () => Promise<void>,
  callbacks?: { onError?: (error: TurnkeyError) => void },
  fallbackMessage = "An unknown error occurred",
  fallbackCode = TurnkeyErrorCodes.UNKNOWN,
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    let tkError: TurnkeyError;

    if (
      error instanceof TurnkeyActivityError ||
      error instanceof TurnkeyActivityConsensusNeededError
    ) {
      throw error;
    }

    if (error instanceof TurnkeyError) {
      tkError = error;

      if (tkError.code === TurnkeyErrorCodes.SESSION_EXPIRED) {
        await sessionExpireFn?.();
      }

      // skip onError for WalletConnect expired errors
      if (tkError.code !== TurnkeyErrorCodes.WALLET_CONNECT_EXPIRED) {
        callbacks?.onError?.(tkError);
      }

      throw tkError;
    }

    // we wrap non-Turnkey errors
    tkError = new TurnkeyError(fallbackMessage, fallbackCode, error);
    callbacks?.onError?.(tkError);
    throw tkError;
  }
}

export function mergeWalletsWithoutDuplicates(
  existingWallets: Wallet[],
  newWallets: Wallet[],
): Wallet[] {
  const existingWalletIds = new Set(existingWallets.map((w) => w.walletId));
  const uniqueNewWallets = newWallets.filter(
    (w) => !existingWalletIds.has(w.walletId),
  );
  return [...existingWallets, ...uniqueNewWallets];
}

export function useWalletProviderState(initialState: WalletProvider[] = []) {
  const [walletProviders, setWalletProviders] =
    useState<WalletProvider[]>(initialState);
  const prevProvidersRef = useRef<WalletProvider[]>(initialState);

  function isSameWalletProvider(a: WalletProvider[], b: WalletProvider[]) {
    if (a.length !== b.length) return false;

    const key = (provider: WalletProvider) => {
      const name = provider.info.name;
      const namespace = provider.chainInfo.namespace;
      const interfaceType = provider.interfaceType;
      const connectedAddresses = [...provider.connectedAddresses]
        .map((x) => x.toLowerCase())
        .sort()
        .join(",");
      const uri = provider.uri || "";
      const isLoading = provider.isLoading ? "1" : "0";
      return `${namespace}|${interfaceType}|${name}|${connectedAddresses}|${uri}|${isLoading}`;
    };

    const A = a.map(key).sort();
    const B = b.map(key).sort();
    for (let i = 0; i < A.length; i++) if (A[i] !== B[i]) return false;
    return true;
  }

  const updateWalletProviders = useCallback(
    (newProviders: WalletProvider[]) => {
      if (!isSameWalletProvider(prevProvidersRef.current, newProviders)) {
        prevProvidersRef.current = newProviders;
        setWalletProviders(newProviders);
      }
      // we do nothing if the wallet providers are the same
    },
    [],
  );

  return [walletProviders, updateWalletProviders] as const;
}

/**
 * Builds the list of WalletConnect wallet apps to show in a wallet picker.
 *
 * - Same as `buildWalletConnectAppEntries` from `@turnkey/core`, but only keeps
 *   wallets with a mobile deep link, since there's no QR code fallback on mobile.
 *
 * @param projectId - WalletConnect project ID.
 * @param namespaces - CAIP-2 namespaces to offer wallets for (e.g. "eip155:1").
 * @returns The wallet apps that can be opened on this device.
 */
export async function buildWalletConnectAppEntries(
  projectId: string,
  namespaces: string[],
): Promise<WalletConnectAppEntry[]> {
  const entries = await buildCoreWalletConnectAppEntries(projectId, namespaces);
  return entries.filter((entry) => entry.uri);
}

import { Session, TurnkeyError, TurnkeyErrorCodes } from "@turnkey/sdk-types";
import { useCallback, useRef, useState, useEffect } from "react";
import {
  type Wallet,
  WalletProvider,
  WalletInterfaceType,
} from "@turnkey/core";

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

  // Wallet-related errors
  wallet: {
    loginFailed: "Failed to login with wallet",
    noPublicKey: "No public key found",
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

    if (error instanceof TurnkeyError) {
      tkError = error;

      if (tkError.code === TurnkeyErrorCodes.SESSION_EXPIRED) {
        if (sessionExpireFn) {
          await sessionExpireFn();
        } else {
          // this should never happen. If it does, it means an SDK function is making
          // a session-based API call without providing a `sessionExpireFn()` for handling
          // SESSION_EXPIRED errors in `withTurnkeyErrorHandling()`
          throw new TurnkeyError(
            "SESSION_EXPIRED received without sessionExpireFn handler",
            TurnkeyErrorCodes.INTERNAL_ERROR,
            error,
          );
        }
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

// Custom hook to get the current screen size
export function useScreenSize() {
  const [width, setWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1024,
  );
  const [height, setHeight] = useState(
    typeof window !== "undefined" ? window.innerHeight : 768,
  );

  useEffect(() => {
    const handleResize = () => {
      setWidth(window.innerWidth);
      setHeight(window.innerHeight);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return {
    width,
    height,

    // I have no idea why but, Tailwind's responsive design breakpoints do not work. Throughout the modal components, you will see conditional styling using this `isMobile` variable.
    // This is fine since we only need to style for 2 screen sizes: mobile and desktop. If anyone can figure out why Tailwind's responsive design breakpoints do not work, please fix it and restyle the components accordingly, changing the `isMobile` to the Tailwind stuff when applicable.
    isMobile: width < 640,
  };
}

export function isWalletConnect(wallet: WalletProvider): boolean {
  return wallet.interfaceType == WalletInterfaceType.WalletConnect;
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
      return `${namespace}|${interfaceType}|${name}|${connectedAddresses}|${uri}`;
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

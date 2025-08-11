import { Session, TurnkeyError, TurnkeyErrorCodes } from "@turnkey/sdk-types";
import type { TurnkeyCallbacks } from "./types/base";
import { useCallback, useRef, useState, useEffect } from "react";
import { WalletInterfaceType, WalletProvider } from "@turnkey/core";

export const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const APPLE_AUTH_URL = "https://account.apple.com/auth/authorize";
export const APPLE_AUTH_SCRIPT_URL =
  "https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js";
export const FACEBOOK_AUTH_URL = "https://www.facebook.com/v11.0/dialog/oauth";
export const FACEBOOK_GRAPH_URL =
  "https://graph.facebook.com/v11.0/oauth/access_token";
export const popupWidth = 500;
export const popupHeight = 600;

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

  return useCallback(
    ((...args: any[]) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        fn(...args);
        timer.current = null;
      }, wait);
    }) as T,
    [fn, wait],
  );
};

export const isValidSession = (session?: Session | undefined): boolean => {
  return session?.expiry !== undefined && session.expiry * 1000 > Date.now();
};

export async function withTurnkeyErrorHandling<T>(
  fn: () => Promise<T>,
  callbacks?: { onError?: (error: TurnkeyError) => void },
  fallbackMessage = "An unknown error occurred",
  fallbackCode = TurnkeyErrorCodes.UNKNOWN,
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof TurnkeyError) {
      callbacks?.onError?.(error);
      throw error;
    }
    const tkError = new TurnkeyError(fallbackMessage, fallbackCode, error);
    callbacks?.onError?.(tkError);
    throw tkError;
  }
}

// Helper function to parse Apple OAuth redirects
function parseAppleOAuthRedirect(hash: string): {
  idToken: string | null | undefined;
  provider: string | null;
  flow: string | null;
  publicKey: string | null;
  openModal: string | null;
} {
  // Apple's format has unencoded parameters in the state portion
  const idTokenMatch = hash.match(/id_token=([^&]+)$/);
  const idToken = idTokenMatch ? idTokenMatch[1] : null;

  // Extract state parameters - state is at the beginning
  // It typically looks like: state=provider=apple&flow=redirect&publicKey=123...&openModal=true&code=...&id_token=...
  const stateEndIndex = hash.indexOf("&code=");
  if (stateEndIndex === -1)
    return {
      idToken,
      provider: null,
      flow: null,
      publicKey: null,
      openModal: null,
    };

  const stateContent = hash.substring(6, stateEndIndex); // Remove "state=" prefix
  const stateParams = new URLSearchParams(stateContent);

  return {
    idToken,
    provider: stateParams.get("provider"),
    flow: stateParams.get("flow"),
    publicKey: stateParams.get("publicKey"),
    openModal: stateParams.get("openModal"),
  };
}

// Helper function to parse Google OAuth redirects
function parseGoogleOAuthRedirect(hash: string): {
  idToken: string | null;
  provider: string | null;
  flow: string | null;
  publicKey: string | null;
  openModal: string | null;
} {
  const hashParams = new URLSearchParams(hash);
  const idToken = hashParams.get("id_token");
  const state = hashParams.get("state");

  let provider = null;
  let flow = null;
  let publicKey = null;
  let openModal = null;

  if (state) {
    const stateParams = new URLSearchParams(state);
    provider = stateParams.get("provider");
    flow = stateParams.get("flow");
    publicKey = stateParams.get("publicKey");
    openModal = stateParams.get("openModal");
  }

  return {
    idToken,
    provider,
    flow,
    publicKey,
    openModal,
  };
}

// Main function to determine provider and parse accordingly
export function parseOAuthRedirect(hash: string): {
  idToken: string | null | undefined;
  provider: string | null;
  flow: string | null;
  publicKey: string | null;
  openModal: string | null;
} {
  // Check if this is an Apple redirect
  if (hash.startsWith("state=provider=apple")) {
    return parseAppleOAuthRedirect(hash);
  } else {
    return parseGoogleOAuthRedirect(hash);
  }
}

// Function to generate PKCE challenge pair for Facebook OAuth
export async function generateChallengePair(): Promise<{
  verifier: string;
  codeChallenge: string;
}> {
  const randomBytes = new Uint8Array(32);
  window.crypto.getRandomValues(randomBytes);
  const verifier = btoa(String.fromCharCode(...randomBytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await window.crypto.subtle.digest("SHA-256", data);

  const base64Challenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  return { verifier, codeChallenge: base64Challenge };
}

// Function to exchange Facebook authorization code for token
export async function exchangeCodeForToken(
  clientId: string,
  redirectUri: string,
  code: string,
  codeVerifier: string,
): Promise<{ id_token: string }> {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
    code: code,
    grant_type: "authorization_code",
  });

  const response = await fetch(FACEBOOK_GRAPH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(
      `Facebook token exchange failed: ${JSON.stringify(errorData)}`,
    );
  }

  return await response.json();
}

export async function handleFacebookPKCEFlow({
  code,
  publicKey,
  openModal,
  clientId,
  redirectURI,
  callbacks,
  completeOauth,
  onPushPage,
}: {
  code: string;
  publicKey: string;
  openModal?: string | null;
  clientId: string;
  redirectURI: string;
  callbacks?: TurnkeyCallbacks | undefined;
  completeOauth: (params: {
    oidcToken: string;
    publicKey: string;
  }) => Promise<string>;
  onPushPage: (idToken: string) => void;
}): Promise<void> {
  // Retrieve the verifier stored during OAuth initiation
  const verifier = sessionStorage.getItem("facebook_verifier");
  if (!verifier) {
    throw new TurnkeyError(
      "Missing PKCE verifier for Facebook authentication",
      TurnkeyErrorCodes.OAUTH_SIGNUP_ERROR,
    );
  }

  try {
    // Exchange the code for a token
    const tokenData = await exchangeCodeForToken(
      clientId,
      redirectURI,
      code,
      verifier,
    );

    // Clean up the verifier as it's no longer needed
    sessionStorage.removeItem("facebook_verifier");

    // Handle different UI flows based on openModal parameter
    if (openModal === "true") {
      onPushPage(tokenData.id_token);
    } else if (callbacks?.onOauthRedirect) {
      callbacks.onOauthRedirect({
        idToken: tokenData.id_token,
        publicKey,
      });
    } else {
      await completeOauth({
        oidcToken: tokenData.id_token,
        publicKey,
      });
    }

    // Clean up the URL after processing
    window.history.replaceState(null, document.title, window.location.pathname);

    return;
  } catch (error) {
    console.error("Error exchanging Facebook code for token:", error);
    throw new TurnkeyError(
      "Failed to complete Facebook authentication",
      TurnkeyErrorCodes.OAUTH_SIGNUP_ERROR,
      error,
    );
  }
}

// Custom hook to get the current screen size
export function useScreenSize() {
  const [width, setWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1024,
  );

  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return {
    width,

    // I have no idea why but, Tailwind's responsive design breakpoints do not work. Throughout the modal components, you will see conditional styling using this `isMobile` variable.
    // This is fine since we only need to style for 2 screen sizes: mobile and desktop. If anyone can figure out why Tailwind's responsive design breakpoints do not work, please fix it and restyle the components accordingly, changing the `isMobile` to the Tailwind stuff when applicable.
    isMobile: width < 640,
  };
}

export function isWalletConnect(wallet: WalletProvider): boolean {
  return wallet.interfaceType == WalletInterfaceType.WalletConnect;
}

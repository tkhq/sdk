import  {
  Session,
  TurnkeyError,
  TurnkeyErrorCodes,
} from "@turnkey/sdk-types";
import { useCallback, useRef } from "react";
import { sha256 } from "@noble/hashes/sha256";
import { stringToBase64urlString } from "@turnkey/encoding";

export const DISCORD_AUTH_URL = "https://discord.com/oauth2/authorize";
export const X_AUTH_URL = "https://x.com/i/oauth2/authorize";
export const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const APPLE_AUTH_URL = "https://account.apple.com/auth/authorize";
export const APPLE_AUTH_SCRIPT_URL =
  "https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js";
export const FACEBOOK_AUTH_URL = "https://www.facebook.com/v23.0/dialog/oauth";
export const FACEBOOK_GRAPH_URL =
  "https://graph.facebook.com/v23.0/oauth/access_token";

export const TURNKEY_OAUTH_ORIGIN_URL =  "https://oauth-origin.turnkey.com";
export const TURNKEY_OAUTH_REDIRECT_URL = "https:// oauth-redirect.turnkey.com";

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
  
  export async function withTurnkeyErrorHandling<T>(
    fn: () => Promise<T>,
    sessionExpireFn: () => Promise<void>,
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
          await sessionExpireFn();
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
  
  // Helper function to parse Apple OAuth redirects
  function parseAppleOAuthRedirect(hash: string): {
    idToken: string | null | undefined;
    provider: string | null;
    flow: string | null;
    publicKey: string | null;
    openModal: string | null;
    sessionKey: string | null;
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
        sessionKey: null,
      };
  
    const stateContent = hash.substring(6, stateEndIndex); // Remove "state=" prefix
    const stateParams = new URLSearchParams(stateContent);
  
    return {
      idToken,
      provider: stateParams.get("provider"),
      flow: stateParams.get("flow"),
      publicKey: stateParams.get("publicKey"),
      openModal: stateParams.get("openModal"),
      sessionKey: stateParams.get("sessionKey"),
    };
  }
  
  // Helper function to parse Google OAuth redirects
  function parseGoogleOAuthRedirect(hash: string): {
    idToken: string | null;
    provider: string | null;
    flow: string | null;
    publicKey: string | null;
    openModal: string | null;
    sessionKey: string | null;
  } {
    const hashParams = new URLSearchParams(hash);
    const idToken = hashParams.get("id_token");
    const state = hashParams.get("state");
  
    let provider = null;
    let flow = null;
    let publicKey = null;
    let openModal = null;
    let sessionKey = null;
  
    if (state) {
      const stateParams = new URLSearchParams(state);
      provider = stateParams.get("provider");
      flow = stateParams.get("flow");
      publicKey = stateParams.get("publicKey");
      openModal = stateParams.get("openModal");
      sessionKey = stateParams.get("sessionKey");
    }
  
    return {
      idToken,
      provider,
      flow,
      publicKey,
      openModal,
      sessionKey,
    };
  }
  
  // Main function to determine provider and parse accordingly
  export function parseOAuthRedirect(hash: string): {
    idToken: string | null | undefined;
    provider: string | null;
    flow: string | null;
    publicKey: string | null;
    openModal: string | null;
    sessionKey: string | null;
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
    // Generate verifier from 32 random bytes
    const randomBytes = new Uint8Array(32);
    // eslint-disable-next-line no-undef
    crypto.getRandomValues(randomBytes);
    const randomAsBinary = String.fromCharCode(...randomBytes);
    const verifier = stringToBase64urlString(randomAsBinary);

    // Compute SHA-256 over ASCII(verifier), then base64url encode
    const ascii = new TextEncoder().encode(verifier);
    const digest = sha256(ascii);
    const digestAsBinary = String.fromCharCode(...digest);
    const codeChallenge = stringToBase64urlString(digestAsBinary);

    return { verifier, codeChallenge };
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
  
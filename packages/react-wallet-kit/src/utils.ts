import { Session, TurnkeyError, TurnkeyErrorCodes } from "@turnkey/sdk-types";

export const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const APPLE_AUTH_URL = "https://appleid.apple.com/auth/authorize";
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

export enum OtpType {
  Email = "OTP_TYPE_EMAIL",
  Sms = "OTP_TYPE_SMS",
}

export enum FilterType {
  Email = "EMAIL",
  PhoneNumber = "PHONE_NUMBER",
  OidcToken = "OIDC_TOKEN",
  PublicKey = "PUBLIC_KEY",
}

export enum AuthState {
  Unauthenticated = "unauthenticated",
  Loading = "loading",
  Authenticated = "authenticated",
  Ready = "ready",
}

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
    console.log("Executing withTurnkeyErrorHandling");
    return await fn();
  } catch (error) {
    console.log("Error in withTurnkeyErrorHandling:", error);
    if (error instanceof TurnkeyError) {
      callbacks?.onError?.(error);
      throw error;
    }
    const tkError = new TurnkeyError(fallbackMessage, fallbackCode, error);
    callbacks?.onError?.(tkError);
    throw tkError;
  }
}

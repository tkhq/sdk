import type { CreateSubOrgParams, TurnkeySDKClientConfig } from "@turnkey/core";
import type {
  AuthAction,
  Session,
  TurnkeyError,
  TurnkeyNetworkError,
} from "@turnkey/sdk-types";

export interface TurnkeyCallbacks {
  onOauthRedirect?: (response: {
    idToken: string;
    publicKey: string;
    sessionKey?: string;
  }) => void;
  beforeSessionExpiry?: (params: { sessionKey: string }) => void;
  onSessionExpired?: (params: { sessionKey: string }) => void;
  onAuthenticationSuccess?: (params: {
    session: Session | undefined;
    action: AuthAction;
    method: AuthMethod;
    identifier: string;
  }) => void;
  onError?: (error: TurnkeyError | TurnkeyNetworkError) => void;
}

/**
 * Configuration for the TurnkeyProvider.
 * This interface extends the TurnkeySDKClientConfig to include additional UI and auth configurations.
 * It is used to initialize the TurnkeyProvider with various options such as colors, dark mode, auth methods, and more.
 *
 * @interface TurnkeyProviderConfig
 * @extends {TurnkeySDKClientConfig}
 */
export interface TurnkeyProviderConfig extends TurnkeySDKClientConfig {
  /** configuration for authentication methods. */
  auth?: {
    /** enables or disables specific authentication methods. */
    methods?: {
      emailOtpAuthEnabled?: boolean;
      smsOtpAuthEnabled?: boolean;
      passkeyAuthEnabled?: boolean;
      walletAuthEnabled?: boolean;
      googleOauthEnabled?: boolean;
      appleOauthEnabled?: boolean;
      xOauthEnabled?: boolean;
      discordOauthEnabled?: boolean;
      facebookOauthEnabled?: boolean;
    };
    /** order of authentication methods. */
    methodOrder?: Array<"socials" | "email" | "sms" | "passkey" | "wallet">;
    /** order of OAuth authentication methods. */
    oauthOrder?: Array<"google" | "apple" | "facebook" | "x" | "discord">;
    /** configuration for OAuth authentication. */
    oauthConfig?: {
      /** redirect URI for OAuth. */
      oauthRedirectUri?: string;
      /** client ID for Google OAuth. */
      googleClientId?: string;
      /** client ID for Apple OAuth. */
      appleClientId?: string;
      /** client ID for Facebook OAuth. */
      facebookClientId?: string;
      /** client ID for X (formerly Twitter) OAuth. */
      xClientId?: string;
      /** client ID for Discord OAuth. */
      discordClientId?: string;
      /** whether to open OAuth in the same page. Always true on mobile. */
      openOauthInPage?: boolean;
    };
    /** session expiration time in seconds. */
    sessionExpirationSeconds?: string;
    /** parameters for creating a sub-organization for each authentication method. */
    createSuborgParams?: {
      /** parameters for email OTP authentication. */
      emailOtpAuth?: CreateSubOrgParams;
      /** parameters for SMS OTP authentication. */
      smsOtpAuth?: CreateSubOrgParams;
      /** parameters for passkey authentication. */
      passkeyAuth?: CreateSubOrgParams & { passkeyName?: string };
      /** parameters for wallet authentication. */
      walletAuth?: CreateSubOrgParams;
      /** parameters for OAuth authentication. */
      oauth?: CreateSubOrgParams;
    };
    /** whether to automatically refresh the session. */
    autoRefreshSession?: boolean;
  };
  /** UI configuration for React Native. */
  ui?: {
    /** enables or disables dark mode. */
    darkMode?: boolean;
    /** theme configuration. */
    theme?: {
      /** primary color. */
      primaryColor?: string;
      /** background color. */
      backgroundColor?: string;
      /** text color. */
      textColor?: string;
    };
  };
}

/**
 * Enum representing the authentication states of the user.
 * - Unauthenticated: The user is not authenticated.
 * - Authenticated: The user is authenticated.
 */
export enum AuthState {
  Unauthenticated = "unauthenticated",
  Authenticated = "authenticated",
}

/**
 * Enum representing the states of the client.
 * - Loading: The client is currently loading.
 * - Ready: The client is ready for use.
 * - Error: An error occurred while initializing the client.
 */
export enum ClientState {
  Loading = "loading",
  Ready = "ready",
  Error = "error",
}

/**
 * Enum representing the authentication methods.
 */
export enum AuthMethod {
  Otp = "otp",
  Passkey = "passkey",
  Wallet = "wallet",
  Oauth = "oauth",
}

export * from './wallet';
export * from './auth';
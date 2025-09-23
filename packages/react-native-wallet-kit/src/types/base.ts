import type { CreateSubOrgParams, TurnkeySDKClientConfig } from "@turnkey/core";
import type {
  AuthAction,
  Session,
  TurnkeyError,
  TurnkeyNetworkError,
} from "@turnkey/sdk-types";

export type { KeyFormat  } from "@turnkey/iframe-stamper";

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
  // All other optional urls are part of the TurnkeySDKClientConfig interface.
  // We add them here directly since the core js package does not use iframes at all!
  /** URL for the export iframe. */
  exportIframeUrl?: string | undefined;
  /** URL for the import iframe. */
  importIframeUrl?: string | undefined;

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
    /** session expiration time in seconds. If using the auth proxy, you must configure this setting through the dashboard. Changing this through the TurnkeyProvider will have no effect. */
    sessionExpirationSeconds?: string;
    /** If otp sent will be alphanumeric. If using the auth proxy, you must configure this setting through the dashboard. Changing this through the TurnkeyProvider will have no effect. */
    otpAlphanumeric?: boolean;
    /** length of the OTP. If using the auth proxy, you must configure this setting through the dashboard. Changing this through the TurnkeyProvider will have no effect. */
    otpLength?: string;
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
  /** whether to automatically refresh managed state variables */
  autoRefreshManagedState?: boolean;
}

/**@internal */
export enum ExportType {
  Wallet = "WALLET",
  PrivateKey = "PRIVATE_KEY",
  WalletAccount = "WALLET_ACCOUNT",
}

/**@internal */
export enum ImportType {
  Wallet = "WALLET",
  PrivateKey = "PRIVATE_KEY",
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

/** @internal */
export type WalletId = string;
/** @internal */
export type PrivateKeyId = string;
/** @internal */
export type Address = string;

/**
 * Enum representing the authentication methods.
 */
export enum AuthMethod {
  Otp = "otp",
  Passkey = "passkey",
  Wallet = "wallet",
  Oauth = "oauth",
}

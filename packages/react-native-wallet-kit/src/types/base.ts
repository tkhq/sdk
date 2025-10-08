import type {
  CreateSubOrgParams,
  StamperType,
  TurnkeySDKClientConfig,
} from "@turnkey/core";
import type {
  AuthAction,
  Session,
  TurnkeyError,
  TurnkeyNetworkError,
} from "@turnkey/sdk-types";

// New OAuth provider config union: boolean enables; object configures and enables
export type OauthProviderConfig =
  | boolean
  | {
      clientId?: string;
      redirectUri?: string;
    };

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
export interface TurnkeyProviderConfig
  extends Omit<TurnkeySDKClientConfig, "walletConfig"> {
  /** configuration for authentication methods. */
  auth?: {
    /** one-time password (OTP) settings and enablement */
    otp?: {
      /** enable email OTP */
      email?: boolean;
      /** enable SMS OTP */
      sms?: boolean;
      /** OTP alphanumeric mode (proxy controlled if using auth proxy) */
      alphanumeric?: boolean;
      /** OTP length (proxy controlled if using auth proxy) */
      length?: string;
    };
    /** OAuth settings per provider */
    oauth?: {
      /** shared default redirect URI for OAuth providers */
      redirectUri?: string;
      /** application deep link scheme used to complete OAuth in React Native (e.g., "myapp"). */
      appScheme?: string;
      /** provider enablement/configuration (boolean enables; object configures and enables) */
      google?: OauthProviderConfig;
      apple?: OauthProviderConfig;
      facebook?: OauthProviderConfig;
      x?: OauthProviderConfig;
      discord?: OauthProviderConfig;
    };
    /** passkey enablement and options */
    passkey?: boolean | { passkeyName?: string };
    /** parameters for creating a sub-organization for each authentication method. */
    createSuborgParams?: {
      /** parameters for email OTP authentication. */
      emailOtpAuth?: CreateSubOrgParams;
      /** parameters for SMS OTP authentication. */
      smsOtpAuth?: CreateSubOrgParams;
      /** parameters for passkey authentication. */
      passkeyAuth?: CreateSubOrgParams & { passkeyName?: string };
      /** parameters for OAuth authentication. */
      oauth?: CreateSubOrgParams;
    };
    /** whether to automatically refresh the session. */
    autoRefreshSession?: boolean;
    /** session expiration time in seconds. If using the auth proxy, you must configure this setting through the dashboard. Changing this through the TurnkeyProvider will have no effect. */
    sessionExpirationSeconds?: string;
  };
  /** whether to automatically refresh managed state variables */
  autoRefreshManagedState?: boolean;

  /** default stamper type to use for requests that require stamping. */
  defaultStamperType?: StamperType;
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

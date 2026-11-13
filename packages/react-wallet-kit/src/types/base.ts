import type {
  CreateSubOrgParams,
  OtpType,
  StamperType,
  TurnkeySDKClientConfig,
  WalletAccount,
  WalletProvider,
} from "@turnkey/core";
import type {
  AuthAction,
  Session,
  TurnkeyError,
  TurnkeyNetworkError,
} from "@turnkey/sdk-types";
import type { ThemeOverrides } from "../providers/theme/Overrides";
import { KeyFormat as IframeKeyFormat } from "@turnkey/iframe-stamper";

export type OauthProviderConfig = {
  /** Client ID for this OAuth provider. Used as the primary audience for the OIDC token. */
  primaryClientId?: string;
  /** Additional client IDs to register as secondary OAuth providers (additional audiences) during sub-organization creation or provider linking. */
  secondaryClientIds?: string[];
};

export enum WalletSelectorMode {
  /** Auth mode: user is logging in or signing up with a wallet */
  Auth = "auth",
  /** Connect mode: user is connecting/disconnecting an external wallet */
  Connect = "connect",
}

export interface TurnkeyCallbacks {
  onOauthRedirect?: (response: {
    idToken: string;
    publicKey: string;
    sessionKey?: string;
  }) => void;
  /**
   * Called from the auth modal once the auth proxy has verified an email or SMS OTP code,
   * instead of the SDK finishing the login itself (account lookup, then `loginWithOtp` or `signUpWithOtp`).
   *
   * - Use this to finish the OTP login through your own backend, like `onOauthRedirect` does for OAuth.
   * - The SDK generates the API key pair, verifies the code, and hands over the `verificationToken` bound to the key pair's `publicKey`.
   * - Finish the login yourself (for example through your own backend) and store the session you obtain with `storeSession`.
   * - When the returned promise resolves, the modal closes. When it rejects, the modal shows the error and the generated key pair is deleted.
   * - Only the auth modal consults this callback. Calling `completeOtp` directly still completes the login in the SDK.
   *
   * @param params.verificationToken - The verification token returned by the auth proxy for the verified code.
   * @param params.publicKey - The public key of the generated API key pair that the token is bound to.
   * @param params.contact - The email address or phone number the code was sent to.
   * @param params.otpType - Whether the code was sent by email or SMS.
   * @param params.sessionKey - The session key the login was started with, if any.
   */
  onOtpVerified?: (params: {
    verificationToken: string;
    publicKey: string;
    contact: string;
    otpType: OtpType;
    sessionKey?: string;
  }) => Promise<void>;
  /**
   * Called from the auth modal once the external wallet the user picked is connected,
   * instead of the SDK finishing the login itself (`loginOrSignupWithWallet`).
   *
   * - Use this to finish the wallet login through your own backend, like `onOauthRedirect` does for OAuth.
   * - The SDK connects the wallet and hands over the wallet provider and the connected account, which can sign messages.
   * - Finish the login yourself (for example through your own backend) and store the session you obtain with `storeSession`.
   * - When the returned promise resolves, the modal closes. When it rejects, the modal stays open, as it does when the wallet login fails.
   * - Only the auth modal consults this callback. Calling `loginOrSignupWithWallet` directly still completes the login in the SDK.
   *
   * @param params.walletProvider - The wallet provider the user picked.
   * @param params.account - The connected wallet account.
   * @param params.sessionKey - The session key the login was started with, if any.
   */
  onWalletConnected?: (params: {
    walletProvider: WalletProvider;
    account: WalletAccount;
    sessionKey?: string;
  }) => Promise<void>;
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

  /** configuration for authentication. */
  auth?: {
    /** configuration for OAuth authentication. */
    oauthConfig?: {
      /** redirect URI for OAuth. */
      oauthRedirectUri?: string;
      /** Google OAuth provider configuration. */
      google?: OauthProviderConfig;
      /** Apple OAuth provider configuration. */
      apple?: OauthProviderConfig;
      /** Facebook OAuth provider configuration. */
      facebook?: OauthProviderConfig;
      /** X (formerly Twitter) OAuth provider configuration. */
      x?: OauthProviderConfig;
      /** Discord OAuth provider configuration. */
      discord?: OauthProviderConfig;
      /** whether to open OAuth in the same page. Always true on mobile devices. */
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

    /** whether to scope passkey authentication to the authenticated user's authenticators. Defaults to true. */
    scopePasskeyToUser?: boolean;

    /** whether to verify the app proof generated by a proxySignup request if the request includes wallet account creation. The end user will see a modal during this process. */
    verifyWalletOnSignup?: boolean;
  };
  /** whether to automatically refresh managed state variables */
  autoRefreshManagedState?: boolean;

  /** whether to automatically fetch the wallet kit config on initialization. */
  autoFetchWalletKitConfig?: boolean;

  /** site key for Turnstile bot detection. Fetched automatically from the auth proxy. */
  turnstileSiteKey?: string;

  /** default stamper type to use for requests that require stamping. */
  defaultStamperType?: StamperType;

  /** UI configuration. */
  ui?: {
    authModal?: {
      /** toggles visibility of authentication methods in the auth modal. */
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
      /** order of authentication methods in the auth modal. */
      methodOrder?: Array<"socials" | "email" | "sms" | "passkey" | "wallet">;
      /** order of OAuth authentication methods in the auth modal. */
      oauthOrder?: Array<"google" | "apple" | "facebook" | "x" | "discord">;
    };
    /** logo for the auth component */
    logoLight?: string;
    logoDark?: string;
    /** enables or disables dark mode. */
    darkMode?: boolean;
    /** color scheme configuration. */
    colors?: {
      /** light color scheme overrides. */
      light?: Partial<ThemeOverrides>;
      /** dark color scheme overrides. */
      dark?: Partial<ThemeOverrides>;
    };
    /** whether to use large action buttons. */
    preferLargeActionButtons?: boolean; // If true, this will use full width buttons for actions like "Continue". Otherwise, small icon buttons will be used instead.
    /** border radius for UI elements. */
    borderRadius?: string | number; // e.g., 8, "1rem"
    /** background blur for UI elements. */
    backgroundBlur?: string | number; // e.g., 10, "1rem"
    /** whether to render the modal in the provider. */
    renderModalInProvider?: boolean; // If true, the modal will be rendered as a child of the TurnkeyProvider instead of a sibling to the body. This is useful for font inheritance, and css manipulations to modals.
    /** Nonce applied to the injected theme override <style> tag for strict CSP. Only works in dynamically-rendered apps. */
    styleNonce?: string;
    /** whether to suppress missing styles error. */
    supressMissingStylesError?: boolean; // If true, the Turnkey styles missing error will no longer show. It's possible that styles can be imported but not detected properly. This will suppress the error in that case.
  };
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

export { IframeKeyFormat as KeyFormat };

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

import type { CreateSubOrgParams, TurnkeySDKClientConfig } from "@turnkey/core";
import type {
  Session,
  TurnkeyError,
  TurnkeyNetworkError,
} from "@turnkey/sdk-types";
import type { ThemeOverrides } from "../providers/theme/Overrides";

export interface TurnkeyCallbacks {
  onOauthRedirect?: (response: { idToken: string; publicKey: string }) => void;
  beforeSessionExpiry?: (params: { sessionKey: string }) => void;
  onSessionExpired?: (params: { sessionKey: string }) => void;
  onAuthenticationSuccess?: (params: { session: Session | undefined }) => void;
  onError?: (error: TurnkeyError | TurnkeyNetworkError) => void;
}

/**
 * Configuration for the TurnkeyProvider.
 * This interface extends the TurnkeySDKClientConfig to include additional UI and auth configurations.
 * It is used to initialize the TurnkeyProvider with various options such as colors, dark mode, auth methods, and more.
 *
 * @interface TurnkeyProviderConfig
 * @extends {TurnkeySDKClientConfig}
 * @property exportIframeUrl - URL for the export iframe.
 * @property importIframeUrl - URL for the import iframe.
 * @property auth - configuration for authentication methods.
 * @property ui - configuration for the user interface.
 * @property ui.darkMode - whether to use dark mode.
 * @property ui.colors - custom colors for light and dark modes.
 * @property ui.preferLargeActionButtons - if true, uses full-width buttons for actions like "Continue". Otherwise, small icon buttons are used.
 * @property ui.borderRadius - border radius for UI elements, e.g., 8 or "1rem".
 * @property ui.backgroundBlur - background blur effect, e.g., 10 or "1rem".
 * @property ui.renderModalInProvider - if true, the modal is rendered as a child of the TurnkeyProvider instead of a sibling to the body. This is useful for font inheritance and CSS manipulations to modals.
 * @property ui.supressMissingStylesError - if true, suppresses the error for missing styles.
 */
export interface TurnkeyProviderConfig extends TurnkeySDKClientConfig {
  // All other optional urls are part of the TurnkeySDKClientConfig interface.
  // We add them here directly since the core js package does not use iframes at all!
  exportIframeUrl?: string | undefined;
  importIframeUrl?: string | undefined;

  auth?: {
    methods?: {
      emailOtpAuthEnabled?: boolean;
      smsOtpAuthEnabled?: boolean;
      passkeyAuthEnabled?: boolean;
      walletAuthEnabled?: boolean;
      googleOauthEnabled?: boolean;
      appleOauthEnabled?: boolean;
      facebookOauthEnabled?: boolean;
    };
    methodOrder?: Array<"socials" | "email" | "sms" | "passkey" | "wallet">;
    oauthOrder?: Array<"google" | "apple" | "facebook">;
    oauthConfig?: {
      oauthRedirectUri?: string;
      googleClientId?: string;
      appleClientId?: string;
      facebookClientId?: string;
      openOauthInPage?: boolean;
    };
    sessionExpirationSeconds?: string;
    createSuborgParams?: {
      emailOtpAuth?: CreateSubOrgParams;
      smsOtpAuth?: CreateSubOrgParams;
      passkeyAuth?: CreateSubOrgParams & { passkeyName?: string };
      walletAuth?: CreateSubOrgParams;
      oauth?: CreateSubOrgParams;
    };
    autoRefreshSession?: boolean;
  };
  ui?: {
    darkMode?: boolean;
    colors?: {
      light?: Partial<ThemeOverrides>;
      dark?: Partial<ThemeOverrides>;
    };
    preferLargeActionButtons?: boolean; // If true, this will use full width buttons for actions like "Continue". Otherwise, small icon buttons will be used instead.
    borderRadius?: string | number; // e.g., 8, "1rem"
    backgroundBlur?: string | number; // e.g., 10, "1rem"

    renderModalInProvider?: boolean; // If true, the modal will be rendered as a child of the TurnkeyProvider instead of a sibling to the body. This is useful for font inheritance, and css manipulations to modals.

    supressMissingStylesError?: boolean; // If true, the Turnkey styles missing error will no longer show. It's possible that styles can be imported but not detected properly. This will suppress the error in that case.
  };
}

/**@internal */
export enum ExportType {
  Wallet = "WALLET",
  PrivateKey = "PRIVATE_KEY",
  WalletAccount = "WALLET_ACCOUNT",
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

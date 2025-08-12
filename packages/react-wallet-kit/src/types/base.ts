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
  };
}

export enum ExportType {
  Wallet = "WALLET",
  PrivateKey = "PRIVATE_KEY",
}

export enum AuthState {
  Unauthenticated = "unauthenticated",
  Authenticated = "authenticated",
}

export enum ClientState {
  Loading = "loading",
  Ready = "ready",
  Error = "error",
}

import type {
  TurnkeyProviderConfig,
  TurnkeyCallbacks,
} from "@turnkey/react-native-wallet-kit";

/**
 * TurnkeyProvider configuration
 *
 * Replace all placeholder values with your real credentials/config:
 * - organizationId: Your Turnkey organization ID
 * - apiBaseUrl: Optional; defaults to Turnkey prod API
 * - authProxyUrl, authProxyConfigId: If using Auth Proxy, provide both
 * - auth.oauth: Provide redirect URI/appScheme and any client IDs you plan to enable
 * - walletConfig: Enable native chains you plan to support
 */
const ORGANIZATION_ID =
  process.env.EXPO_PUBLIC_TURNKEY_ORGANIZATION_ID ||
  "cd473579-efee-4cb1-8a23-734bd1b4be31";
const API_BASE_URL =
  process.env.EXPO_PUBLIC_TURNKEY_API_BASE_URL || "https://api.turnkey.com";
const AUTH_PROXY_CONFIG_ID = process.env.EXPO_PUBLIC_TURNKEY_AUTH_PROXY_CONFIG_ID;
const PASSKEY_RP_ID =
  process.env.EXPO_PUBLIC_TURNKEY_RPID || "passkeyapp.tkhqlabs.xyz";
const APP_SCHEME =
  process.env.EXPO_PUBLIC_APP_SCHEME || "withreactnativewalletkit";

export const TURNKEY_CONFIG: TurnkeyProviderConfig = {
  organizationId: ORGANIZATION_ID,
  apiBaseUrl: API_BASE_URL,
  ...(AUTH_PROXY_CONFIG_ID ? { authProxyConfigId: AUTH_PROXY_CONFIG_ID } : {}),
  passkeyConfig: {
    rpId: PASSKEY_RP_ID,
  },
  auth: {
    otp: {
      email: true,
      sms: false,
      // Optional proxy-controlled values if not using Auth Proxy
      // alphanumeric: true,
      // length: "6",
    },
    passkey: true,
    oauth: {
      appScheme: APP_SCHEME,
      google: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID
        ? { clientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID }
        : false,
      apple: process.env.EXPO_PUBLIC_APPLE_CLIENT_ID
        ? { clientId: process.env.EXPO_PUBLIC_APPLE_CLIENT_ID }
        : false,
      facebook: process.env.EXPO_PUBLIC_FACEBOOK_CLIENT_ID
        ? { clientId: process.env.EXPO_PUBLIC_FACEBOOK_CLIENT_ID }
        : false,
      x: process.env.EXPO_PUBLIC_X_CLIENT_ID
        ? { clientId: process.env.EXPO_PUBLIC_X_CLIENT_ID }
        : false,
      discord: process.env.EXPO_PUBLIC_DISCORD_CLIENT_ID
        ? { clientId: process.env.EXPO_PUBLIC_DISCORD_CLIENT_ID }
        : false,
    },
    // Optional: override default session expiration
    // sessionExpirationSeconds: "86400",
    autoRefreshSession: true,
  }
};

/**
 * Minimal callbacks for visibility during development. Safe to keep.
 */
export const TURNKEY_CALLBACKS: TurnkeyCallbacks = {
  beforeSessionExpiry: ({ sessionKey }) => {
    console.log("[Turnkey] Session nearing expiry:", sessionKey);
  },
  onSessionExpired: ({ sessionKey }) => {
    console.log("[Turnkey] Session expired:", sessionKey);
  },
  onAuthenticationSuccess: ({ action, method, identifier }) => {
    console.log("[Turnkey] Auth success:", { action, method, identifier });
  },
  onError: (error) => {
    console.error("[Turnkey] Error:", error);
  },
};

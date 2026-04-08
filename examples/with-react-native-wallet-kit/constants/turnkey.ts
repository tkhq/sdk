import type {
  TurnkeyProviderConfig,
  TurnkeyCallbacks,
} from "@turnkey/react-native-wallet-kit";

const ORGANIZATION_ID = process.env.EXPO_PUBLIC_TURNKEY_ORGANIZATION_ID || "";
const API_BASE_URL = process.env.EXPO_PUBLIC_TURNKEY_API_BASE_URL || "";
const AUTH_PROXY_URL = process.env.EXPO_PUBLIC_TURNKEY_AUTH_PROXY_URL || "";
const AUTH_PROXY_CONFIG_ID =
  process.env.EXPO_PUBLIC_TURNKEY_AUTH_PROXY_CONFIG_ID;
const PASSKEY_RP_ID = process.env.EXPO_PUBLIC_TURNKEY_RPID || "";
const APP_SCHEME = process.env.EXPO_PUBLIC_APP_SCHEME || "";

export const TURNKEY_CONFIG: TurnkeyProviderConfig = {
  organizationId: ORGANIZATION_ID,
  apiBaseUrl: API_BASE_URL,
  authProxyUrl: AUTH_PROXY_URL,
  ...(AUTH_PROXY_CONFIG_ID ? { authProxyConfigId: AUTH_PROXY_CONFIG_ID } : {}),
  passkeyConfig: {
    rpId: PASSKEY_RP_ID,
  },
  auth: {
    otp: {
      email: true,
      sms: false,
    },
    passkey: true,
    oauth: {
      appScheme: APP_SCHEME,
      google: {
        primaryClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
      },
      apple: {
        primaryClientId: {
          iosBundleId: process.env.EXPO_PUBLIC_APPLE_BUNDLE_ID,
          serviceId: process.env.EXPO_PUBLIC_APPLE_SERVICE_ID,
        },
      },
      facebook: {
        primaryClientId: process.env.EXPO_PUBLIC_FACEBOOK_CLIENT_ID,
      },
      x: {
        primaryClientId: process.env.EXPO_PUBLIC_X_CLIENT_ID,
      },
      discord: {
        primaryClientId: process.env.EXPO_PUBLIC_DISCORD_CLIENT_ID,
      },
    },

    autoRefreshSession: true,
  },
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

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
export const TURNKEY_CONFIG: TurnkeyProviderConfig = {
  organizationId: "cd473579-efee-4cb1-8a23-734bd1b4be31",
  apiBaseUrl: "https://api.turnkey.com",
  authProxyConfigId: "544e423d-f5c9-4dfb-947e-8cf726e3922e",
  passkeyConfig: {
    rpId: "passkeyapp.tkhqlabs.xyz",
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
    wallet: false,
    oauth: {
      appScheme: "withreactnativewalletkit",
      google: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID
        ? { clientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID }
        : false,
      apple: process.env.EXPO_PUBLIC_APPLE_CLIENT_ID
        ? { clientId: process.env.EXPO_PUBLIC_APPLE_CLIENT_ID, redirectUri: "https://e9e96c6ec876.ngrok-free.app/"}
        : false,
      facebook: process.env.EXPO_PUBLIC_FACEBOOK_CLIENT_ID
        ? { clientId: process.env.EXPO_PUBLIC_FACEBOOK_CLIENT_ID, redirectUri: "https://e9e96c6ec876.ngrok-free.app/" }
        : false,
      x: process.env.EXPO_PUBLIC_X_CLIENT_ID
        ? { clientId: process.env.EXPO_PUBLIC_X_CLIENT_ID, redirectUri: "withreactnativewalletkit://"}
        : false,
      discord: process.env.EXPO_PUBLIC_DISCORD_CLIENT_ID
        ? { clientId: process.env.EXPO_PUBLIC_DISCORD_CLIENT_ID, redirectUri: "withreactnativewalletkit://" }
        : false,
    },
    // Optional: override default session expiration
    // sessionExpirationSeconds: "86400",
    autoRefreshSession: true,
  },
  walletConfig: {
    features: {
      auth: false,
      connecting: false,
    },
    chains: {},
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



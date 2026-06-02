import type {
  TurnkeyProviderConfig,
  TurnkeyCallbacks,
} from "@turnkey/react-native-wallet-kit";

const ORGANIZATION_ID = process.env.EXPO_PUBLIC_TURNKEY_ORGANIZATION_ID;
if (!ORGANIZATION_ID) {
  throw new Error(
    "Missing EXPO_PUBLIC_TURNKEY_ORGANIZATION_ID — add it to your .env file",
  );
}
const API_BASE_URL =
  process.env.EXPO_PUBLIC_TURNKEY_API_BASE_URL || "https://api.turnkey.com";
const AUTH_PROXY_CONFIG_ID =
  process.env.EXPO_PUBLIC_TURNKEY_AUTH_PROXY_CONFIG_ID;
export const TURNKEY_CONFIG: TurnkeyProviderConfig = {
  organizationId: ORGANIZATION_ID,
  apiBaseUrl: API_BASE_URL,
  ...(AUTH_PROXY_CONFIG_ID ? { authProxyConfigId: AUTH_PROXY_CONFIG_ID } : {}),
  auth: {
    otp: {
      email: true,
      sms: false,
    },
    passkey: false,
    autoRefreshSession: true,
  },
};

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

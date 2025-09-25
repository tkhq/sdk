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
 * - auth.oauthConfig: Provide redirect URI and any client IDs you plan to enable
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
    methods: {
      // Enable/disable the methods you want available
      passkeyAuthEnabled: true,
      walletAuthEnabled: false,
      emailOtpAuthEnabled: true,
      smsOtpAuthEnabled: false,
      // Disable OAuth initially on RN until native flows are wired
      googleOauthEnabled: false,
      appleOauthEnabled: false,
      facebookOauthEnabled: false,
      xOauthEnabled: false,
      discordOauthEnabled: false,
    },
    oauthOrder: ["google", "apple", "x", "discord", "facebook"],
    oauthConfig: {
      oauthRedirectUri: "https://oauth-redirect.turnkey.com",
      // @ts-expect-error: appScheme is available in source; dist types will include it after build
      appScheme: "withreactnativewalletkit",
      googleClientId: "GOOGLE_CLIENT_ID",
      appleClientId: "APPLE_CLIENT_ID",
      facebookClientId: "FACEBOOK_CLIENT_ID",
      xClientId: "X_CLIENT_ID",
      discordClientId: "DISCORD_CLIENT_ID",
      // Always true on mobile; RN does not use web popups
      openOauthInPage: true,
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



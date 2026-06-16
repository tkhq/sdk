import type {
  CreateSubOrgParams,
  TurnkeyProviderConfig,
} from "@turnkey/react-wallet-kit";

export const createSuborgParams: CreateSubOrgParams = {
  // customWallet overrides the default Ethereum account; Stellar requires ed25519 (ADDRESS_FORMAT_XLM)
  customWallet: {
    walletName: "Stellar Wallet",
    walletAccounts: [
      {
        addressFormat: "ADDRESS_FORMAT_XLM",
        curve: "CURVE_ED25519",
        pathFormat: "PATH_FORMAT_BIP32",
        path: "m/44'/148'/0'/0'/0",
      },
    ],
  },
};

export const initialConfig: TurnkeyProviderConfig = {
  apiBaseUrl: process.env.NEXT_PUBLIC_BASE_URL || "https://api.turnkey.com",
  authProxyUrl:
    process.env.NEXT_PUBLIC_AUTH_PROXY_URL || "https://authproxy.turnkey.com",
  authProxyConfigId: process.env.NEXT_PUBLIC_AUTH_PROXY_ID!,
  organizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
  auth: {
    autoRefreshSession: true,
    createSuborgParams: {
      emailOtpAuth: createSuborgParams,
      smsOtpAuth: createSuborgParams,
      passkeyAuth: createSuborgParams,
      walletAuth: createSuborgParams,
      oauth: createSuborgParams,
    },
  },
  ui: {
    authModal: {
      methods: {
        // Set the login methods to true if you have enabled them enabled in the dashboard
        emailOtpAuthEnabled: true,
        smsOtpAuthEnabled: false,
        passkeyAuthEnabled: true,
        walletAuthEnabled: false,
        googleOauthEnabled: false,
        appleOauthEnabled: false,
        facebookOauthEnabled: false,
        xOauthEnabled: false,
        discordOauthEnabled: false,
      },
      // Set the order of the login methods in the auth modal, top to bottom
      methodOrder: ["email", "passkey"],
    },
    darkMode: false,
    borderRadius: 8,
    renderModalInProvider: true,
  },
};

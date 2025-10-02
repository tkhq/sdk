import type { Session } from "@turnkey/sdk-types";
import type { TStamper } from "./auth";

/**
 * TurnkeyHttpClientConfig defines the configuration for the Turnkey HTTP client.
 * @interface TurnkeyHttpClientConfig
 * @property apiBaseUrl - base URL for the Turnkey API.
 * @property organizationId - ID of the organization.
 * @property authProxyUrl - URL for the auth proxy.
 * @property authProxyConfigId - ID for the auth proxy configuration.
 * @property activityPoller - configuration for the activity poller.
 * @property apiKeyStamper - stamper for API keys.
 * @property passkeyStamper - stamper for passkeys.
 * @property walletStamper - stamper for wallets.
 * @property storageManager - storage manager for session management.
 * @remarks
 * This interface is used to configure the Turnkey HTTP client, which is responsible for making API
 * requests to Turnkey. It includes options for custom API key stamping, passkey stamping, wallet stamping,
 * and session management through a storage manager.
 * The `activityPoller` configuration allows for setting up a polling mechanism for activities, with options for the polling interval and number of retries.
 */
export interface TurnkeyHttpClientConfig {
  apiBaseUrl: string;
  organizationId: string;
  authProxyUrl?: string | undefined;
  authProxyConfigId?: string | undefined;

  activityPoller?: TActivityPollerConfig | undefined;
  apiKeyStamper?: TStamper | undefined;
  passkeyStamper?: TStamper | undefined;
  walletStamper?: TStamper | undefined;
  storageManager?: StorageBase | undefined;
}

/**
 * TurnkeySDKClientConfig defines the configuration for the Turnkey SDK client.
 * @interface TurnkeySDKClientConfig
 * @property apiBaseUrl - base URL for the Turnkey API.
 * @property authProxyUrl - URL for the auth proxy.
 * @property authProxyConfigId - ID for the auth proxy configuration.
 * @property organizationId - ID of the organization.
 * @property passkeyConfig - configuration for the passkey stamper.
 * @property walletConfig - configuration for the wallet manager.
 * @remarks
 * This interface is used to configure the Turnkey SDK client, which is responsible for managing
 * interactions with the Turnkey API and handling user authentication and wallet management.
 * The `apiBaseUrl` is the endpoint for the Turnkey API, while `authProxyUrl` and `authProxyConfigId` are used for authentication proxy configurations.
 * The `organizationId` is required to identify the parent organization.
 * The `passkeyConfig` allows for configuring the passkey stamper, which is used for user authentication via passkeys.
 */
export interface TurnkeySDKClientConfig {
  /** base URL for the Turnkey API. */
  apiBaseUrl?: string | undefined;
  /** URL for the auth proxy. */
  authProxyUrl?: string | undefined;
  /** ID for the auth proxy configuration. */
  authProxyConfigId?: string | undefined; // Auth proxy won't be used if not passed in
  /** ID of the organization. */
  organizationId: string;
  /** configuration for the passkey stamper. */
  passkeyConfig?: TPasskeyStamperConfig;
  /** configuration for the wallet manager. */
  walletConfig?: TWalletManagerConfig;
}

/**
 * TPasskeyStamperConfig defines the configuration for the passkey stamper.
 * @interface TPasskeyStamperConfig
 * @property rpId - The RPID ("Relying Party ID") for your app. This is automatically determined in web environments based on the current hostname. See https://github.com/f-23/react-native-passkey?tab=readme-ov-file#configuration to set this up for react-native.
 * @property timeout - timeout value in milliseconds. Defaults to 5 minutes.
 * @property userVerification - override for UV flag. Defaults to "preferred".
 * @property allowCredentials - list of credentials to pass. Defaults to empty.
 * @property rpName - name for the Relying Party (RP). This is used in the passkey creation flow on mobile.
 * @property withSecurityKey - option to force security passkeys on native platforms.
 * @property withPlatformKey - option to force platform passkeys on native platforms.
 * @property extensions - optional extensions. Defaults to empty.
 */
export type TPasskeyStamperConfig = {
  rpId?: string | undefined;
  timeout?: number;
  userVerification?: UserVerificationRequirement;
  allowCredentials?: PublicKeyCredentialDescriptor[];
  // The below options do not exist in the WebauthnStamper:
  rpName?: string;
  withSecurityKey?: boolean;
  withPlatformKey?: boolean;
  extensions?: Record<string, unknown>;
};

/**
 * TWalletManagerConfig defines the configuration for the wallet manager.
 * @interface TWalletManagerConfig
 * @property features - features to enable in the wallet manager.
 * @property chains - chains to support in the wallet manager.
 * @property walletConnect - configuration for WalletConnect.
 */
export type TWalletManagerConfig = {
  features?: {
    auth?: boolean;
    connecting?: boolean;
  };
  chains: {
    ethereum?: {
      native?: boolean;
      walletConnectNamespaces?: EvmNamespace[];
    };
    solana?: {
      native?: boolean;
      walletConnectNamespaces?: SolNamespace[];
    };
  };
  walletConnect?: {
    projectId: string;
    appMetadata: {
      name: string;
      description: string;
      url: string;
      icons: string[];
    };
  };
};

/**@internal */
export type TActivityPollerConfig = {
  intervalMs: number;
  numRetries: number;
};

/**@internal */
export interface StorageBase {
  getStorageValue(sessionKey: string): Promise<any>;
  setStorageValue(sessionKey: string, storageValue: any): Promise<void>;
  setActiveSessionKey(sessionKey: string): Promise<void>;
  removeStorageValue(sessionKey: string): Promise<void>;
  storeSession(session: string, sessionKey?: string): Promise<void>;
  getSession(sessionKey?: string): Promise<Session | undefined>;
  getActiveSessionKey(): Promise<string | undefined>;
  getActiveSession(): Promise<Session | undefined>;
  listSessionKeys(): Promise<string[]>;
  clearSession(sessionKey: string): Promise<void>;
  clearAllSessions(): Promise<void>;
}

/**@internal */
type EvmNamespace = `eip155:${string}`; // e.g. "eip155:1", "eip155:8453"

/**@internal */
type SolNamespace = `solana:${string}`; // e.g. "solana:mainnet", cluster id, etc.

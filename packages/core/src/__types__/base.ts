import type { EIP1193Provider as EthereumProvider } from "viem";
import type { Wallet as SolanaProvider } from "@wallet-standard/base";
import type {
  v1ApiKeyCurve,
  v1Attestation,
  v1OauthProviderParams,
  v1Wallet,
  v1WalletAccount,
  v1WalletAccountParams,
  Session,
} from "@turnkey/sdk-types";
import type { CrossPlatformWalletStamper } from "../__wallet__/stamper";
import type { CrossPlatformWalletConnector } from "../__wallet__/connector";

/**@internal */
export const DEFAULT_SESSION_EXPIRATION_IN_SECONDS = "900"; // 15 minutes

/**@internal */
export type GrpcStatus = {
  message: string;
  code: number;
  details: unknown[] | null;
};

/**@internal */
export type Passkey = {
  encodedChallenge: string;
  attestation: {
    credentialId: string;
    clientDataJson: string;
    attestationObject: string;
    transports: (
      | "AUTHENTICATOR_TRANSPORT_BLE"
      | "AUTHENTICATOR_TRANSPORT_INTERNAL"
      | "AUTHENTICATOR_TRANSPORT_NFC"
      | "AUTHENTICATOR_TRANSPORT_USB"
      | "AUTHENTICATOR_TRANSPORT_HYBRID"
    )[];
  };
};

/**@internal */
export type TStamp = {
  stampHeaderName: string;
  stampHeaderValue: string;
};

/**@internal */
export interface TStamper {
  stamp: (input: string) => Promise<TStamp>;
}

/**@internal */
export class TurnkeyRequestError extends Error {
  details: any[] | null;
  code: number;

  constructor(input: GrpcStatus) {
    let turnkeyErrorMessage = `Turnkey error ${input.code}: ${input.message}`;

    if (input.details != null) {
      turnkeyErrorMessage += ` (Details: ${JSON.stringify(input.details)})`;
    }

    super(turnkeyErrorMessage);

    this.name = "TurnkeyRequestError";
    this.details = input.details ?? null;
    this.code = input.code;
  }
}

/**@internal */
export type TActivityPollerConfig = {
  intervalMs: number;
  numRetries: number;
};

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

/**@internal */
export interface IframeClientParams {
  iframeContainer: HTMLElement | null | undefined;
  iframeUrl: string;
  iframeElementId?: string;
  dangerouslyOverrideIframeKeyTtl?: number;
}

/**@internal */
export interface PasskeyClientParams {
  rpId?: string;
  timeout?: number;
  userVerification?: UserVerificationRequirement;
  allowCredentials?: PublicKeyCredentialDescriptor[];
}

/**@internal */
export type ExportBundle = string;

/**@internal */
export enum Curve {
  SECP256K1 = "CURVE_SECP256K1",
  ED25519 = "CURVE_ED25519",
}

/**@internal */
export enum WalletSource {
  Embedded = "embedded",
  Connected = "connected",
}

/**
 * EmbeddedWalletAccount represents a Turnkey embedded wallet account.
 * @interface EmbeddedWalletAccount
 * @extends v1WalletAccount
 * @property source - source of the wallet account, which is always "embedded".
 */
export interface EmbeddedWalletAccount extends v1WalletAccount {
  source: WalletSource.Embedded;
}

/**
 * ConnectedWalletAccount represents a connected wallet account (Ex: MetaMask, Rabby, Phantom external wallets).
 * @interface ConnectedWalletAccount
 * @extends v1WalletAccount
 * @property source - source of the wallet account, which is always "connected".
 * @property signMessage - function to sign a message, returning the hex signature as a string.
 * @property signTransaction - function to sign a transaction, returning the signed transaction as a string.
 * @property signAndSendTransaction - function to sign and send a transaction, returning the signed transaction as a string.
 */
export type ConnectedWalletAccount =
  | ConnectedEthereumWalletAccount
  | ConnectedSolanaWalletAccount;

export interface ConnectedEthereumWalletAccount extends v1WalletAccount {
  source: WalletSource.Connected;
  chainInfo: EvmChainInfo;
  isAuthenticator: boolean;
  signMessage: (message: string) => Promise<string>;
  signAndSendTransaction: (unsignedTransaction: string) => Promise<string>;
}

export interface ConnectedSolanaWalletAccount extends v1WalletAccount {
  source: WalletSource.Connected;
  chainInfo: SolanaChainInfo;
  isAuthenticator: boolean;
  signMessage: (message: string) => Promise<string>;
  signTransaction: (unsignedTransaction: string) => Promise<string>;
}

/**@internal */
export type WalletAccount = EmbeddedWalletAccount | ConnectedWalletAccount;

/**
 * EmbeddedWallet represents a Turnkey embedded wallet.
 * @interface EmbeddedWallet
 * @extends v1Wallet
 * @property source - source of the wallet, which is always "embedded".
 * @property accounts - array of wallet accounts.
 */
export interface EmbeddedWallet extends v1Wallet {
  source: WalletSource.Embedded;
  accounts: WalletAccount[];
}

/**
 * ConnectedWallet represents a connected wallet (Ex: MetaMask, Rabby, Phantom external wallets).
 * @interface ConnectedWallet
 * @extends v1Wallet
 * @property source - source of the wallet, which is always "connected".
 * @property accounts - array of wallet accounts.
 */
export interface ConnectedWallet extends v1Wallet {
  source: WalletSource.Connected;
  accounts: WalletAccount[];
}

/**@internal */
export type Wallet = EmbeddedWallet | ConnectedWallet;

/**@internal */
export type Provider = {
  providerName: string;
  oidcToken: string;
};

/**@internal */
export type CreateSuborgResponse = {
  subOrganizationId: string;
};

/**
 * CreateSubOrgParams defines the parameters to pass on sub-organization creation.
 * @interface CreateSubOrgParams
 * @property userName - name of the user.
 * @property subOrgName - name of the sub-organization.
 * @property userEmail - email of the user.
 * @property userTag - tag for the user.
 * @property authenticators - array of authenticators to create.
 * @property userPhoneNumber - phone number of the user.
 * @property verificationToken - verification token for the user.
 * @property apiKeys - array of API keys to create.
 * @property customWallet - custom wallet to create.
 * @property oauthProviders - array of OAuth providers to create.
 */
export type CreateSubOrgParams = {
  /** name of the user. */
  userName?: string | undefined;

  /** name of the sub-organization. */
  subOrgName?: string | undefined;

  /** email of the user. */
  userEmail?: string | undefined;

  /** tag for the user. */
  userTag?: string | undefined;

  /** array of authenticators to create. */
  authenticators?: {
    /** name of the authenticator. */
    authenticatorName: string;
    /** challenge for the authenticator. */
    challenge: string;
    /** attestation for the authenticator. */
    attestation: v1Attestation;
  }[];
  /** phone number of the user. */
  userPhoneNumber?: string | undefined;

  /** verification token for the user. */
  verificationToken?: string | undefined;

  /** array of API keys to create. */
  apiKeys?: {
    /** name of the API key. */
    apiKeyName?: string | undefined;
    /** public key of the API key. */
    publicKey: string;
    /** expiration time of the API key in seconds. */
    expirationSeconds?: string | undefined;
    /** curve type of the API key. */
    curveType?: v1ApiKeyCurve | undefined;
  }[];
  /** custom wallet to create. */
  customWallet?:
    | {
        walletName: string;
        walletAccounts: v1WalletAccountParams[];
      }
    | undefined;
  /** array of OAuth providers to create. */
  oauthProviders?: Provider[] | undefined;
};

/**@internal */
export type SignUpBody = {
  userName: string;
  subOrgName: string;
  userEmail?: string | undefined;
  userTag?: string | undefined;
  authenticators?: {
    authenticatorName: string;
    challenge: string;
    attestation: v1Attestation;
  }[];
  userPhoneNumber?: string | undefined;
  verificationToken?: string | undefined;
  apiKeys?: {
    apiKeyName: string;
    publicKey: string;
    expirationSeconds: string;
    curveType?: v1ApiKeyCurve | undefined;
  }[];
  customWallet?:
    | {
        walletName: string;
        walletAccounts: v1WalletAccountParams[];
      }
    | undefined;
  oauthProviders?: v1OauthProviderParams[] | undefined;
};

/**
 * StamperType defines the type of stamper to use when stamping a request.
 */
export enum StamperType {
  ApiKey = "api-key",
  Passkey = "passkey",
  Wallet = "wallet",
}

/**
 * OtpType defines the type of OTP to use.
 */
export enum OtpType {
  Email = "OTP_TYPE_EMAIL",
  Sms = "OTP_TYPE_SMS",
}

/**@internal */
export enum FilterType {
  Email = "EMAIL",
  Sms = "PHONE_NUMBER",
  OidcToken = "OIDC_TOKEN",
  PublicKey = "PUBLIC_KEY",
}

/**@internal */
export const OtpTypeToFilterTypeMap = {
  [OtpType.Email]: FilterType.Email,
  [OtpType.Sms]: FilterType.Sms,
};

/**@internal */
export enum SessionKey {
  DefaultSessionkey = "@turnkey/session/v3",
}

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
export interface WalletManagerBase {
  getProviders: (chain?: Chain) => Promise<WalletProvider[]>;
  stamper?: CrossPlatformWalletStamper;
  connector?: CrossPlatformWalletConnector;
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

/**@internal */
type EvmNamespace = `eip155:${string}`; // e.g. "eip155:1", "eip155:8453"

/**@internal */
type SolNamespace = `solana:${string}`; // e.g. "solana:mainnet", cluster id, etc.

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
export interface ApiKeyStamperBase {
  listKeyPairs(): Promise<string[]>;
  createKeyPair(
    externalKeyPair?: CryptoKeyPair | { publicKey: string; privateKey: string },
  ): Promise<string>;
  deleteKeyPair(publicKeyHex: string): Promise<void>;
  clearKeyPairs(): Promise<void>;
  stamp(payload: string, publicKeyHex: string): Promise<TStamp>;
}

/**@internal */
export interface WalletProviderInfo {
  name: string;
  uuid?: string;
  icon?: string;
  rdns?: string;
}

/**@internal */
export enum Chain {
  Ethereum = "ethereum",
  Solana = "solana",
}

/**@internal */
export type SwitchableChain = {
  id: string;
  name: string;
  rpcUrls: string[];
  blockExplorerUrls?: string[];
  iconUrls?: string[];
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
};

/**@internal */
export type EvmChainInfo = {
  namespace: Chain.Ethereum;
  chainId: string;
};

/**@internal */
export type SolanaChainInfo = {
  namespace: Chain.Solana;
};

/**@internal */
export type ChainInfo = EvmChainInfo | SolanaChainInfo;

/**@internal */
export interface WalletConnectProvider {
  request(args: { method: string; params?: any[] }): Promise<unknown>;
  features: {
    "standard:events": {
      on: (event: string, callback: (evt: any) => void) => () => void;
    };
  };
}

/**@internal */
export type WalletRpcProvider =
  | EthereumProvider
  | SolanaProvider
  | WalletConnectProvider;

/**@internal */
export interface WalletProvider {
  interfaceType: WalletInterfaceType;
  chainInfo: ChainInfo;
  info: WalletProviderInfo;
  provider: WalletRpcProvider;
  connectedAddresses: string[];
  uri?: string;
}

/**@internal */
export enum SignIntent {
  SignMessage = "sign_message",
  SignTransaction = "sign_transaction",
  SignAndSendTransaction = "sign_and_send",
}

/**@internal */
export enum WalletInterfaceType {
  Solana = "solana",
  Ethereum = "ethereum",
  WalletConnect = "wallet_connect",
}

/**
 * Base interface for wallet functionalities common across different blockchain chains.
 * @interface BaseWalletInterface
 * @property {function(string): Promise<string>} signMessage - Signs a message and returns the hex signature as a string.
 * @property {function(): Promise<string>} getPublicKey - Retrieves the public key as a string.
 */
export interface BaseWalletInterface {
  interfaceType: WalletInterfaceType;
  sign: (
    payload: string,
    provider: WalletProvider,
    intent: SignIntent,
  ) => Promise<string>;
  getPublicKey: (provider: WalletProvider) => Promise<string>;
  getProviders: () => Promise<WalletProvider[]>;
  connectWalletAccount: (provider: WalletProvider) => Promise<void>;
  disconnectWalletAccount: (provider: WalletProvider) => Promise<void>;
  switchChain?: (
    provider: WalletProvider,
    chainOrId: string | SwitchableChain,
  ) => Promise<void>;
}

/**
 * @internal
 *
 * Solana wallets can directly access the public key without needing a signed message.
 * @interface SolanaWalletInterface
 * @extends BaseWalletInterface
 * @property {function(): string} getPublicKey - Returns the public key, which is the ED25519 hex encoded public key from your Solana wallet public key.
 * @property {'solana'} type - The type of the wallet.
 */
export interface SolanaWalletInterface extends BaseWalletInterface {
  interfaceType: WalletInterfaceType.Solana;
}

/**
 * @internal
 *
 * Ethereum wallets require a signed message to derive the public key.
 *
 * @remarks This is the SECP256K1 public key of the Ethereum wallet, not the address.
 * This requires that the wallet signs a message in order to derive the public key.
 *
 * @interface EthereumWalletInterface
 * @extends BaseWalletInterface
 * @property {function(): Promise<string>} getPublicKey - Returns the public key, which is the SECP256K1 hex encoded public key from your Ethereum wallet.
 * @property {'ethereum'} type - The type of the wallet.
 */
export interface EthereumWalletInterface extends BaseWalletInterface {
  interfaceType: WalletInterfaceType.Ethereum;
}

/**@internal */
export interface WalletConnectInterface extends BaseWalletInterface {
  interfaceType: WalletInterfaceType.WalletConnect;
  init: (opts: {
    ethereumNamespaces: string[];
    solanaNamespaces: string[];
  }) => Promise<void>;
}

/**
 *
 * Union type for wallet interfaces, supporting both Solana and Ethereum wallets.
 * @typedef {SolanaWalletInterface | EthereumWalletInterface} WalletInterface
 * @internal
 */
export type WalletInterface =
  | SolanaWalletInterface
  | EthereumWalletInterface
  | WalletConnectInterface;

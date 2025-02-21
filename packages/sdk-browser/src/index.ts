export {
  createActivityPoller,
  getWebAuthnAttestation,
  sealAndStampRequestBody,
  TurnkeyActivityError,
  TurnkeyApi,
  TurnkeyRequestError,
  type TSignedRequest,
  type TActivity,
  type TurnkeyApiTypes,
} from "@turnkey/http";

export {
  ApiKeyStamper,
  signWithApiKey,
  type TApiKeyStamperConfig,
} from "@turnkey/api-key-stamper";

export {
  IframeEventType,
  IframeStamper,
  type TIframeStamperConfig,
} from "@turnkey/iframe-stamper";

export {
  type TWebauthnStamperConfig,
  WebauthnStamper,
} from "@turnkey/webauthn-stamper";

/**
 * interface BaseSDKClientConfig {
 *   apiBaseUrl: string;
 *   organizationId: string;
 *   activityPoller?: TActivityPollerConfig | undefined;
 * }
 *
 *
 * interface SDKClientConfigWithStamper extends BaseSDKClientConfig {
 *   stamper: TStamper;
 *   readOnlySession?: never;
 * }
 *
 * interface SDKClientConfigWithReadOnlySession extends BaseSDKClientConfig {
 *   stamper?: never;
 *   readOnlySession: string;
 * }
 *
 * export type TurnkeySDKClientConfig =
 *   | SDKClientConfigWithStamper
 *   | SDKClientConfigWithReadOnlySession;
 *
 * export interface TurnkeySDKBrowserConfig {
 *   apiBaseUrl: string;
 *   defaultOrganizationId: string;
 *   rpId?: string;
 *   serverSignUrl?: string;
 *   iframeUrl?: string;
 * }
 */

/**
 *
 * import {
 *   Turnkey,
 *   TurnkeySDKBrowserConfig,
 * } from "@turnkey/sdk-browser";
 *
 * const config: TurnkeySDKBrowserConfig = {
 *   apiBaseUrl: "https://api.turnkey.com",
 *   defaultOrganizationId: <ORGANIZATION_ID>,
 *   apiPublicKey: <API_PUBLIC_KEY>,
 *   apiPrivateKey: <API_PRIVATE>,
 * }
 *
 * const turnkeyBrowserSDK = new Turnkey(config);
 */
export { TurnkeyBrowserSDK as Turnkey } from "./sdk-client";

/**
 * TurnkeySDKClientConfig is the configuration object for a specific client.
 * TurnkeySDKClientConfig = {
 *
 * }
 *
 * // create a new Telegram Cloud Storage Stamper
 * const stamper = await TelegramCloudStorageStamper.create({
 *   cloudStorageAPIKey: apiKey
 * })
 *
 * // use the stamper in the client config
 * const browserConfig: TurnkeySDKClientConfig = {
 *   stamper: stamper,
 *   apiBaseUrl: "https://api.turnkey.com",
 *   organizationId: <ORGANIZATION_ID>,
 * };
 * const client = new TurnkeyBrowserClient(browserConfig);
 */
export { TurnkeyBrowserClient } from "@browser-client";
export { TurnkeyPasskeyClient } from "@passkey-client";
export { TurnkeyIframeClient } from "@iframe-client";
export { TurnkeyWalletClient } from "@wallet-client";

export type { User, ReadOnlySession, ReadWriteSession } from "@models";

export { getStorageValue, setStorageValue, StorageKeys } from "@storage";

export {
  defaultEthereumAccountAtIndex,
  DEFAULT_ETHEREUM_ACCOUNTS,
  defaultCosmosAccountAtIndex,
  DEFAULT_COSMOS_ACCOUNTS,
  defaultTronAccountAtIndex,
  DEFAULT_TRON_ACCOUNTS,
  defaultBitcoinMainnetP2PKHAccountAtIndex,
  DEFAULT_BITCOIN_MAINNET_P2PKH_ACCOUNTS,
  defaultBitcoinMainnetP2WPKHAccountAtIndex,
  DEFAULT_BITCOIN_MAINNET_P2WPKH_ACCOUNTS,
  defaultBitcoinMainnetP2WSHAccountAtIndex,
  DEFAULT_BITCOIN_MAINNET_P2WSH_ACCOUNTS,
  defaultBitcoinMainnetP2TRAccountAtIndex,
  DEFAULT_BITCOIN_MAINNET_P2TR_ACCOUNTS,
  defaultBitcoinMainnetP2SHAccountAtIndex,
  DEFAULT_BITCOIN_MAINNET_P2SH_ACCOUNTS,
  defaultBitcoinTestnetP2PKHAccountAtIndex,
  DEFAULT_BITCOIN_TESTNET_P2PKH_ACCOUNTS,
  defaultBitcoinTestnetP2WPKHAccountAtIndex,
  DEFAULT_BITCOIN_TESTNET_P2WPKH_ACCOUNTS,
  defaultBitcoinTestnetP2WSHAccountAtIndex,
  DEFAULT_BITCOIN_TESTNET_P2WSH_ACCOUNTS,
  defaultBitcoinTestnetP2TRAccountAtIndex,
  DEFAULT_BITCOIN_TESTNET_P2TR_ACCOUNTS,
  defaultBitcoinTestnetP2SHAccountAtIndex,
  DEFAULT_BITCOIN_TESTNET_P2SH_ACCOUNTS,
  defaultBitcoinSignetP2PKHAccountAtIndex,
  DEFAULT_BITCOIN_SIGNET_P2PKH_ACCOUNTS,
  defaultBitcoinSignetP2WPKHAccountAtIndex,
  DEFAULT_BITCOIN_SIGNET_P2WPKH_ACCOUNTS,
  defaultBitcoinSignetP2WSHAccountAtIndex,
  DEFAULT_BITCOIN_SIGNET_P2WSH_ACCOUNTS,
  defaultBitcoinSignetP2TRAccountAtIndex,
  DEFAULT_BITCOIN_SIGNET_P2TR_ACCOUNTS,
  defaultBitcoinSignetP2SHAccountAtIndex,
  DEFAULT_BITCOIN_SIGNET_P2SH_ACCOUNTS,
  defaultBitcoinRegtestP2PKHAccountAtIndex,
  DEFAULT_BITCOIN_REGTEST_P2PKH_ACCOUNTS,
  defaultBitcoinRegtestP2WPKHAccountAtIndex,
  DEFAULT_BITCOIN_REGTEST_P2WPKH_ACCOUNTS,
  defaultBitcoinRegtestP2WSHAccountAtIndex,
  DEFAULT_BITCOIN_REGTEST_P2WSH_ACCOUNTS,
  defaultBitcoinRegtestP2TRAccountAtIndex,
  DEFAULT_BITCOIN_REGTEST_P2TR_ACCOUNTS,
  defaultBitcoinRegtestP2SHAccountAtIndex,
  DEFAULT_BITCOIN_REGTEST_P2SH_ACCOUNTS,
  defaultDogeMainnetAccountAtIndex,
  DEFAULT_DOGE_MAINNET_ACCOUNTS,
  defaultDogeTestnetAccountAtIndex,
  DEFAULT_DOGE_TESTNET_ACCOUNTS,
  defaultSeiAccountAtIndex,
  DEFAULT_SEI_ACCOUNTS,
  defaultXrpAccountAtIndex,
  defaultSolanaAccountAtIndex,
  DEFAULT_SOLANA_ACCOUNTS,
  defaultSuiAccountAtIndex,
  DEFAULT_SUI_ACCOUNTS,
  defaultAptosAccountAtIndex,
  DEFAULT_APTOS_ACCOUNTS,
  defaultXlmAccountAtIndex,
  DEFAULT_XLM_ACCOUNTS,
  defaultTonV3r2AccountAtIndex,
  DEFAULT_TON_V3R2_ACCOUNTS,
  defaultTonV4r2AccountAtIndex,
  DEFAULT_TON_V4R2_ACCOUNTS,
} from "./turnkey-helpers";
export type { WalletAccount } from "./turnkey-helpers";

export {
  type TurnkeySDKClientConfig,
  type TurnkeySDKBrowserConfig,
  AuthClient,
} from "@types";

export type * as TurnkeySDKApiTypes from "./__generated__/sdk_api_types";

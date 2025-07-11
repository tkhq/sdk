// marked as internal to prevent inclusion in the sdk-browser docs
/** @internal */
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

// marked as internal to prevent inclusion in the sdk-browser docs
/** @internal */
export {
  ApiKeyStamper,
  signWithApiKey,
  type TApiKeyStamperConfig,
} from "@turnkey/api-key-stamper";

// marked as internal to prevent inclusion in the sdk-browser docs
/** @internal */
export {
  IframeEventType,
  IframeStamper,
  type TIframeStamperConfig,
} from "@turnkey/iframe-stamper";

// marked as internal to prevent inclusion in the sdk-browser docs
/** @internal */
export {
  type TWebauthnStamperConfig,
  WebauthnStamper,
} from "@turnkey/webauthn-stamper";

export {
  TurnkeyBrowserClient,
  TurnkeyIframeClient,
  TurnkeyIndexedDbClient,
  TurnkeyPasskeyClient,
  TurnkeyWalletClient,
  TurnkeyBrowserSDK as Turnkey,
} from "./sdk-client";

export { getStorageValue, setStorageValue, StorageKeys } from "@storage";

// marked as internal to prevent inclusion in the sdk-browser docs
/** @internal */
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

// marked as internal to prevent inclusion in the sdk-browser docs
/** @internal */
export type { WalletAccount } from "./turnkey-helpers";

// Export all types and values from __types__/base
export * from "./__types__/base";

// Export all models from models
export * from "@models";

export { type Session, SessionType } from "@turnkey/sdk-types";

// marked as internal to prevent inclusion in the sdk-browser docs
/** @internal */
export type * as TurnkeySDKApiTypes from "./__generated__/sdk_api_types";

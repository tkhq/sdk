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

export {
  TurnkeyBrowserSDK as Turnkey,
  TurnkeyBrowserClient,
  TurnkeyIframeClient,
  TurnkeyPasskeyClient,
  TurnkeyWalletClient,
} from "./sdk-client";

export type { User, ReadOnlySession, ReadWriteSession } from "./models";

export { getStorageValue, setStorageValue, StorageKeys } from "./storage";

export {
  defaultEthereumAccountAtIndex,
  DEFAULT_ETHEREUM_ACCOUNTS,
  defaultSolanaAccountAtIndex,
  DEFAULT_SOLANA_ACCOUNTS,
} from "./turnkey-helpers";

export {
  type TurnkeySDKClientConfig,
  type TurnkeySDKBrowserConfig,
  AuthClient,
} from "./__types__/base";

export type * as TurnkeySDKApiTypes from "./__generated__/sdk_api_types";

// marked as internal to prevent inclusion in the core docs
/** @internal */
export {
  ApiKeyStamper,
  signWithApiKey,
  type TApiKeyStamperConfig,
} from "@turnkey/api-key-stamper";

// marked as internal to prevent inclusion in the core docs
/** @internal */
export {
  type TWebauthnStamperConfig,
  WebauthnStamper,
} from "@turnkey/webauthn-stamper";

export { TurnkeyClient, type TurnkeyClientMethods } from "./__clients__/core";
export { type TurnkeySDKClientBase } from "./__generated__/sdk-client-base";

// Export all types and values from __types__/base
export * from "./__types__/base";

/**@internal */
export {
  generateWalletAccountsFromAddressFormat,
  isEthereumWallet,
  isSolanaWallet,
  getAuthProxyConfig,
  addressFormatConfig,
} from "./utils";

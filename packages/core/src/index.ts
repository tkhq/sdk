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

// Export all types and values from __types__/
export * from "./__types__/auth";
export * from "./__types__/config";
export * from "./__types__/enums";
export * from "./__types__/error";
export * from "./__types__/export";
export * from "./__types__/external-wallets";
export * from "./__types__/method-types";

/**@internal */
export {
  generateWalletAccountsFromAddressFormat,
  isEthereumProvider,
  isSolanaProvider,
  getAuthProxyConfig,
  addressFormatConfig,
} from "./utils";

export * from "@turnkey/sdk-types";

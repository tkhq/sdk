import type {
  TurnkeySDKClientBase,
  TurnkeyClientMethods,
  Wallet,
  StamperType,
  ExportBundle,
} from "@turnkey/core";
import type { Session, v1User } from "@turnkey/sdk-types";
import type {
  TurnkeyProviderConfig,
  AuthState,
  ClientState,
} from "../types/base";
import { createContext } from "react";
import type {
  ExportWalletParams,
  ExportPrivateKeyParams,
  ExportWalletAccountParams,
  ImportWalletParams,
  ImportPrivateKeyParams,
  HandleDiscordOauthParams,
  HandleXOauthParams,
  HandleGoogleOauthParams,
  HandleAppleOauthParams,
  HandleFacebookOauthParams,
} from "../types/method-types";

/*
 * In order for jsdocs params to show up properly you must redeclare the core client method here using FUNCTION SIGNATURE. ex:
 *
 * DO:
 *  methodName(params: { param1: string, param2?: number }): Promise<ReturnType>;
 *
 * NOT:
 * methodName: (params: { param1: string, param2?: number }) => Promise<ReturnType>;
 *
 * This is because of some weird typescript behavior where it doesn't recognize arrow-function-typed methods as methods for jsdocs purposes.
 * Same goes for new functions in the provider!!
 */

export interface ClientContextType
  extends Omit<
    TurnkeyClientMethods,
    | "connectWalletAccount"
    | "fetchWalletProviders"
    | "disconnectWalletAccount"
    | "switchWalletAccountChain"
    | "loginWithWallet"
    | "signUpWithWallet"
    | "loginOrSignupWithWallet"
    | "exportWallet"
    | "exportPrivateKey"
    | "exportWalletAccount"
    | "importWallet"
    | "importPrivateKey"
    | "buildWalletLoginRequest"
  > {
  /** @internal */
  httpClient: TurnkeySDKClientBase | undefined;
  /** @internal */
  session: Session | undefined;
  /** @internal */
  allSessions?: Record<string, Session> | undefined;
  /** @internal */
  clientState: ClientState | undefined;
  /** @internal */
  authState: AuthState;
  /** @internal */
  config?: TurnkeyProviderConfig | undefined;
  /** @internal */
  user: v1User | undefined;
  /** @internal */
  wallets: Wallet[];

  /**
   * Export a wallet. Optionally decrypt and return the mnemonic directly.
   *
   * - By default, this function DECRYPTS and returns the mnemonic for convenience.
   * - If `decrypt` is set to false, it returns the encrypted export bundle string instead.
   * - When decrypting, this function generates a P-256 keypair internally,
   *   exports the wallet encrypted to the generated public key, then decrypts the bundle
   *   using the generated private key and returns the mnemonic string.
   * - When `decrypt` is true, the provided `targetPublicKey` (if any) is ignored.
   *
   * @param params.walletId - The wallet ID to export.
   * @param params.targetPublicKey - Optional; used only when `decrypt` is not set.
   * @param params.organizationId - Optional organization ID override.
   * @param params.stampWith - Optional stamper override.
   * @param params.decrypt - Defaults to true. Set to false to receive the encrypted bundle.
   */
  exportWallet(params: ExportWalletParams): Promise<ExportBundle>;

  /**
   * Export a private key. Optionally decrypt and return the raw private key.
   *
   * - By default, this function DECRYPTS and returns the raw private key (hex for EVM, base58 for Solana when `keyFormat` is "SOLANA").
   * - If `decrypt` is false, the provider returns the encrypted export bundle string.
   * - When decrypting, the provider generates a P-256 keypair, exports to the generated public key,
   *   decrypts locally, and returns the raw private key (hex for EVM, or base58 for Solana when `keyFormat` is "SOLANA").
   *
   * @param params.privateKeyId - The private key ID to export.
   * @param params.targetPublicKey - Optional; used only when `decrypt` is not set.
   * @param params.organizationId - Optional organization ID override.
   * @param params.stampWith - Optional stamper override.
   * @param params.decrypt - Defaults to true. Set to false to receive the encrypted bundle.
   * @returns Raw private key (default) or encrypted bundle (when decrypt is false).
   */
  exportPrivateKey(params: ExportPrivateKeyParams): Promise<ExportBundle>;

  /**
   * Export a wallet account. Optionally decrypt and return the raw private key.
   *
   * - By default, this function DECRYPTS and returns the raw private key (hex for EVM, base58 for Solana when `keyFormat` is "SOLANA").
   * - If `decrypt` is false, the provider returns the encrypted export bundle string.
   * - When decrypting, the provider generates a P-256 keypair, exports to the generated public key,
   *   decrypts locally, and returns the raw private key (hex for EVM, or base58 for Solana when `keyFormat` is "SOLANA").
   *
   * @param params.address - The account address to export.
   * @param params.targetPublicKey - Optional; used only when `decrypt` is not set.
   * @param params.organizationId - Optional organization ID override.
   * @param params.stampWith - Optional stamper override.
   * @param params.decrypt - Defaults to true. Set to false to receive the encrypted bundle.
   * @returns Raw private key (default) or encrypted bundle (when decrypt is false).
   */
  exportWalletAccount(params: ExportWalletAccountParams): Promise<ExportBundle>;

  /**
   * Import a wallet using a mnemonic.
   *
   * - The provider internally calls `initImportWallet` to retrieve an import bundle.
   * - It encrypts the provided `mnemonic` to that bundle using HPKE and calls `client.importWallet`.
   * - Optionally accepts `accounts` to pre-create wallet accounts; otherwise defaults may apply.
   *
   * @param params.mnemonic - Mnemonic phrase to import.
   * @param params.walletName - Name for the new wallet.
   * @param params.accounts - Optional accounts to pre-create.
   * @param params.organizationId - Optional organization ID.
   * @param params.userId - Optional user ID.
   * @param params.stampWith - Optional stamper override.
   * @returns The new wallet ID.
   */
  importWallet(params: ImportWalletParams): Promise<string>;

  /**
   * Import a private key by encrypting it to an import bundle internally.
   *
   * - The provider internally calls `initImportPrivateKey` to retrieve an import bundle.
   * - It encrypts the provided `privateKey` to that bundle using HPKE and calls `client.importPrivateKey`.
   * - `addressFormats` is required and determines the curve by default; `curve` can be provided to override.
   *
   * @param params.privateKey - The private key material to import (hex for EVM; base58 for Solana when `keyFormat` is "SOLANA").
   * @param params.privateKeyName - A display name for the imported key.
   * @param params.addressFormats - Address formats to derive and register.
   * @param params.curve - Optional curve override.
   * @param params.keyFormat - Optional source key encoding (default "HEXADECIMAL").
   * @param params.organizationId - Optional organization ID.
   * @param params.userId - Optional user ID.
   * @param params.stampWith - Optional stamper override.
   * @returns The new private key ID.
   */
  importPrivateKey(params: ImportPrivateKeyParams): Promise<string>;

  /**
   * Refreshes the user details.
   *
   * - This function fetches the latest user details for the current session (or optionally for a specific user/organization if provided)
   *   and updates the `user` state variable in the provider.
   * - If a `stampWith` parameter is provided, it will use that stamper to fetch the user details (supports Passkey, ApiKey, or Wallet stampers).
   * - Automatically handles error reporting via the configured callbacks.
   * - Typically used after authentication, user profile updates, or linking/unlinking authenticators to ensure the provider state is up to date.
   * - If no user is found, the state will not be updated.
   *
   * @param params.stampWith - parameter to stamp the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   * @returns A promise that resolves when the user details are successfully refreshed and state is updated.
   * @throws {TurnkeyError} If the client is not initialized or if there is an error refreshing the user details.
   */
  refreshUser: (params?: {
    stampWith?: StamperType | undefined;
  }) => Promise<void>;

  /**
   * Refreshes the wallets state for the current user session.
   *
   * - This function fetches the latest list of wallets associated with the current session or user,
   *   and updates the `wallets` state variable in the provider.
   * - If a `stampWith` parameter is provided, it will use that stamper to fetch the wallets
   *   (supports Passkey, ApiKey, or Wallet stampers for granular authentication control).
   * - Automatically handles error reporting via the configured callbacks.
   * - Typically used after wallet creation, import, export, account changes, or authentication
   *   to ensure the provider state is up to date.
   * - If no wallets are found, the state will be set to an empty array.
   *
   * @param params.stampWith - parameter to stamp the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   * @returns A promise that resolves when the wallets are successfully refreshed and state is updated.
   * @throws {TurnkeyError} If the client is not initialized or if there is an error refreshing the wallets.
   */
  refreshWallets: (params?: {
    stampWith?: StamperType | undefined;
  }) => Promise<Wallet[]>;

  /**
   * Handles the Discord OAuth flow.
   *
   * - Opens an in-app browser to Discord's OAuth flow and deep-links back to the app via PKCE.
   * - On successful authentication, calls the `onOauthSuccess` callback, the `onOauthRedirect` TurnkeyProvider callback, or completes the flow internally via `completeOauth`.
   *
   * @param params.primaryClientId - The Discord client ID to use (overrides the value from TurnkeyProviderConfig).
   * @param params.secondaryClientIds - Additional client IDs to register as secondary OAuth providers during sub-organization creation (overrides secondaryClientIds from TurnkeyProviderConfig).
   * @param params.additionalState - Additional key-value pairs to include in the OAuth state parameter for custom tracking or logic.
   * @param params.onOauthSuccess - Callback function to handle the successful OAuth response (receives `{ oidcToken, providerName, publicKey }`).
   *
   * @returns A promise that resolves when the OAuth flow is successfully initiated and completed, or rejects on error or timeout.
   * @throws {TurnkeyError} If the TurnkeyProvider is not ready, required parameters are missing, or if there is an error initiating or completing the OAuth flow.
   */
  handleDiscordOauth: (params?: HandleDiscordOauthParams) => Promise<void>;

  /**
   * Handles the Twitter (X) OAuth flow.
   *
   * - Opens an in-app browser to X's OAuth flow and deep-links back to the app via PKCE.
   * - On successful authentication, calls the `onOauthSuccess` callback, the `onOauthRedirect` TurnkeyProvider callback, or completes the flow internally via `completeOauth`.
   *
   * @param params.primaryClientId - The Twitter (X) client ID to use (overrides the value from TurnkeyProviderConfig).
   * @param params.secondaryClientIds - Additional client IDs to register as secondary OAuth providers during sub-organization creation (overrides secondaryClientIds from TurnkeyProviderConfig).
   * @param params.additionalState - Additional key-value pairs to include in the OAuth state parameter for custom tracking or logic.
   * @param params.onOauthSuccess - Callback function to handle the successful OAuth response (receives `{ oidcToken, providerName, publicKey }`).
   *
   * @returns A promise that resolves when the OAuth flow is successfully initiated and completed, or rejects on error or timeout.
   * @throws {TurnkeyError} If the TurnkeyProvider is not ready, required parameters are missing, or if there is an error initiating or completing the OAuth flow.
   */
  handleXOauth: (params?: HandleXOauthParams) => Promise<void>;

  /**
   * Handles the Google OAuth flow.
   *
   * - Opens an in-app browser to Google's OAuth flow via the Turnkey OAuth proxy and deep-links back to the app.
   * - On successful authentication, calls the `onOauthSuccess` callback, the `onOauthRedirect` TurnkeyProvider callback, or completes the flow internally via `completeOauth`.
   *
   * @param params.primaryClientId - The Google client ID to use (overrides the value from TurnkeyProviderConfig).
   * @param params.secondaryClientIds - Additional client IDs to register as secondary OAuth providers during sub-organization creation (overrides secondaryClientIds from TurnkeyProviderConfig).
   * @param params.additionalState - Additional key-value pairs to include in the OAuth state parameter for custom tracking or logic.
   * @param params.onOauthSuccess - Callback function to handle the successful OAuth response (receives `{ oidcToken, providerName, publicKey }`).
   *
   * @returns A promise that resolves when the OAuth flow is successfully initiated and completed, or rejects on error or timeout.
   * @throws {TurnkeyError} If the TurnkeyProvider is not ready, required parameters are missing, or if there is an error initiating or completing the OAuth flow.
   */
  handleGoogleOauth: (params?: HandleGoogleOauthParams) => Promise<void>;

  /**
   * Handles the Apple OAuth flow.
   *
   * - On iOS, uses native Apple Sign-In with `primaryClientId.iosBundleId` as the audience, and links `primaryClientId.serviceId` as a secondary audience during sub-organization creation.
   * - On Android, opens a web-based Apple OAuth flow using `primaryClientId.serviceId` as the audience, and links `primaryClientId.iosBundleId` as a secondary audience during sub-organization creation.
   * - On successful authentication, calls the `onOauthSuccess` callback, the `onOauthRedirect` TurnkeyProvider callback, or completes the flow internally via `completeOauth`.
   *
   * @param params.primaryClientId - The Apple `serviceId` and `iosBundleId` to use (overrides the values from TurnkeyProviderConfig).
   * @param params.secondaryClientIds - Additional client IDs to register as secondary OAuth providers during sub-organization creation (overrides secondaryClientIds from TurnkeyProviderConfig).
   * @param params.additionalState - Additional key-value pairs to include in the OAuth state parameter for custom tracking or logic.
   * @param params.onOauthSuccess - Callback function to handle the successful OAuth response (receives `{ oidcToken, providerName, publicKey }`).
   *
   * @returns A promise that resolves when the OAuth flow is successfully initiated and completed, or rejects on error or timeout.
   * @throws {TurnkeyError} If the TurnkeyProvider is not ready, required parameters are missing, or if there is an error initiating or completing the OAuth flow.
   */
  handleAppleOauth: (params?: HandleAppleOauthParams) => Promise<void>;

  /**
   * Handles the Apple OAuth flow using a web-based in-app browser on all platforms.
   *
   * - Opens a web-based Apple OAuth flow using `primaryClientId.serviceId` as the audience. The `iosBundleId` is ignored by this function.
   * - Generates a new ephemeral API key pair and uses its public key as the nonce for the OAuth request, ensuring cryptographic binding of the session.
   * - On successful authentication, calls the `onOauthSuccess` callback, the `onOauthRedirect` TurnkeyProvider callback, or completes the flow internally via `completeOauth`.
   *
   * This flow is provided for compatibility with previous versions of react-native-wallet-kit.
   * It is recommended to use {@link handleAppleOauth} instead, which uses native Apple Sign-In on iOS.
   *
   * @param params.primaryClientId - The Apple `serviceId` to use (overrides the value from TurnkeyProviderConfig). The `iosBundleId` is ignored.
   * @param params.secondaryClientIds - Additional client IDs to register as secondary OAuth providers during sub-organization creation (overrides secondaryClientIds from TurnkeyProviderConfig).
   * @param params.additionalState - Additional key-value pairs to include in the OAuth state parameter for custom tracking or logic.
   * @param params.onOauthSuccess - Callback function to handle the successful OAuth response (receives `{ oidcToken, providerName, publicKey }`).
   *
   * @returns A promise that resolves when the OAuth flow is successfully initiated and completed, or rejects on error or timeout.
   * @throws {TurnkeyError} If the TurnkeyProvider is not ready, required parameters are missing, or if there is an error initiating or completing the OAuth flow.
   * @deprecated Use {@link handleAppleOauth} instead.
   */
  handleAppleWebOauth: (params?: HandleAppleOauthParams) => Promise<void>;

  /**
   * Handles the Facebook OAuth flow.
   *
   * - Opens an in-app browser to Facebook's OAuth flow via the Turnkey OAuth proxy and deep-links back to the app via PKCE.
   * - On successful authentication, calls the `onOauthSuccess` callback, the `onOauthRedirect` TurnkeyProvider callback, or completes the flow internally via `completeOauth`.
   *
   * @param params.primaryClientId - The Facebook client ID to use (overrides the value from TurnkeyProviderConfig).
   * @param params.secondaryClientIds - Additional client IDs to register as secondary OAuth providers during sub-organization creation (overrides secondaryClientIds from TurnkeyProviderConfig).
   * @param params.additionalState - Additional key-value pairs to include in the OAuth state parameter for custom tracking or logic.
   * @param params.onOauthSuccess - Callback function to handle the successful OAuth response (receives `{ oidcToken, providerName, publicKey }`).
   *
   * @returns A promise that resolves when the OAuth flow is successfully initiated and completed, or rejects on error or timeout.
   * @throws {TurnkeyError} If the TurnkeyProvider is not ready, required parameters are missing, or if there is an error initiating or completing the OAuth flow.
   */
  handleFacebookOauth: (params?: HandleFacebookOauthParams) => Promise<void>;
}

/** @internal */
export const ClientContext = createContext<ClientContextType | undefined>(
  undefined,
);

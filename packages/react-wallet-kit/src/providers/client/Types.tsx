import type {
  TurnkeySDKClientBase,
  DefaultParams,
  TurnkeyClientMethods,
  Wallet,
  OtpType,
  ExportBundle,
  WalletAccount,
  CreateSubOrgParams,
  Chain,
} from "@turnkey/sdk-js";
import type {
  OAuthProviders,
  ProxyTGetWalletKitConfigResponse,
  Session,
  TDeleteSubOrganizationResponse,
  TStampLoginResponse,
  v1AddressFormat,
  v1Attestation,
  v1HashFunction,
  v1Pagination,
  v1PayloadEncoding,
  v1SignRawPayloadResult,
  v1TransactionType,
  v1User,
  v1WalletAccount,
  v1WalletAccountParams,
} from "@turnkey/sdk-types";
import type {
  TurnkeyProviderConfig,
  ExportType,
  AuthState,
  ClientState,
} from "../../types/base";
import { createContext } from "react";
import type { WalletProvider } from "@turnkey/sdk-js";

// In order for jsdocs params to show up properly you must redeclare the core client method here using FUNCTION SIGNATURE. ex:
//
// DO:
// methodName(params: { param1: string, param2?: number }): Promise<ReturnType>;
//
// NOT:
// methodName: (params: { param1: string, param2?: number }) => Promise<ReturnType>;
//
// This is because of some weird typescript behavior where it doesn't recognize arrow-function-typed methods as methods for jsdocs purposes.
// Same goes for new functions in the provider!!

export interface ClientContextType extends TurnkeyClientMethods {
  httpClient: TurnkeySDKClientBase | undefined;
  session: Session | undefined;
  allSessions?: Record<string, Session> | undefined;
  clientState: ClientState;
  authState: AuthState;
  config?: TurnkeyProviderConfig | undefined;
  user: v1User | undefined;
  wallets: Wallet[];
  /**
   * Creates a new passkey authenticator for the current user.
   *
   * - This function generates a new passkey attestation and challenge, which can be used to register a passkey authenticator with the user's device.
   * - The passkey can be used for passwordless authentication and is stored securely in the user's browser/device.
   * - If a name or displayName is not provided, a default will be generated based on the website and current timestamp.
   * - This does not automatically link the passkey to the user; use `addPasskey` to associate the created passkey with the user's account.
   *
   * @param name - Optional. The internal name for the passkey. If not provided, a default name will be generated.
   * @param displayName - Optional. The display name for the passkey, shown to the user. If not provided, a default display name will be generated based on the website and timestamp.
   * @param stampWith - Optional parameter to stamp the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   * @returns A promise that resolves to an object containing:
   *   - attestation: The attestation object returned from the passkey creation process, suitable for registration with the backend.
   *   - encodedChallenge: The encoded challenge string used for passkey registration, which should be sent to the backend for verification.
   * @throws {TurnkeyError} If the client is not initialized or if there is an error during passkey creation.
   */
  createPasskey(
    params?: {
      name?: string;
      displayName?: string;
    } & DefaultParams,
  ): Promise<{
    attestation: v1Attestation;
    encodedChallenge: string;
  }>;
  /**
   * Logs in a user using a passkey, optionally specifying a public key and session key.
   *
   * - This function initiates the login process using a passkey authenticator, which can be either a platform passkey or a custom key-pair.
   * - It creates a new session for the user and stores the session token upon successful authentication.
   * - If a publicKey is provided, it will use that key for authentication; otherwise, a key pair will be generated.
   * - If a sessionKey is provided, the session will be stored under that key; otherwise, the default active session key is used.
   * - Automatically refreshes user and wallet state after successful login.
   *
   * @param publicKey - Optional. The public key of a custom key-pair to use for authentication stamping.
   * @param sessionKey - Optional. The session key to use for session creation and storage.
   * @returns A promise that resolves to a signed JWT session token.
   * @throws {TurnkeyError} If the client is not initialized or if there is an error during the login process.
   */
  logout(params?: { sessionKey?: string }): Promise<void>;
  /**
   * Signs up a user using a passkey, creating a sub-organization and initializing a session.
   *
   * - This function creates a new passkey authenticator and uses it to register a new user.
   * - It creates a sub-organization using the provided parameters, or falls back to the configuration defaults if not specified.
   * - The passkey display name can be customized, or will default to a generated name based on the website and timestamp.
   * - The session expiration time is determined by the configuration or a default value.
   * - After successful sign-up, the session and user state are refreshed and session expiration is scheduled.
   *
   * @param createSubOrgParams - Optional parameters for creating a sub-organization. If not provided, uses configuration defaults.
   * @param sessionKey - Optional session key to use for session creation and storage.
   * @param passkeyDisplayName - Optional display name for the passkey. If not provided, a default is generated.
   * @returns A promise that resolves to a signed JWT session token.
   * @throws {TurnkeyError} If the client is not initialized, configuration is not ready, or if there is an error during sign-up.
   */
  signUpWithPasskey(params?: {
    createSubOrgParams?: CreateSubOrgParams;
    sessionKey?: string;
    passkeyDisplayName?: string;
    expirationSeconds?: string;
  }): Promise<string>;
  // TODO: MOE PLEASE COMMENT THESE
  getWalletProviders(chain?: Chain): Promise<WalletProvider[]>;
  // TODO: MOE PLEASE COMMENT THESE
  connectWalletAccount(walletProvider: WalletProvider): Promise<void>;
  // TODO: MOE PLEASE COMMENT THESE
  disconnectWalletAccount(walletProvider: WalletProvider): Promise<void>;
  // TODO: MOE PLEASE COMMENT THESE
  loginWithWallet(params: {
    walletProvider: WalletProvider;
    publicKey?: string;
    sessionKey?: string;
    expirationSeconds?: string;
  }): Promise<string>;
  // TODO: MOE PLEASE COMMENT THESE
  signUpWithWallet(params: {
    walletProvider: WalletProvider;
    createSubOrgParams?: CreateSubOrgParams;
    sessionKey?: string;
    expirationSeconds?: string;
  }): Promise<string>;
  // TODO: MOE PLEASE COMMENT THESE
  loginOrSignupWithWallet(params: {
    walletProvider: WalletProvider;
    createSubOrgParams?: CreateSubOrgParams;
    sessionKey?: string;
    expirationSeconds?: string;
  }): Promise<string>;
  /**
   * Initializes the OTP (One-Time Password) process by sending an OTP code to the specified contact.
   *
   * - This function triggers the sending of an OTP code to the user's contact information (email address or phone number) via the configured authentication proxy.
   * - Supports both email and SMS OTP flows, as determined by the `otpType` parameter.
   * - The OTP code is used for subsequent verification as part of login, sign-up, or sensitive user actions (such as updating email or phone).
   * - Returns an OTP identifier (otpId) that must be used in the verification step.
   *
   * @param otpType - The type of OTP to initialize (OtpType.Email or OtpType.Sms).
   * @param contact - The contact information for the user (e.g., email address or phone number) to which the OTP will be sent.
   * @returns A promise that resolves to an OTP identifier (otpId) as a string, which is required for OTP verification.
   * @throws {TurnkeyError} If the client is not initialized or if there is an error during the OTP initialization process.
   */
  initOtp: (params: { otpType: OtpType; contact: string }) => Promise<string>;
  /**
   * Verifies the OTP (One-Time Password) code sent to the user.
   *
   * - This function verifies the OTP code entered by the user against the OTP sent to their contact information (email or phone) via the configured authentication proxy.
   * - Supports both email and SMS OTP flows, as determined by the `otpType` parameter.
   * - Returns the sub-organization ID if the contact is already associated with an existing sub-organization, and a verification token to be used for login or sign-up.
   * - The verification token can be used in subsequent authentication steps (loginWithOtp, signUpWithOtp, or completeOtp).
   * - This function is typically called after `initOtp` to complete the OTP verification process.
   *
   * @param otpId - The ID of the OTP to verify (returned from `initOtp`).
   * @param otpCode - The OTP code entered by the user.
   * @param contact - The contact information for the user (e.g., email address or phone number) to which the OTP was sent.
   * @param otpType - The type of OTP being verified (OtpType.Email or OtpType.Sms).
   * @returns A promise that resolves to an object containing:
   *   - subOrganizationId: The sub-organization ID if the contact is already associated with a suborg, or an empty string if not.
   *   - verificationToken: The verification token to be used for login or sign-up.
   * @throws {TurnkeyError} If the client is not initialized or if there is an error during OTP verification.
   */
  verifyOtp(params: {
    otpId: string;
    otpCode: string;
    contact: string;
    otpType: OtpType;
  }): Promise<{
    subOrganizationId: string;
    verificationToken: string;
  }>;
  /**
   * Logs in a user using an OTP (One-Time Password) verification token.
   *
   * - This function logs in a user using the verification token received after successful OTP verification (via email or SMS).
   * - Supports optional authentication with a custom key-pair by providing a publicKey.
   * - Can optionally invalidate any existing sessions for the user if invalidateExisting is set to true.
   * - Allows specifying a custom sessionKey for storing the session, otherwise uses the default active session key.
   * - After successful login, updates the session state and refreshes user and wallet information.
   *
   * @param verificationToken - The verification token received after OTP verification (from verifyOtp).
   * @param publicKey - Optional public key of a custom key-pair to use for authentication stamping.
   * @param invalidateExisting - Optional flag to invalidate existing sessions for the user.
   * @param sessionKey - Optional session key to use for session creation and storage.
   * @returns A promise that resolves to a signed JWT session token.
   * @throws {TurnkeyError} If the client is not initialized or if there is an error during login with OTP.
   */
  loginWithOtp(params: {
    verificationToken: string;
    publicKey?: string;
    invalidateExisting?: boolean;
    sessionKey?: string;
  }): Promise<string>;
  /**
   * Signs up a user using an OTP (One-Time Password) verification token.
   *
   * - This function registers a new user (sub-organization) using the verification token received after successful OTP verification (via email or SMS).
   * - It creates a sub-organization with the provided parameters, or falls back to the configuration defaults if not specified.
   * - The OTP type (OtpType.Email or OtpType.Sms) determines which default sub-organization parameters are used if not explicitly provided.
   * - Optionally, a custom session key can be specified for session creation and storage.
   * - After successful sign-up, the session and user state are refreshed and session expiration is scheduled.
   *
   * @param verificationToken - The verification token received after OTP verification (from verifyOtp).
   * @param contact - The contact information for the user (e.g., email address or phone number) to associate with the new sub-organization.
   * @param otpType - The type of OTP being used (OtpType.Email or OtpType.Sms).
   * @param createSubOrgParams - Optional parameters for creating a sub-organization (overrides configuration defaults).
   * @param sessionKey - Optional session key to use for session creation and storage.
   * @returns A promise that resolves to a signed JWT session token.
   * @throws {TurnkeyError} If the client is not initialized, configuration is not ready, or if there is an error during sign-up with OTP.
   */
  signUpWithOtp(params: {
    verificationToken: string;
    contact: string;
    otpType: OtpType;
    createSubOrgParams?: CreateSubOrgParams;
    invalidateExisting?: boolean;
    sessionKey?: string;
  }): Promise<string>;
  /**
   * Completes the OTP (One-Time Password) authentication flow by verifying the OTP code and either logging in or signing up the user.
   *
   * - This function verifies the OTP code for the provided contact (email or phone) and determines if the contact is already associated with an existing sub-organization.
   * - If the contact is associated with an existing sub-organization, it logs in the user and creates a session.
   * - If the contact is not associated with any sub-organization, it creates a new sub-organization using the provided parameters and then logs in the user.
   * - Supports both email and SMS OTP flows, as determined by the `otpType` parameter.
   * - Allows for optional authentication with a custom key-pair by providing a `publicKey`.
   * - Can optionally invalidate any existing sessions for the user if `invalidateExisting` is set to true.
   * - Allows specifying a custom `sessionKey` for storing the session, otherwise uses the default active session key.
   * - Optionally accepts `createSubOrgParams` to customize sub-organization creation.
   * - After successful completion, updates the session and user state, and schedules session expiration.
   *
   * @param otpId - The ID of the OTP to complete (returned from `initOtp`).
   * @param otpCode - The OTP code entered by the user.
   * @param contact - The contact information for the user (e.g., email address or phone number) to which the OTP was sent.
   * @param otpType - The type of OTP being completed (OtpType.Email or OtpType.Sms).
   * @param publicKey - Optional public key of a custom key-pair to use for authentication stamping.
   * @param invalidateExisting - Optional flag to invalidate existing sessions for the user.
   * @param sessionKey - Optional session key to use for session creation and storage.
   * @param createSubOrgParams - Optional parameters for creating a sub-organization (overrides configuration defaults).
   * @returns A promise that resolves to a signed JWT session token.
   * @throws {TurnkeyError} If the client is not initialized, configuration is not ready, or if there is an error during OTP completion.
   */
  completeOtp(params: {
    otpId: string;
    otpCode: string;
    contact: string;
    otpType: OtpType;
    publicKey?: string;
    invalidateExisting?: boolean;
    sessionKey?: string;
    createSubOrgParams?: CreateSubOrgParams;
  }): Promise<string>;
  /**
   * Completes the OAuth authentication flow by either signing up or logging in the user,
   * depending on whether a sub-organization already exists for the provided OIDC token.
   *
   * - Handles both new user registration (sign-up) and returning user authentication (login) seamlessly.
   * - If the user does not have an existing sub-organization, a new one is created using the provided or default parameters.
   * - Supports passing a custom session key, provider name, and sub-organization creation parameters.
   * - Automatically updates session and user state, and schedules session expiration after successful authentication.
   * - Triggers any configured callbacks for error handling or session events.
   *
   * @param oidcToken - The OIDC token received after successful OAuth authentication.
   * @param publicKey - The public key used for authentication and nonce generation.
   * @param providerName - Optional. The name of the OAuth provider (e.g., "google", "apple", "facebook").
   * @param sessionKey - Optional. The session key to use for session creation and storage.
   * @param invalidateExisting - Optional. Whether to invalidate any existing sessions for the user.
   * @param createSubOrgParams - Optional. Parameters for sub-organization creation (overrides config defaults).
   * @returns A promise that resolves to a signed JWT session token.
   * @throws {TurnkeyError} If the client or configuration is not initialized, or if there is an error during OAuth completion.
   */
  completeOauth(params: {
    oidcToken: string;
    publicKey: string;
    providerName?: string;
    sessionKey?: string;
    invalidateExisting?: boolean;
    createSubOrgParams?: CreateSubOrgParams;
  }): Promise<string>;
  /**
   * Logs in a user using OAuth authentication.
   *
   * - This function logs in a user using the provided OIDC token and public key, typically after a successful OAuth flow (Google, Apple, Facebook, etc).
   * - Optionally, it can invalidate any existing sessions for the user if `invalidateExisting` is set to true.
   * - Allows specifying a custom `sessionKey` for storing the session; otherwise, the default active session key is used.
   * - After successful login, updates the session state and refreshes user and wallet information to ensure the provider state is up to date.
   * - Triggers any configured callbacks for error handling or session events.
   *
   * @param oidcToken - The OIDC token received after successful OAuth authentication.
   * @param publicKey - The public key used for authentication and nonce generation.
   * @param invalidateExisting - Optional flag to invalidate existing sessions for the user.
   * @param sessionKey - Optional session key to use for session creation and storage.
   * @returns A promise that resolves to a signed JWT session token.
   * @throws {TurnkeyError} If the client is not initialized or if there is an error during login with OAuth.
   */
  loginWithOauth(params: {
    oidcToken: string;
    publicKey: string;
    invalidateExisting?: boolean;
    sessionKey?: string;
  }): Promise<string>;
  /**
   * Signs up a user using OAuth authentication.
   *
   * - This function registers a new user (sub-organization) using the provided OIDC token, public key, and provider name.
   * - If `createSubOrgParams` is not provided, it uses the default parameters from the configuration for OAuth sign-up.
   * - Optionally, a custom `sessionKey` can be specified for session creation and storage.
   * - After successful sign-up, the session and user state are refreshed and session expiration is scheduled.
   * - Triggers any configured callbacks for error handling or session events.
   *
   * @param oidcToken - The OIDC token received after successful OAuth authentication.
   * @param publicKey - The public key used for authentication and nonce generation.
   * @param providerName - The name of the OAuth provider (e.g., "google", "apple", "facebook").
   * @param createSubOrgParams - Optional parameters for creating a sub-organization (overrides configuration defaults).
   * @param sessionKey - Optional session key to use for session creation and storage.
   * @returns A promise that resolves to a signed JWT session token.
   * @throws {TurnkeyError} If the client or configuration is not initialized, or if there is an error during sign-up with OAuth.
   */
  signUpWithOauth(params: {
    oidcToken: string;
    publicKey: string;
    providerName: string;
    createSubOrgParams?: CreateSubOrgParams;
    sessionKey?: string;
  }): Promise<string>;
  /**
   * Fetches a list of wallets for the current user session.
   *
   * - Retrieves all wallets associated with the userId of the current session or the specified user.
   * - Automatically includes all wallet accounts for each wallet.
   * - Supports optional stamping with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet) for request authentication.
   * - Can be used to refresh the wallet state after wallet creation, import, or account changes.
   *
   * @param stampWith - Optional. Specifies the stamper to use for the request (Passkey, ApiKey, or Wallet).
   * @returns A promise that resolves to an array of `Wallet` objects, each containing wallet metadata and associated accounts.
   * @throws {TurnkeyError} If the client is not initialized or if there is an error fetching wallets.
   */
  fetchWallets(params?: DefaultParams): Promise<Wallet[]>;
  /**
   * Fetches a list of wallet accounts for a specific wallet.
   *
   * - Retrieves all accounts associated with the provided wallet, including metadata and account details.
   * - Supports optional pagination to control the number of accounts returned per request (defaults to the first page with a limit of 100 accounts if not specified).
   * - Can be stamped with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet) for request authentication.
   * - Useful for refreshing wallet account state after account creation, import, or external wallet linking.
   *
   * @param wallet - The wallet object for which to fetch accounts.
   * @param paginationOptions - Optional pagination options (before, after, and limit).
   * @param walletProviders - Optional list of wallet providers to filter or enrich the results.
   * @param stampWith - Optional parameter to stamp the request with a specific stamper.
   * @returns A promise that resolves to an array of `v1WalletAccount` objects containing account details.
   * @throws {TurnkeyError} If the client is not initialized or if there is an error fetching wallet accounts.
   */
  fetchWalletAccounts(
    params: {
      wallet: Wallet;
      paginationOptions?: v1Pagination;
      walletProviders?: WalletProvider[];
    } & DefaultParams,
  ): Promise<v1WalletAccount[]>;
  /**
   * Signs a message using the specified wallet account.
   *
   * - This function automatically determines the appropriate encoding and hash function for the message based on the wallet account's address type (e.g., Ethereum, Solana, Tron), unless explicitly overridden by the caller.
   * - Supports signing with any wallet account managed by Turnkey, including externally linked wallets.
   * - Handles all necessary message preparation steps, such as encoding (e.g., UTF-8, hex) and hashing (e.g., SHA256, Keccak256), to ensure compatibility with the target blockchain.
   * - Optionally allows the caller to override the encoding and hash function for advanced use cases.
   * - Supports stamping the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet) for granular control over authentication.
   * - Returns a result object containing the signed payload.
   *
   * @param message - The message to sign.
   * @param walletAccount - The wallet account to use for signing.
   * @param encoding - Optional override for the encoding used for the payload (defaults to the proper encoding for the address type).
   * @param hashFunction - Optional hash function to use (defaults to the proper hash function for the address type).
   * @param stampWith - Optional parameter to stamp the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   * @returns A promise that resolves to a `v1SignRawPayloadResult` object containing the signed message, signature, and metadata.
   * @throws {TurnkeyError} If the client is not initialized, the wallet account is invalid, or if there is an error signing the message.
   */
  signMessage(
    params: {
      message: string;
      walletAccount: v1WalletAccount;
      encoding?: v1PayloadEncoding;
      hashFunction?: v1HashFunction;
    } & DefaultParams,
  ): Promise<v1SignRawPayloadResult>;
  /**
   * Signs a transaction using the specified wallet account.
   *
   * - This function signs transactions for all supported blockchain networks (e.g., Ethereum, Solana, Tron).
   * - It automatically determines the correct signing method and handles any required encoding or hashing for the target blockchain.
   * - Supports signing with any wallet account managed by Turnkey, including externally linked wallets.
   * - Optionally allows the caller to specify a stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet) for granular authentication control.
   * - Returns a result object containing the signed transaction and any relevant metadata.
   *
   * @param signWith - The wallet address or account ID to use for signing the transaction.
   * @param unsignedTransaction - The unsigned transaction data to sign (as a serialized string).
   * @param type - The type of transaction (e.g., "TRANSACTION_TYPE_ETHEREUM", "TRANSACTION_TYPE_SOLANA", or "TRANSACTION_TYPE_TRON").
   * @param stampWith - Optional parameter to stamp the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   * @returns A promise that resolves to a `TSignTransactionResponse` object containing the signed transaction and metadata.
   * @throws {TurnkeyError} If the client is not initialized, the wallet account is invalid, or if there is an error signing the transaction.
   */
  signTransaction(
    params: {
      unsignedTransaction: string;
      transactionType: v1TransactionType;
      walletAccount: WalletAccount;
    } & DefaultParams,
  ): Promise<string>;
  /**
   * Fetches the user details for the current session or a specified user.
   *
   * - Retrieves user details based on the provided userId and/or organizationId, or defaults to the userId and organizationId from the current session if not specified.
   * - Supports optional stamping with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet) for request authentication.
   * - Useful for refreshing user profile information after authentication, updates, or linking/unlinking authenticators.
   * - Automatically handles error reporting via the configured callbacks.
   *
   * @param organizationId - Optional. The organization ID (sub-organization) to fetch the user from. Defaults to the current session's organization if not provided.
   * @param userId - Optional. The user ID to fetch. Defaults to the current session's userId if not provided.
   * @param stampWith - Optional. Specifies the stamper to use for the request (Passkey, ApiKey, or Wallet).
   * @returns A promise that resolves to a `v1User` object containing the user details.
   * @throws {TurnkeyError} If the client is not initialized or if there is an error fetching user details.
   */
  fetchUser(
    params?: {
      organizationId?: string;
      userId?: string;
    } & DefaultParams,
  ): Promise<v1User>;
  /**
   * Updates the user's email address.
   *
   * - This function updates the user's email address and, if provided, verifies it using a verification token (typically from an OTP flow).
   * - If a userId is provided, it updates the email for that specific user; otherwise, it uses the current session's userId.
   * - If a verificationToken is not provided, the email will be updated but may not be marked as verified until verification is completed.
   * - Automatically refreshes the user details state variable after the update to ensure the latest user information is available in the provider.
   * - Supports stamping the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet) for granular authentication control.
   * - Can be used as part of both add and update email flows, including modal-driven UI flows.
   *
   * @param email - The new email address to set for the user.
   * @param verificationToken - Optional verification token from OTP email verification (required for verified status).
   * @param userId - Optional user ID to update a specific user's email (defaults to the current session's userId).
   * @param stampWith - Optional parameter to stamp the request with a specific stamper (Passkey, ApiKey, or Wallet).
   * @returns A promise that resolves to the userId of the updated user.
   * @throws {TurnkeyError} If the client is not initialized or if there is an error updating the user email.
   */
  updateUserEmail(
    params: {
      email: string;
      verificationToken?: string;
      userId?: string;
    } & DefaultParams,
  ): Promise<string>;
  /**
   * Removes the user's email address.
   *
   * - This function removes the user's email address from their profile and automatically refreshes the user details state variable to reflect the change.
   * - If a userId is provided, it removes the email for that specific user; otherwise, it defaults to the current session's userId.
   * - Supports stamping the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet) for granular authentication control.
   * - After removal, the user details are refreshed to ensure the latest state is available in the provider.
   *
   * @param {string} userId - Optional user ID to remove a specific user's email (defaults to the current session's userId).
   * @param {StamperType} stampWith - Optional parameter to stamp the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   * @returns A promise that resolves to the userId of the user whose email was removed.
   * @throws {TurnkeyError} If the client is not initialized or if there is an error removing the user email.
   */
  removeUserEmail(
    params?: {
      userId?: string;
    } & DefaultParams,
  ): Promise<string>;
  /**
   * Updates the user's phone number.
   *
   * - This function updates the user's phone number and, if provided, verifies it using a verification token (typically from an OTP flow).
   * - If a userId is provided, it updates the phone number for that specific user; otherwise, it uses the current session's userId.
   * - If a verificationToken is not provided, the phone number will be updated but may not be marked as verified until verification is completed.
   * - Automatically refreshes the user details state variable after the update to ensure the latest user information is available in the provider.
   * - Supports stamping the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet) for granular authentication control.
   * - Can be used as part of both add and update phone number flows, including modal-driven UI flows.
   *
   * @param phoneNumber - The new phone number to set for the user.
   * @param verificationToken - Optional verification token from OTP phone verification (required for verified status).
   * @param userId - Optional user ID to update a specific user's phone number (defaults to the current session's userId).
   * @param stampWith - Optional parameter to stamp the request with a specific stamper (Passkey, ApiKey, or Wallet).
   * @returns A promise that resolves to the userId of the updated user.
   * @throws {TurnkeyError} If the client is not initialized or if there is an error updating the user phone number.
   */
  updateUserPhoneNumber(
    params: {
      phoneNumber: string;
      verificationToken?: string;
      userId?: string;
    } & DefaultParams,
  ): Promise<string>;
  /**
   * Removes the user's phone number.
   *
   * - This function removes the user's phone number from their user data and automatically refreshes the user details state variable to reflect the change.
   * - If a userId is provided, it removes the phone number for that specific user; otherwise, it defaults to the current session's userId.
   * - Supports stamping the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet) for granular authentication control.
   * - After removal, the user details are refreshed to ensure the latest state is available in the provider.
   *
   * @param userId - Optional user ID to remove a specific user's phone number (defaults to the current session's userId).
   * @param stampWith - Optional parameter to stamp the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   * @returns A promise that resolves to the userId of the user whose phone number was removed.
   * @throws {TurnkeyError} If the client is not initialized or if there is an error removing the user phone number.
   */
  removeUserPhoneNumber(
    params?: {
      userId?: string;
    } & DefaultParams,
  ): Promise<string>;
  /**
   * Updates the user's name.
   *
   * - This function updates the user's name and automatically refreshes the user details state variable to reflect the change.
   * - If a userId is provided, it updates the name for that specific user; otherwise, it uses the current session's userId.
   * - Supports stamping the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet) for granular authentication control.
   * - After the update, the latest user information is fetched to ensure the provider state is up to date.
   *
   * @param userName - The new name to set for the user.
   * @param userId - Optional user ID to update a specific user's name (defaults to the current session's userId).
   * @param stampWith - Optional parameter to stamp the request with a specific stamper (Passkey, ApiKey, or Wallet).
   * @returns A promise that resolves to the userId of the updated user.
   * @throws {TurnkeyError} If the client is not initialized or if there is an error updating the user name.
   */
  updateUserName(
    params: {
      userName: string;
      userId?: string;
    } & DefaultParams,
  ): Promise<string>;
  /**
   * Adds an OAuth provider to the user.
   *
   * - This function links an OAuth provider (Google, Apple, Facebook, etc.) to the user's data and automatically refreshes the user details state variable.
   * - If a userId is provided, it adds the provider for that specific user; otherwise, it uses the current session's userId.
   * - The function requires a valid OIDC token from the OAuth provider, which is typically obtained after a successful OAuth authentication flow.
   * - Supports stamping the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet) for granular authentication control.
   * - After successful addition, the user details are refreshed to ensure the latest state is available in the provider.
   * - Can be used as part of modal-driven UI flows or directly in code.
   *
   * @param providerName - The name of the OAuth provider to add (e.g., "google", "apple", "facebook").
   * @param oidcToken - The OIDC token for the OAuth provider, obtained from the OAuth flow.
   * @param userId - Optional user ID to add the provider for a specific user (defaults to current session's userId).
   * @param stampWith - Optional parameter to stamp the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   * @returns A promise that resolves to an array of provider IDs linked to the user after the addition.
   * @throws {TurnkeyError} If the client is not initialized or if there is an error adding the OAuth provider.
   */
  addOAuthProvider(
    params: {
      providerName: string;
      oidcToken: string;
      userId?: string;
    } & DefaultParams,
  ): Promise<string[]>;
  /**
   * Removes OAuth providers from the user.
   *
   * - This function removes OAuth providers (such as Google, Apple, or Facebook) from the user's linked authentication methods.
   * - Automatically refreshes the user details state variable after removal to ensure the latest provider list is available in the provider.
   * - If a userId is provided, it removes the providers for that specific user; otherwise, it defaults to the current session's userId.
   * - Supports stamping the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet) for granular authentication control.
   * - Can be used as part of modal-driven UI flows or directly in code.
   *
   * @param providerIds - The IDs of the OAuth providers to remove (as found in the user's provider list).
   * @param userId - Optional user ID to remove the providers for a specific user (defaults to the current session's userId).
   * @param stampWith - Optional parameter to stamp the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   * @returns A promise that resolves to an array of provider IDs that were removed.
   * @throws {TurnkeyError} If the client is not initialized or if there is an error removing the OAuth provider.
   */
  removeOAuthProviders(
    params: {
      providerIds: string[];
      userId?: string;
    } & DefaultParams,
  ): Promise<string[]>;
  /**
   * Adds a passkey for the user.
   *
   * - This function prompts the user to create a new passkey authenticator (using WebAuthn/FIDO2) and adds it to the user's authenticators.
   * - If a userId is provided, the passkey is added for that specific user; otherwise, it defaults to the current session's userId.
   * - The passkey can be given a custom name and displayName, which are stored as metadata and shown in the UI.
   * - After successful addition, the user details state is automatically refreshed to reflect the new authenticator.
   * - Supports stamping the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet) for granular authentication control.
   * - Can be used as part of modal-driven UI flows or directly in code.
   *
   * - **Note**: A passkey authenticator must be present in the user's authenticators list to use Passkey stamper to add a new one.
   *
   * @param name - Optional internal name for the passkey (for backend or developer reference).
   * @param displayName - Optional display name for the passkey (shown to the user in the UI).
   * @param userId - Optional user ID to add the passkey for a specific user (defaults to current session's userId).
   * @param stampWith - Optional parameter to stamp the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   * @returns A promise that resolves to an array of authenticator IDs (passkey IDs) after the addition.
   * @throws {TurnkeyError} If the client is not initialized, no session is found, or if there is an error adding the passkey.
   */
  addPasskey(
    params?: {
      authenticatorIds?: string[];
      userId?: string;
    } & DefaultParams,
  ): Promise<string[]>;
  /**
   * Removes passkeys (authenticators) for the user.
   *
   * - This function removes passkey authenticators from the user's data and automatically refreshes the user details state variable to reflect the change.
   * - If a userId is provided, it removes the passkeys for that specific user; otherwise, it defaults to the current session's userId.
   * - Supports stamping the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet) for granular authentication control.
   * - After removal, the user details are refreshed to ensure the latest authenticators list is available in the provider.
   * - Can be used as part of modal-driven UI flows or directly in code.
   *
   * @param authenticatorId - The ID of the authenticator (passkey) to remove.
   * @param userId - Optional user ID to remove the passkey for a specific user (defaults to the current session's userId).
   * @param stampWith - Optional parameter to stamp the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   * @returns A promise that resolves to an array of authenticator IDs that were removed.
   * @throws {TurnkeyError} If the client is not initialized, no session is found, or if there is an error removing the passkey.
   */
  removePasskeys(
    params: {
      authenticatorIds: string[];
      userId?: string;
    } & DefaultParams,
  ): Promise<string[]>;
  /**
   * Creates a new wallet for the user.
   *
   * - This function creates a new wallet for the user and automatically refreshes the wallets state variable after creation.
   * - If an organizationId is provided, the wallet will be created under that specific sub-organization; otherwise, it uses the current session's organization.
   * - If a list of account parameters or address formats is provided, those accounts will be created in the wallet (starting from path index 0 for address formats).
   * - Optionally, you can specify the mnemonic length for the wallet seed phrase.
   * - Supports stamping the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet) for granular authentication control.
   * - After creation, the wallets state is refreshed to reflect the new wallet.
   *
   * @param walletName - The name of the wallet to create.
   * @param accounts - Optional array of account parameters or address formats to create in the wallet.
   * @param organizationId - Optional organization ID to create the wallet under a specific sub-organization (defaults to current session's organization).
   * @param mnemonicLength - Optional mnemonic length for the wallet seed phrase.
   * @param stampWith - Optional parameter to stamp the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   * @returns A promise that resolves to the ID of the newly created wallet.
   * @throws {TurnkeyError} If the client is not initialized or if there is an error creating the wallet.
   */
  createWallet(
    params: {
      walletName: string;
      accounts?: v1WalletAccountParams[] | v1AddressFormat[];
      organizationId?: string;
      mnemonicLength?: number;
    } & DefaultParams,
  ): Promise<string>;
  /**
   * Creates new accounts in the specified wallet.
   *
   * - This function creates new wallet accounts in an existing wallet, using either explicit account parameters or address formats.
   * - If `accounts` is an array of account parameters, each account will be created with the specified settings.
   * - If `accounts` is an array of address formats, the function will determine the next available path index for each format and create new accounts accordingly.
   * - Automatically refreshes the wallets state variable after the accounts are created to ensure the latest state is available in the provider.
   * - If an `organizationId` is provided, the accounts will be created under that sub-organization (the walletId must belong to the sub-org).
   * - Supports stamping the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet) for granular authentication control.
   * - Can be used to add additional accounts to a wallet after initial creation, or to support new chains/address types.
   *
   * @param accounts - An array of account parameters (`v1WalletAccountParams[]`) or address formats (`v1AddressFormat[]`) to create in the wallet.
   * @param walletId - The ID of the wallet to create accounts in.
   * @param organizationId - Optional organization ID to create the accounts under a specific sub-organization (walletId must be associated with the sub-org).
   * @param stampWith - Optional parameter to stamp the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   * @returns A promise that resolves to an array of account IDs for the newly created accounts.
   * @throws {TurnkeyError} If the client is not initialized, the wallet is invalid, or if there is an error creating the wallet accounts.
   */
  createWalletAccounts(
    params: {
      accounts: v1WalletAccountParams[] | v1AddressFormat[];
      walletId: string;
      organizationId?: string;
    } & DefaultParams,
  ): Promise<string[]>;
  /**
   * Exports a wallet as an encrypted bundle.
   *
   * - This function exports the specified wallet and all of its accounts as an encrypted bundle, suitable for secure backup or transfer.
   * - The exported bundle contains the wallet's seed phrase, encrypted to the provided target public key, ensuring only the holder of the corresponding private key can decrypt it.
   * - If a `targetPublicKey` is provided, the bundle will be encrypted to that public key.
   * - If an `organizationId` is provided, the wallet will be exported under that sub-organization (the walletId must belong to the sub-org).
   * - Supports stamping the request with a specific stamper (`StamperType.Passkey`, `StamperType.ApiKey`, or `StamperType.Wallet`) for granular authentication control.
   * - After export, the wallets state is refreshed to ensure the latest state is available in the provider.
   *
   * @param walletId - The ID of the wallet to export.
   * @param targetPublicKey - The public key to encrypt the bundle to (required for secure export).
   * @param organizationId - Optional organization ID to export the wallet under a specific sub-organization (walletId must be associated with the sub-org).
   * @param stampWith - Optional parameter to stamp the request with a specific stamper (`StamperType.Passkey`, `StamperType.ApiKey`, or `StamperType.Wallet`).
   * @returns A promise that resolves to an `ExportBundle` object containing the encrypted wallet seed phrase and associated metadata.
   * @throws {TurnkeyError} If the client is not initialized, the wallet is invalid, or if there is an error exporting the wallet.
   */
  exportWallet(
    params: {
      walletId: string;
      targetPublicKey: string;
      organizationId?: string;
    } & DefaultParams,
  ): Promise<ExportBundle>;
  /**
   * Imports a wallet from an encrypted bundle.
   *
   * - This function imports a wallet using the provided encrypted bundle, which contains the wallet's seed phrase and metadata, encrypted to a target public key.
   * - The imported wallet will be created with the specified name and, optionally, with a set of accounts as defined by the provided parameters.
   * - If a userId is provided, the wallet will be imported for that specific user; otherwise, it defaults to the current session's userId.
   * - Supports stamping the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet) for granular authentication control.
   * - After a successful import, the wallets state is automatically refreshed to reflect the new wallet.
   * - Can be used to restore wallets from backup, migrate wallets between users, or import externally generated wallets.
   *
   * @param encryptedBundle - The encrypted bundle containing the wallet seed phrase and metadata.
   * @param walletName - The name to assign to the imported wallet.
   * @param accounts - Optional array of account parameters to create in the imported wallet (e.g., v1WalletAccountParams[]).
   * @param userId - Optional user ID to import the wallet for a specific user (defaults to the current session's userId).
   * @param stampWith - Optional parameter to stamp the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   * @returns A promise that resolves to the ID of the newly imported wallet.
   * @throws {TurnkeyError} If the client is not initialized, no session is found, or if there is an error importing the wallet.
   */
  importWallet(
    params: {
      encryptedBundle: string;
      walletName: string;
      accounts?: v1WalletAccountParams[];
      userId?: string;
    } & DefaultParams,
  ): Promise<string>;
  /**
   * Deletes a sub-organization (sub-org) for the current user.
   *
   * - This function deletes the specified sub-organization and, by default, will fail if any wallets associated with the sub-org have not been exported.
   * - If `deleteWithoutExport` is set to true, the sub-organization will be deleted even if its wallets have not been exported (use with caution, as this is irreversible).
   * - The deletion process will remove all user data, wallets, and accounts associated with the sub-organization.
   * - This action is permanent and cannot be undone. All private keys and wallet data will be lost if not exported prior to deletion.
   * - Typically used for account closure, user-initiated deletion, or compliance-driven data removal.
   *
   * @param deleteWithoutExport - Optional boolean flag. If true, deletes the sub-org without requiring wallet export. Defaults to false for safety.
   * @returns A promise that resolves to a `TDeleteSubOrganizationResponse` object containing the result of the deletion operation.
   * @throws {TurnkeyError} If the client is not initialized, if there is an error deleting the sub-organization, or if deletion is blocked due to unexported wallets (unless overridden).
   */
  deleteSubOrganization(
    params?: {
      deleteWithoutExport?: boolean;
    } & DefaultParams,
  ): Promise<TDeleteSubOrganizationResponse> /**
   * Stores a session token and updates the session associated with the specified session key, or by default the active session.
   *
   * - This function stores the session token in persistent storage and updates the active session state in the provider.
   * - If a sessionKey is provided, the session will be stored under that key; otherwise, the default active session key is used.
   * - After storing, it fetches the updated session and all sessions, and updates the provider state accordingly.
   * - Automatically schedules session expiration and warning timeouts based on the session's expiry time to ensure proper session lifecycle management.
   * - Ensures that the session and allSessions state variables are always in sync with the underlying client/session storage.
   * - Useful for restoring sessions after authentication flows, handling session tokens from external sources, or programmatically managing sessions.
   *
   * @param sessionToken - The session token (JWT) to store.
   * @param sessionKey - Optional session key to store the session under (defaults to the active session key).
   * @returns A promise that resolves when the session is successfully stored and state is updated.
   * @throws {TurnkeyError} If the client is not initialized or if there is an error storing or updating the session.
   */;
  storeSession(params: {
    sessionToken: string;
    sessionKey?: string;
  }): Promise<void>;
  /**
   * Clears the session associated with the specified session key, or by default the active session.
   *
   * - This function removes the session from persistent storage and updates the active session and all sessions state in the provider.
   * - If a sessionKey is provided, it will clear the session under that key; otherwise, it will use the active session key.
   * - After clearing, the session and allSessions state variables are updated to reflect the current state.
   * - Automatically handles error reporting via the configured callbacks.
   * - This does not clear all sessions; use `clearAllSessions` to remove all sessions and reset state.
   *
   * @param sessionKey - Optional session key to clear the session under (defaults to active session key).
   * @returns A promise that resolves when the session is successfully cleared and state is updated.
   * @throws {TurnkeyError} If the client is not initialized or if there is an error clearing the session.
   */
  clearSession(params?: { sessionKey?: string }): Promise<void>;
  /**
   * Clears all sessions and resets all session-related state in the provider.
   *
   * - This function removes all sessions from persistent storage and clears all session expiration and warning timeouts.
   * - It resets the active session and allSessions state variables to undefined, ensuring that no session data remains in memory.
   * - After calling this function, the provider will be in an unauthenticated state and all sensitive session/user/wallet information will be removed.
   * - Typically used for global logout, account deletion, or when a user wishes to remove all device sessions.
   * - Automatically handles error reporting via the configured callbacks.
   *
   * @returns A promise that resolves when all sessions are successfully cleared and state is reset.
   * @throws {TurnkeyError} If the client is not initialized or if there is an error clearing all sessions.
   */
  clearAllSessions(): Promise<void>;
  /**
   * Refreshes the session associated with the specified session key, or by default the active session.
   *
   * - This function refreshes the session and updates the active session state in the provider.
   * - If a sessionKey is provided, it will refresh the session under that key; otherwise, it will use the current active session key.
   * - Makes a request to the Turnkey API to stamp a new login and obtain a refreshed session token.
   * - Optionally allows specifying a new expiration time (expirationSeconds), a publicKey for stamping, or to invalidate the existing session before refreshing.
   * - After refreshing, automatically schedules session expiration and warning timeouts based on the new session's expiry.
   * - Updates both the session and allSessions state variables to ensure provider state is in sync with storage.
   * - Supports stamping the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet) for granular authentication control.
   * - Useful for extending session lifetimes, rotating session tokens, or proactively refreshing sessions before expiry.
   *
   * @param expirationSeconds - Optional expiration time in seconds for the refreshed session.
   * @param publicKey - Optional public key to use for the session refresh (for custom key-pair flows).
   * @param sessionKey - Optional session key to refresh the session under (defaults to the active session key).
   * @param invalidateExisitng - Optional flag to invalidate the existing session before refreshing.
   * @param stampWith - Optional parameter to stamp the request with a specific stamper (Passkey, ApiKey, or Wallet).
   * @returns A promise that resolves to a `TStampLoginResponse` object containing the refreshed session details.
   * @throws {TurnkeyError} If the client is not initialized, no active session is found, or if there is an error refreshing the session.
   */
  refreshSession(
    params?: {
      expirationSeconds?: string;
      publicKey?: string;
      sessionKey?: string;
      invalidateExisitng?: boolean;
    } & DefaultParams,
  ): Promise<TStampLoginResponse | undefined>;
  /**
   * Retrieves the session associated with the specified session key, or the active session by default.
   *
   * - This function fetches a session from storage, either by the provided sessionKey or, if not specified, the current active session key.
   * - It returns the session details or undefined if no session is found.
   * - Useful for checking the current authentication state, restoring sessions, or accessing session metadata for advanced flows.
   * - Automatically handles error reporting via the configured callbacks.
   *
   * @param sessionKey - Optional session key to retrieve a specific session (defaults to the active session key if not provided).
   * @returns A promise that resolves to a `Session` object containing the session details, or undefined if not found.
   * @throws {TurnkeyError} If the client is not initialized or if there is an error retrieving the session.
   */
  getSession(params?: { sessionKey?: string }): Promise<Session | undefined>;
  /**
   * Retrieves all sessions stored in persistent storage for the current client.
   *
   * - This function fetches all sessions managed by the Turnkey client.
   * - Returns a record mapping session keys to their corresponding `Session` objects, including metadata such as expiry, userId, and organizationId.
   * - Useful for multi-session management, restoring sessions after reload, or displaying a list of active device/browser sessions.
   * - Automatically handles error reporting via the configured callbacks.
   *
   * @returns A promise that resolves to a record of session keys and their corresponding `Session` objects, or `undefined` if no sessions are found.
   * @throws {TurnkeyError} If the client is not initialized or if there is an error retrieving all sessions.
   */
  getAllSessions(): Promise<Record<string, Session> | undefined>;
  /**
   * Sets the active session to the specified session key.
   *
   * - This function updates the active session state in the client and in the provider.
   * - It sets the specified session as the active session, both in the underlying client and in local storage.
   * - After setting, it updates the session state in the provider to reflect the new active session.
   * - Ensures that all session-dependent state and UI are synchronized with the new active session.
   * - Useful for multi-session management, allowing users to switch between sessions/devices.
   *
   * @param sessionKey - The session key to set as the active session.
   * @returns A promise that resolves when the active session is successfully set and state is updated.
   * @throws {TurnkeyError} If the client is not initialized, the session is not found, or if there is an error setting the active session.
   */
  setActiveSession(params: { sessionKey: string }): Promise<void>;
  /**
   * Retrieves the active session key for the current client instance.
   *
   * - This function fetches the session key that is currently set as active in the Turnkey client.
   * - The active session key is used to identify which session is currently in use for authentication and API requests.
   * - Returns the session key as a string if an active session exists, or `undefined` if no session is currently active.
   * - Useful for multi-session management, restoring sessions after reload, or switching between user/device sessions.
   * - Automatically handles error reporting via the configured callbacks.
   *
   * @returns A promise that resolves to the active session key as a string, or `undefined` if no active session is found.
   * @throws {TurnkeyError} If the client is not initialized or if there is an error retrieving the active session key.
   */
  getActiveSessionKey(): Promise<string | undefined>;
  /**
   * Clears unused API key pairs from IndexedDB storage.
   *
   * - This function scans all API key pairs stored in IndexedDB and removes any that are not currently associated with an active session or in use by the client.
   * - It is useful for cleaning up orphaned or stale key pairs that may accumulate after session removal, logout, or failed authentication attempts.
   * - This helps reduce storage usage and improves security by ensuring only necessary key pairs remain.
   * - Typically called after session cleanup, logout, or as part of periodic maintenance.
   *
   * @returns A promise that resolves when all unused key pairs are successfully removed.
   * @throws {TurnkeyError} If the client is not initialized or if there is an error clearing unused key pairs.
   */
  clearUnusedKeyPairs(): Promise<void>;
  /**
   * Creates a new API key pair for the client.
   *
   * - This function generates a new API key pair and stores it in IndexedDB for secure local use.
   * - If an `externalKeyPair` is provided, it will use that key pair (either a CryptoKeyPair or an object with public/private key strings) instead of generating a new one.
   * - If `storeOverride` is set to true, the generated or provided key pair will be set as the active key pair for the API key stamper, overriding any existing key pair.
   * - The public key is returned as a string, suitable for use in authentication flows (such as OAuth, passkey, or wallet flows).
   * - This function is used internally for flows that require a unique public key for nonce generation or cryptographic operations, and can also be called directly for advanced use cases.
   *
   * @param externalKeyPair - Optional. An externally generated key pair to use for API key creation (CryptoKeyPair or { publicKey, privateKey }).
   * @param storeOverride - Optional. If true, sets the generated or provided key pair as the active API key pair (default: false).
   * @returns A promise that resolves to the public key of the created or provided API key pair as a string.
   * @throws {TurnkeyError} If the client is not initialized or if there is an error creating or storing the API key pair.
   */
  createApiKeyPair(params?: {
    externalKeyPair?:
      | CryptoKeyPair
      | {
          publicKey: string;
          privateKey: string;
        };
    storeOverride?: boolean;
  }): Promise<string>;
  /**
   * Retrieves the proxy authentication configuration from the Turnkey Auth Proxy.
   *
   * - This function makes a request to the configured Turnkey Auth Proxy to fetch the current authentication configuration,
   *   including enabled authentication methods (email, SMS, passkey, wallet, OAuth providers), session expiration settings,
   *   and any proxy-specific overrides or feature flags.
   * - The returned configuration is used to dynamically build the provider's master configuration and determine which
   *   authentication flows and UI options should be available to the user.
   * - Typically called automatically during provider initialization if an `authProxyId` is present in the config,
   *   but can also be called directly to refresh or inspect the proxy's settings.
   *
   * @returns A promise that resolves to a `ProxyTGetWalletKitConfigResponse` object containing the proxy auth config and feature flags.
   * @throws {TurnkeyError} If the client is not initialized or if there is an error retrieving the proxy auth config.
   */
  getProxyAuthConfig(): Promise<ProxyTGetWalletKitConfigResponse>;

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
   * @param stampWith - Optional parameter to stamp the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   * @returns A promise that resolves when the user details are successfully refreshed and state is updated.
   * @throws {TurnkeyError} If the client is not initialized or if there is an error refreshing the user details.
   */
  refreshUser(params?: DefaultParams): Promise<void>;

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
   * @param stampWith - Optional parameter to stamp the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   * @returns A promise that resolves when the wallets are successfully refreshed and state is updated.
   * @throws {TurnkeyError} If the client is not initialized or if there is an error refreshing the wallets.
   */
  refreshWallets(params?: DefaultParams): Promise<void>;

  /**
   * Handles the login or sign-up flow.
   *
   * - This function opens a modal with the AuthComponent, allowing the user to log in or sign up using any enabled authentication method (Passkey, Wallet, OTP, or OAuth).
   * - It automatically determines available authentication methods based on the current provider configuration and proxy settings.
   * - The modal-driven flow guides the user through the appropriate authentication steps, including social login if enabled.
   * - After successful authentication, the provider state is updated and all relevant session, user, and wallet data are refreshed.
   * - This function is typically used to trigger authentication from a UI button or navigation event.
   *
   * @returns A void promise.
   */
  handleLogin(): Promise<void>;

  /**
   * Handles the Google OAuth flow.
   *
   * - This function initiates the Google OAuth flow by redirecting the user to the Google authorization page or opening it in a popup window.
   * - It supports both "popup" and "redirect" flows, determined by the `openInPage` parameter.
   * - Generates a new ephemeral API key pair and uses its public key as the nonce for the OAuth request, ensuring cryptographic binding of the session.
   * - Constructs the Google OAuth URL with all required parameters, including client ID, redirect URI, response type, scope, nonce, and state.
   * - The `state` parameter includes the provider, flow type, public key, and any additional state parameters for tracking or custom logic.
   * - If `openInPage` is true, the current page is redirected to the Google OAuth URL and the function returns a promise that resolves on redirect or times out after 5 minutes.
   * - If `openInPage` is false, a popup window is opened for the OAuth flow, and the function returns a promise that resolves when the flow completes or rejects if the window is closed or times out.
   * - On successful authentication, the function either calls the provided `onOAuthSuccess` callback, triggers the `onOauthRedirect` callback from provider callbacks, or completes the OAuth flow internally by calling `completeOauth`.
   * - Handles all error cases, including missing configuration, popup failures, and timeouts, and throws a `TurnkeyError` with appropriate error codes.
   *
   * @param clientId - Optional. The Google Client ID to use (defaults to the client ID from configuration).
   * @param openInPage - Optional. Whether to open the OAuth flow in the current page (redirect) or a popup window (default: false).
   * @param additionalState - Optional. Additional key-value pairs to include in the OAuth state parameter for custom tracking or logic.
   * @param onOAuthSuccess - Optional. Callback function to handle the successful OAuth response (receives `{ oidcToken, providerName }`).
   *
   * onOAuthSuccess params:
   * - oidcToken: The OIDC token received from the OAuth flow.
   * - providerName: The name of the OAuth provider ("google").
   *
   * @returns A promise that resolves when the OAuth flow is successfully initiated and completed, or rejects on error or timeout.
   * @throws {TurnkeyError} If the configuration is not ready, required parameters are missing, or if there is an error initiating or completing the OAuth flow.
   */
  handleGoogleOauth(params: {
    clientId?: string;
    additionalState?: Record<string, string>;
    openInPage?: boolean;
  }): Promise<void>;

  /**
   * Handles the Apple OAuth flow.
   *
   * - This function initiates the Apple OAuth flow by either redirecting the user to the Apple authorization page or opening it in a popup window.
   * - The flow type is determined by the `openInPage` parameter: if true, the current page is redirected; if false (default), a popup window is used.
   * - Generates a new ephemeral API key pair and uses its public key as the nonce for the OAuth request, ensuring cryptographic binding of the session.
   * - Constructs the Apple OAuth URL with all required parameters, including client ID, redirect URI, response type, response mode, nonce, and state.
   * - The `state` parameter includes the provider, flow type, public key, and any additional state parameters for tracking or custom logic.
   * - If `openInPage` is true, the function redirects and returns a promise that resolves on redirect or times out after 5 minutes.
   * - If `openInPage` is false, a popup window is opened and the function returns a promise that resolves when the flow completes, or rejects if the window is closed or times out.
   * - On successful authentication, the function either calls the provided `onOAuthSuccess` callback, triggers the `onOauthRedirect` callback from provider callbacks, or completes the OAuth flow internally by calling `completeOauth`.
   * - Handles all error cases, including missing configuration, popup failures, and timeouts, and throws a `TurnkeyError` with appropriate error codes.
   *
   * @param clientId - Optional. The Apple Client ID to use (defaults to the client ID from configuration).
   * @param openInPage - Optional. Whether to open the OAuth flow in the current page (redirect) or a popup window (default: false).
   * @param additionalState - Optional. Additional key-value pairs to include in the OAuth state parameter for custom tracking or logic.
   * @param onOAuthSuccess - Optional. Callback function to handle the successful OAuth response (receives `{ oidcToken, providerName }`).
   *
   * onOAuthSuccess params:
   * - oidcToken: The OIDC token received from the OAuth flow.
   * - providerName: The name of the OAuth provider ("apple").
   *
   * @returns A promise that resolves when the OAuth flow is successfully initiated and completed, or rejects on error or timeout.
   * @throws {TurnkeyError} If the configuration is not ready, required parameters are missing, or if there is an error initiating or completing the OAuth flow.
   */
  handleAppleOauth(params: {
    clientId?: string;
    additionalState?: Record<string, string>;
    openInPage?: boolean;
  }): Promise<void>;

  /**
   * Handles the Facebook OAuth flow.
   *
   * - This function initiates the Facebook OAuth flow by either redirecting the user to the Facebook authorization page or opening it in a popup window.
   * - The flow type is determined by the `openInPage` parameter: if true, the current page is redirected; if false (default), a popup window is used.
   * - Generates a new ephemeral API key pair and uses its public key as the nonce for the OAuth request, ensuring cryptographic binding of the session.
   * - Uses PKCE (Proof Key for Code Exchange) for enhanced security, generating a code verifier and challenge for the Facebook OAuth flow.
   * - Constructs the Facebook OAuth URL with all required parameters, including client ID, redirect URI, response type, code challenge, nonce, and state.
   * - The `state` parameter includes the provider, flow type, public key, and any additional state parameters for tracking or custom logic.
   * - If `openInPage` is true, the function redirects and returns a promise that resolves on redirect or times out after 5 minutes.
   * - If `openInPage` is false, a popup window is opened and the function returns a promise that resolves when the flow completes, or rejects if the window is closed or times out.
   * - On successful authentication, the function either calls the provided `onOAuthSuccess` callback, triggers the `onOauthRedirect` callback from provider callbacks, or completes the OAuth flow internally by calling `completeOauth`.
   * - Handles all error cases, including missing configuration, popup failures, and timeouts, and throws a `TurnkeyError` with appropriate error codes.
   *
   * @param clientId - Optional. The Facebook Client ID to use (defaults to the client ID from configuration).
   * @param openInPage - Optional. Whether to open the OAuth flow in the current page (redirect) or a popup window (default: false).
   * @param additionalState - Optional. Additional key-value pairs to include in the OAuth state parameter for custom tracking or logic.
   * @param onOAuthSuccess - Optional. Callback function to handle the successful OAuth response (receives `{ oidcToken, providerName }`).
   *
   * onOAuthSuccess params:
   * - oidcToken: The OIDC token received from the OAuth flow.
   * - providerName: The name of the OAuth provider ("facebook").
   *
   * @returns A promise that resolves when the OAuth flow is successfully initiated and completed, or rejects on error or timeout.
   * @throws {TurnkeyError} If the configuration is not ready, required parameters are missing, or if there is an error initiating or completing the OAuth flow.
   */
  handleFacebookOauth(params: {
    clientId?: string;
    additionalState?: Record<string, string>;
    openInPage?: boolean;
  }): Promise<void>;

  /**
   * Handles the export flow.
   *
   * - This function opens a modal with the ExportComponent for exporting a wallet or private key.
   * - Uses Turnkey's export iframe flow to securely export wallet or private key material.
   * - The export process encrypts the exported bundle to a target public key, which is generated and managed inside the iframe for maximum security.
   * - A request is made to the Turnkey API to export the wallet or private key, encrypted to the target public key.
   * - The resulting export bundle is injected into the iframe, where it is decrypted and displayed to the user.
   * - Supports both full wallet exports (ExportType.Wallet) and single private key exports (ExportType.PrivateKey).
   * - If a custom iframe URL is used, a target public key can be provided explicitly.
   * - Optionally allows specifying the stamper to use for the export (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet) for granular authentication control.
   * - The modal-driven UI ensures the user is guided through the export process and can securely retrieve their exported material.
   *
   * @param walletId - The ID of the wallet to export.
   * @param exportType - The type of export to perform (ExportType.Wallet or ExportType.PrivateKey).
   * @param targetPublicKey - Optional. The target public key to encrypt the export bundle to (required for custom iframe flows).
   * @param stampWith - Optional. The stamper to use for the export (Passkey, ApiKey, or Wallet).
   *
   * @returns A void promise.
   */
  handleExport(
    params: {
      walletId: string;
      exportType: ExportType;
      targetPublicKey?: string;
    } & DefaultParams,
  ): Promise<void>;

  /**
   * Handles the import flow.
   *
   * - This function opens a modal with the ImportComponent for importing a wallet or private key.
   * - Supports importing wallets using an encrypted bundle, with optional default accounts or custom account parameters.
   * - Allows users to specify default wallet accounts (address formats or account params) to pre-fill the import form.
   * - Optionally accepts a callback to handle successful import, which receives the imported wallet's ID.
   * - Supports customizing the duration of the success page shown after a successful import.
   * - Allows specifying the stamper to use for the import (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet) for granular authentication control.
   * - Ensures the imported wallet is added to the user's wallet list and the provider state is refreshed.
   *
   * @param defaultWalletAccounts - Optional array of default wallet accounts (v1AddressFormat[] or v1WalletAccountParams[]) to pre-fill the import form.
   * @param successPageDuration - Optional duration (in ms) for the success page after import (default: 0, no success page).
   * @param stampWith - Optional parameter to specify the stamper to use for the import (Passkey, ApiKey, or Wallet).
   *
   * @returns A promise that resolves to the new wallet's ID.
   */
  handleImport(
    params: {
      defaultWalletAccounts?: v1AddressFormat[] | v1WalletAccountParams[];
      successPageDuration?: number | undefined; // Duration in milliseconds for the success page to show. If 0, it will not show the success page.
    } & DefaultParams,
  ): Promise<string>;

  /**
   * Handles the update user name flow.
   *
   * - This function opens a modal with the UpdateUserName component for updating and verifying the user's name.
   * - If a userName is provided, it will directly update the user name without showing the modal.
   * - Uses updateUserName under the hood to perform the update and automatically refreshes the user details state after a successful update.
   * - Optionally displays a success page after the update, with customizable duration.
   * - Supports passing a custom title and subtitle for the modal UI.
   * - Supports stamping the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet) for granular authentication control.
   * - Handles all error cases and throws a TurnkeyError with appropriate error codes.
   *
   * @param userName - Optional parameter to specify the new user name.
   * @param title - Optional title for the modal.
   * @param subTitle - Optional subtitle for the modal.
   * @param successPageDuration - Optional duration (in ms) for the success page after update (default: 0, no success page).
   * @param stampWith - Optional parameter to specify the stamper to use for the update (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   *
   * @returns A promise that resolves to the userId of the user that was changed.
   * @throws {TurnkeyError} If the client is not initialized, no active session is found, or if there is an error updating the user name.
   */
  handleUpdateUserEmail(params?: {
    email?: string;
    title?: string;
    subTitle?: string;
    successPageDuration?: number | undefined; // Duration in milliseconds for the success page to show. If 0, it will not show the success page.
  }): Promise<string>;

  /**
   * Handles the update user phone number flow.
   *
   * - This function opens a modal with the UpdatePhoneNumber component for updating and verifying the user's phone number.
   * - If a phoneNumber is provided, it will directly send an OTP request to the user and display the OTP verification modal.
   * - Supports both manual entry and pre-filled phone numbers, as well as custom modal titles and subtitles.
   * - Uses the updatePhoneNumberContinue helper to manage the OTP flow, verification, and update logic.
   * - After successful verification and update, the user details state is refreshed and an optional success page can be shown.
   * - Supports customizing the duration of the success page after update.
   * - Throws a TurnkeyError if the client is not initialized, no active session is found, SMS OTP is not enabled, or if there is an error updating the phone number.
   *
   * @param phoneNumber - Optional parameter to specify the new phone number.
   * @param formattedPhone - Optional parameter to specify the formatted phone number.
   * @param title - Optional title for the modal.
   * @param subTitle - Optional subtitle for the modal.
   * @param successPageDuration - Optional duration for the success page (default: 0, no success page).
   *
   * @returns A promise that resolves to the userId of the user that was changed.
   * @throws {TurnkeyError} If the client is not initialized, no active session is found, SMS OTP is not enabled, or if there is an error updating the phone number.
   */
  handleUpdateUserPhoneNumber(params?: {
    phoneNumber?: string;
    formattedPhone?: string;
    title?: string;
    subTitle?: string;
    successPageDuration?: number | undefined; // Duration in milliseconds for the success page to show. If 0, it will not show the success page.
  }): Promise<string>;

  /**
   * Handles the update user email flow.
   *
   * - This function opens a modal with the UpdateEmail component for updating and verifying the user's email address.
   * - If an email is provided, it will immediately send an OTP request to the user and display the OTP verification modal.
   * - Supports both manual entry and pre-filled email addresses, as well as custom modal titles and subtitles.
   * - Uses the updateEmailContinue helper to manage the OTP flow, verification, and update logic.
   * - After successful verification and update, the user details state is refreshed and an optional success page can be shown.
   * - Supports customizing the duration of the success page after update.
   * - Handles all error cases and throws a TurnkeyError with appropriate error codes.
   *
   * @param email - Optional parameter to specify the new email address.
   * @param title - Optional title for the modal.
   * @param subTitle - Optional subtitle for the modal.
   * @param successPageDuration - Optional duration (in ms) for the success page after update (default: 0, no success page).
   *
   * @returns A promise that resolves to the userId of the user that was changed.
   * @throws {TurnkeyError} If the client is not initialized, no active session is found, or if there is an error updating the email.
   */
  handleUpdateUserName: (
    params?: {
      userName?: string;
      title?: string;
      subTitle?: string;
      successPageDuration?: number | undefined; // Duration in milliseconds for the success page to show. If 0, it will not show the success page.
    } & DefaultParams,
  ) => Promise<string>;
  /**
   * Handles the add user email flow.
   *
   * - This function opens a modal with the UpdateEmail component, using a modified title and flow for adding and verifying the user's email address.
   * - If an email is provided, it will immediately send an OTP request to the user and display the OTP verification modal.
   * - Supports both manual entry and pre-filled email addresses, as well as custom modal titles and subtitles.
   * - Uses the addEmailContinue helper to manage the OTP flow, verification, and update logic.
   * - After successful verification and update, the user details state is refreshed and an optional success page can be shown.
   * - Supports customizing the duration of the success page after update.
   * - Handles all error cases and throws a TurnkeyError with appropriate error codes.
   *
   * @param email - Optional parameter to specify the new email address.
   * @param title - Optional title for the modal (defaults to "Connect an email" if the user does not have an email).
   * @param subTitle - Optional subtitle for the modal.
   * @param successPageDuration - Optional duration (in ms) for the success page after update (default: 0, no success page).
   *
   * @returns A promise that resolves to the userId of the user that was changed.
   * @throws {TurnkeyError} If the client is not initialized, no active session is found, or if there is an error adding the email.
   */
  handleAddEmail: (params?: {
    email?: string;
    title?: string;
    subTitle?: string;
    successPageDuration?: number | undefined; // Duration in milliseconds for the success page to show. If 0, it will not show the success page.
  }) => Promise<string>;

  /**
   * Handles the add phone number flow.
   *
   * - This function opens a modal with the UpdatePhoneNumber component for adding and verifying the user's phone number.
   * - If a phone number is provided, it will immediately send an OTP request to the user and display the OTP verification modal.
   * - Supports both manual entry and pre-filled phone numbers, as well as custom modal titles and subtitles.
   * - Uses the addPhoneNumberContinue helper to manage the OTP flow, verification, and update logic.
   * - After successful verification and update, the user details state is refreshed and an optional success page can be shown.
   * - Supports customizing the duration of the success page after update.
   * - Handles all error cases and throws a TurnkeyError with appropriate error codes.
   *
   * @param phoneNumber - Optional parameter to specify the new phone number.
   * @param formattedPhone - Optional parameter to specify the formatted phone number.
   * @param title - Optional title for the modal.
   * @param subTitle - Optional subtitle for the modal.
   * @param successPageDuration - Optional duration (in ms) for the success page after update (default: 0, no success page).
   *
   * @returns A promise that resolves to the userId of the user that was changed.
   * @throws {TurnkeyError} If the client is not initialized, no active session is found, or if there is an error adding the phone number.
   */
  handleAddPhoneNumber(params?: {
    phoneNumber?: string;
    formattedPhone?: string;
    title?: string;
    subTitle?: string;
    successPageDuration?: number | undefined; // Duration in milliseconds for the success page to show. If 0, it will not show the success page.
  }): Promise<string>;

  /**
   * Handles the addition of an OAuth provider for the user.
   *
   * - This function opens a modal-driven flow for linking a new OAuth provider (Google, Apple, or Facebook) to the user's account.
   * - It supports all enabled OAuth providers as defined in the configuration and dynamically triggers the appropriate OAuth flow.
   * - Uses the handleGoogleOauth, handleAppleOauth, and handleFacebookOauth functions to initiate the provider-specific OAuth authentication process.
   * - After successful authentication, the provider is linked to the user's account and a success page is shown.
   * - Automatically refreshes the user details state after linking to ensure the latest provider list is available in the provider.
   * - Optionally allows specifying the stamper to use for the addition (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet) for granular authentication control.
   * - Handles all error cases and throws a TurnkeyError with appropriate error codes.
   *
   * @param providerName - The name of the OAuth provider to add (OAuthProviders.GOOGLE, OAuthProviders.APPLE, OAuthProviders.FACEBOOK).
   * @param stampWith - Optional parameter to specify the stamper to use for the addition (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   *
   * @returns A void promise.
   * @throws {TurnkeyError} If the client is not initialized, no active session is found, or if there is an error adding the provider.
   */
  handleAddOAuthProvider(
    params: {
      providerName: OAuthProviders;
    } & DefaultParams,
  ): Promise<void>;

  /**
   * Handles the removal of an OAuth provider.
   *
   * - This function opens a modal with the RemoveOAuthProvider component, allowing the user to confirm and remove an OAuth provider (such as Google, Apple, or Facebook) from their account.
   * - It supports specifying the provider ID to remove, as well as optional modal title and subtitle for custom UI messaging.
   * - After successful removal, the user details state is refreshed to reflect the updated list of linked OAuth providers.
   * - Optionally, a callback can be provided to handle successful removal, receiving the updated list of provider IDs.
   * - Supports customizing the duration of the success page shown after removal.
   * - Allows specifying the stamper to use for the removal (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet) for granular authentication control.
   * - Handles all error cases and throws a TurnkeyError with appropriate error codes.
   *
   * @param providerId - The ID of the OAuth provider to remove (as found in the user's provider list).
   * @param title - Optional title for the modal.
   * @param subTitle - Optional subtitle for the modal.
   * @param successPageDuration - Optional duration (in ms) for the success page after removal (default: 0, no success page).
   * @param stampWith - Optional parameter to specify the stamper to use for the removal (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   *
   * @returns A promise that resolves to an array of provider IDs that were removed.
   * @throws {TurnkeyError} If the client is not initialized, no active session is found, or if there is an error removing the provider.
   */
  handleRemoveOAuthProvider(
    params: {
      providerId: string;
      title?: string;
      subTitle?: string;
      successPageDuration?: number | undefined; // Duration in milliseconds for the success page to show. If 0, it will not show the success page.
    } & DefaultParams,
  ): Promise<string[]>;

  /**
   * Handles the addition of a passkey (authenticator) for the user.
   *
   * - This function opens a modal-driven flow for adding a new passkey authenticator (WebAuthn/FIDO2) to the user's account.
   * - If a `name` or `displayName` is provided, those will be used for the passkey metadata; otherwise, defaults are generated based on the website and timestamp.
   * - The passkey is created and linked to the specified user (by `userId`) or the current session's user if not provided.
   * - After successful addition, a success page is shown for the specified duration (or skipped if `successPageDuration` is 0).
   * - Supports stamping the request with a specific stamper (`StamperType.Passkey`, `StamperType.ApiKey`, or `StamperType.Wallet`) for granular authentication control.
   * - Automatically refreshes the user details state after successful addition to ensure the latest authenticators list is available in the provider.
   * - Handles all error cases and throws a `TurnkeyError` with appropriate error codes.
   *
   * @param name - Optional internal name for the passkey (for backend or developer reference).
   * @param displayName - Optional display name for the passkey (shown to the user in the UI).
   * @param userId - Optional user ID to add the passkey for a specific user (defaults to current session's userId).
   * @param successPageDuration - Optional duration (in ms) for the success page after addition (default: 0, no success page).
   * @param stampWith - Optional parameter to stamp the request with a specific stamper (`StamperType.Passkey`, `StamperType.ApiKey`, or `StamperType.Wallet`).
   *
   * @returns A promise that resolves to the user's updated passkeys.
   * @throws {TurnkeyError} If the client is not initialized, no active session is found, or if there is an error adding the passkey.
   */
  handleAddPasskey(
    params?: {
      name?: string;
      displayName?: string;
      userId?: string;
      successPageDuration?: number | undefined; // Duration in milliseconds for the success page to show. If 0, it will not show the success page.
    } & DefaultParams,
  ): Promise<string[]>;

  /**
   * Handles the removal of a passkey (authenticator) for the user.
   *
   * - This function opens a modal with the RemovePasskey component, allowing the user to confirm and remove a passkey authenticator from their account.
   * - It supports specifying the authenticator ID to remove, as well as optional modal title and subtitle for custom UI messaging.
   * - After successful removal, the user details state is refreshed to reflect the updated list of authenticators.
   * - Supports customizing the duration of the success page shown after removal.
   * - Allows specifying the stamper to use for the removal (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet) for granular authentication control.
   * - Handles all error cases and throws a TurnkeyError with appropriate error codes.
   *
   * @param authenticatorId - The ID of the authenticator (passkey) to remove.
   * @param userId - Optional user ID to remove the passkey for a specific user (defaults to current session's userId).
   * @param title - Optional title for the modal.
   * @param subTitle - Optional subtitle for the modal.
   * @param successPageDuration - Optional duration (in ms) for the success page after removal (default: 0, no success page).
   * @param stampWith - Optional parameter to specify the stamper to use for the removal (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   *
   * @returns A promise that resolves to an array of authenticator IDs that were removed.
   * @throws {TurnkeyError} If the client is not initialized, no active session is found, or if there is an error removing the passkey.
   */
  handleRemovePasskey(
    params: {
      authenticatorId: string;
      userId?: string;
      title?: string;
      subTitle?: string;
      successPageDuration?: number | undefined; // Duration in milliseconds for the success page to show. If 0, it will not show the success page.
    } & DefaultParams,
  ): Promise<string[]>;

  /**
   * Handles the signing of a message by displaying a modal for user interaction.
   *
   * - This function opens a modal with the SignMessageModal component, prompting the user to review and approve the message signing request.
   * - Supports signing with any wallet account managed by Turnkey, including externally linked wallets.
   * - Allows for optional overrides of the encoding and hash function used for the payload, enabling advanced use cases or compatibility with specific blockchains.
   * - Optionally displays a subtext in the modal for additional context or instructions to the user.
   * - Supports stamping the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet) for granular authentication control.
   * - Returns a promise that resolves to a `v1SignRawPayloadResult` object containing the signed message, signature, and metadata.
   *
   * @param message - The message to sign.
   * @param walletAccount - The wallet account to use for signing.
   * @param encoding - Optional encoding for the payload (defaults to the proper encoding for the account type).
   * @param hashFunction - Optional hash function to use (defaults to the appropriate function for the account type).
   * @param subText - Optional subtext to display in the modal.
   * @param stampWith - Optional parameter to stamp the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   * @param successPageDuration - Optional duration in seconds to display the success page after signing.
   * @returns A promise that resolves to a `v1SignRawPayloadResult` object containing the signed message.
   * @throws {TurnkeyError} If the client is not initialized or if there is an error during the signing process.
   */
  handleSignMessage(
    params: {
      message: string;
      walletAccount: v1WalletAccount;
      encoding?: v1PayloadEncoding;
      hashFunction?: v1HashFunction;
      subText?: string;
      successPageDuration?: number | undefined; // Duration in milliseconds for the success page to show. If 0, it will not show the success page.
    } & DefaultParams,
  ): Promise<v1SignRawPayloadResult>;

  /**
   * Handles the linking of an external wallet account to the user's Turnkey account.
   *
   * - This function opens a modal with the LinkWalletModal component, allowing the user to select and connect an external wallet provider (such as MetaMask, Phantom, etc.).
   * - It fetches the list of available wallet providers (for all supported chains) and passes them to the modal for user selection.
   * - After a successful wallet connection, the provider state is refreshed to include the newly linked wallet account.
   * - Optionally, a success page is shown for the specified duration after linking (default: 2000ms).
   * - Supports both Ethereum and Solana wallet providers, and can be extended to additional chains as supported by Turnkey.
   * - Handles all error cases and throws a TurnkeyError with appropriate error codes if the client is not initialized or no active session is found.
   *
   * @param successPageDuration - Optional duration (in ms) for the success page after linking (default: 2000ms).
   *
   * @returns A void promise.
   * @throws {TurnkeyError} If the client is not initialized or if no active session is found.
   */
  handleLinkExternalWallet(params: {}): Promise<void>;
}

export const ClientContext = createContext<ClientContextType | undefined>(
  undefined,
);

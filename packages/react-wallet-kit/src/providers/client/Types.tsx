"use client";

import type {
  TurnkeySDKClientBase,
  TurnkeyClientMethods,
  Wallet,
  StamperType,
  WalletAccount,
} from "@turnkey/core";
import type {
  OAuthProviders,
  Session,
  v1AddressFormat,
  v1HashFunction,
  v1PayloadEncoding,
  v1SignRawPayloadResult,
  v1User,
  v1WalletAccountParams,
} from "@turnkey/sdk-types";
import type {
  TurnkeyProviderConfig,
  AuthState,
  ClientState,
} from "../../types/base";
import { createContext } from "react";

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

export interface ClientContextType extends TurnkeyClientMethods {
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
  }) => Promise<void>;

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
  handleLogin: () => Promise<void>;

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
   * - On successful authentication, the function either calls the provided `onOauthSuccess` callback, triggers the `onOauthRedirect` callback from provider callbacks, or completes the OAuth flow internally by calling `completeOauth`.
   * - Handles all error cases, including missing configuration, popup failures, and timeouts, and throws a `TurnkeyError` with appropriate error codes.
   *
   * @param params.clientId - The Google Client ID to use (defaults to the client ID from configuration).
   * @param params.openInPage - Whether to open the OAuth flow in the current page (redirect) or a popup window (default: false).
   * @param params.additionalState - Additional key-value pairs to include in the OAuth state parameter for custom tracking or logic.
   * @param params.onOauthSuccess - Callback function to handle the successful OAuth response (receives `{ oidcToken, providerName }`).
   *
   * onOauthSuccess params:
   * - oidcToken: The OIDC token received from the OAuth flow.
   * - providerName: The name of the OAuth provider ("google").
   *
   * @returns A promise that resolves when the OAuth flow is successfully initiated and completed, or rejects on error or timeout.
   * @throws {TurnkeyError} If the configuration is not ready, required parameters are missing, or if there is an error initiating or completing the OAuth flow.
   */
  handleGoogleOauth: (params?: {
    clientId?: string;
    additionalState?: Record<string, string>;
    openInPage?: boolean;
    onOauthSuccess?: (params: {
      oidcToken: string;
      providerName: string;
    }) => any;
  }) => Promise<void>;

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
   * - On successful authentication, the function either calls the provided `onOauthSuccess` callback, triggers the `onOauthRedirect` callback from provider callbacks, or completes the OAuth flow internally by calling `completeOauth`.
   * - Handles all error cases, including missing configuration, popup failures, and timeouts, and throws a `TurnkeyError` with appropriate error codes.
   *
   * @param params.clientId - The Apple Client ID to use (defaults to the client ID from configuration).
   * @param params.openInPage - Whether to open the OAuth flow in the current page (redirect) or a popup window (default: false).
   * @param params.additionalState - Additional key-value pairs to include in the OAuth state parameter for custom tracking or logic.
   * @param params.onOauthSuccess - Callback function to handle the successful OAuth response (receives `{ oidcToken, providerName }`).
   *
   * onOauthSuccess params:
   * - oidcToken: The OIDC token received from the OAuth flow.
   * - providerName: The name of the OAuth provider ("apple").
   *
   * @returns A promise that resolves when the OAuth flow is successfully initiated and completed, or rejects on error or timeout.
   * @throws {TurnkeyError} If the configuration is not ready, required parameters are missing, or if there is an error initiating or completing the OAuth flow.
   */
  handleAppleOauth: (params?: {
    clientId?: string;
    additionalState?: Record<string, string>;
    openInPage?: boolean;
    onOauthSuccess?: (params: {
      oidcToken: string;
      providerName: string;
    }) => any;
  }) => Promise<void>;

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
   * - On successful authentication, the function either calls the provided `onOauthSuccess` callback, triggers the `onOauthRedirect` callback from provider callbacks, or completes the OAuth flow internally by calling `completeOauth`.
   * - Handles all error cases, including missing configuration, popup failures, and timeouts, and throws a `TurnkeyError` with appropriate error codes.
   *
   * @param params.clientId - The Facebook Client ID to use (defaults to the client ID from configuration).
   * @param params.openInPage - Whether to open the OAuth flow in the current page (redirect) or a popup window (default: false).
   * @param params.additionalState - Additional key-value pairs to include in the OAuth state parameter for custom tracking or logic.
   * @param params.onOauthSuccess - Callback function to handle the successful OAuth response (receives `{ oidcToken, providerName }`).
   *
   * onOauthSuccess params:
   * - oidcToken: The OIDC token received from the OAuth flow.
   * - providerName: The name of the OAuth provider ("facebook").
   *
   * @returns A promise that resolves when the OAuth flow is successfully initiated and completed, or rejects on error or timeout.
   * @throws {TurnkeyError} If the configuration is not ready, required parameters are missing, or if there is an error initiating or completing the OAuth flow.
   */
  handleFacebookOauth: (params?: {
    clientId?: string;
    additionalState?: Record<string, string>;
    openInPage?: boolean;
    onOauthSuccess?: (params: {
      oidcToken: string;
      providerName: string;
    }) => any;
  }) => Promise<void>;

  /**
   * Handles the export wallet flow.
   *
   * - This function opens a modal with the ExportComponent for exporting a wallet.
   * - Uses Turnkey's export iframe flow to securely export wallet material.
   * - The export process encrypts the exported bundle to a target public key, which is generated and managed inside the iframe for maximum security.
   * - A request is made to the Turnkey API to export the wallet, encrypted to the target public key.
   * - The resulting export bundle is injected into the iframe, where it is decrypted and displayed to the user.
   * - If a custom iframe URL is used, a target public key can be provided explicitly.
   * - Optionally allows specifying the stamper to use for the export (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet) for granular authentication control.
   * - The modal-driven UI ensures the user is guided through the export process and can securely retrieve their exported material.
   *
   * @param params.walletId - The ID of the wallet to export.
   * @param params.targetPublicKey - The target public key to encrypt the export bundle to (required for custom iframe flows).
   * @param params.stampWith - The stamper to use for the export (Passkey, ApiKey, or Wallet).
   *
   * @returns A void promise.
   */
  handleExportWallet: (params: {
    walletId: string;
    targetPublicKey?: string;
    stampWith?: StamperType | undefined;
  }) => Promise<void>;

  /**
   * handles the export private key flow.
   *
   * - This function opens a modal with the ExportComponent for exporting a private key.
   * - Uses Turnkey's export iframe flow to securely export private key material.
   * - The export process encrypts the exported bundle to a target public key, which is generated and managed inside the iframe for maximum security.
   * - A request is made to the Turnkey API to export the private key, encrypted to the target public key.
   * - The resulting export bundle is injected into the iframe, where it is decrypted and displayed to the user.
   * - If a custom iframe URL is used, a target public key can be provided explicitly.
   * - Optionally allows specifying the stamper to use for the export (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet) for granular authentication control.
   * - The modal-driven UI ensures the user is guided through the export process and can securely retrieve their exported material.
   *
   * @param params.privateKeyId - The ID of the private key to export.
   * @param params.targetPublicKey - The target public key to encrypt the export bundle to (required for custom iframe flows).
   * @param params.stampWith - The stamper to use for the export (Passkey, ApiKey, or Wallet).
   * @return A void promise.
   */
  handleExportPrivateKey: (params: {
    privateKeyId: string;
    targetPublicKey?: string;
    stampWith?: StamperType | undefined;
  }) => Promise<void>;

  /**
   * Handles the export wallet account flow.
   *
   * - This function opens a modal with the ExportComponent for exporting a wallet account.
   * - Uses Turnkey's export iframe flow to securely export wallet account material.
   * - The export process encrypts the exported bundle to a target public key, which is generated and managed inside the iframe for maximum security.
   * - A request is made to the Turnkey API to export the wallet account, encrypted to the target public key.
   * - The resulting export bundle is injected into the iframe, where it is decrypted and displayed to the user.
   * - If a custom iframe URL is used, a target public key can be provided explicitly.
   * - Optionally allows specifying the stamper to use for the export (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet) for granular authentication control.
   * - The modal-driven UI ensures the user is guided through the export process and can securely retrieve their exported material.
   *
   * @param params.address - The address of the wallet account to export.
   * @param params.targetPublicKey - The target public key to encrypt the export bundle to (required for custom iframe flows).
   * @param params.stampWith - The stamper to use for the export (Passkey, ApiKey, or Wallet).
   *
   * @returns A void promise.
   */

  handleExportWalletAccount: (params: {
    address: string;
    targetPublicKey?: string;
    stampWith?: StamperType | undefined;
  }) => Promise<void>;

  /**
   * Handles the import flow.
   *
   * - This function opens a modal with the ImportComponent for importing a wallet.
   * - Supports importing wallets using an encrypted bundle, with optional default accounts or custom account parameters.
   * - Allows users to specify default wallet accounts (address formats or account params) to pre-fill the import form.
   * - Supports customizing the duration of the success page shown after a successful import.
   * - Allows specifying the stamper to use for the import (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet) for granular authentication control.
   * - Ensures the imported wallet is added to the user's wallet list and the provider state is refreshed.
   *
   * @param params.defaultWalletAccounts - array of default wallet accounts (v1AddressFormat[] or v1WalletAccountParams[]) to pre-fill the import form.
   * @param params.successPageDuration - duration (in ms) for the success page after import (default: 0, no success page).
   * @param params.stampWith - parameter to specify the stamper to use for the import (Passkey, ApiKey, or Wallet).
   *
   * @returns A promise that resolves to the new wallet's ID.
   */
  handleImportWallet: (params?: {
    defaultWalletAccounts?: v1AddressFormat[] | v1WalletAccountParams[];
    successPageDuration?: number | undefined; // Duration in milliseconds for the success page to show. If 0, it will not show the success page.
    stampWith?: StamperType | undefined;
  }) => Promise<string>;

  /**
   * Handles the update user name flow.
   *
   * - This function opens a modal with the UpdateUserName component for updating and verifying the user's name.
   * - If a userName is provided, it will directly update the user name without showing the modal.
   * - Uses updateUserName under the hood to perform the update and automatically refreshes the user details state after a successful update.
   * - Optionally displays a success page after the update, with customizable duration.
   * - Supports passing a custom title and subtitle for the modal UI.
   * - Handles all error cases and throws a TurnkeyError with appropriate error codes.
   *
   * @param params.userName - parameter to specify the new user name.
   * @param params.title - title for the modal.
   * @param params.subTitle - subtitle for the modal.
   * @param params.successPageDuration - duration (in ms) for the success page after update (default: 0, no success page).
   * @param params.stampWith - parameter to specify the stamper to use for the update (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   *
   * @returns A promise that resolves to the userId of the user that was changed.
   * @throws {TurnkeyError} If the client is not initialized, no active session is found, or if there is an error updating the user name.
   */
  handleUpdateUserEmail: (params?: {
    email?: string;
    title?: string;
    subTitle?: string;
    successPageDuration?: number | undefined; // Duration in milliseconds for the success page to show. If 0, it will not show the success page.
  }) => Promise<string>;

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
   * @param params.phoneNumber - parameter to specify the new phone number.
   * @param params.formattedPhone - parameter to specify the formatted phone number.
   * @param params.title - title for the modal.
   * @param params.subTitle - subtitle for the modal.
   * @param params.successPageDuration - duration for the success page (default: 0, no success page).
   *
   * @returns A promise that resolves to the userId of the user that was changed.
   * @throws {TurnkeyError} If the client is not initialized, no active session is found, SMS OTP is not enabled, or if there is an error updating the phone number.
   */
  handleUpdateUserPhoneNumber: (params?: {
    phoneNumber?: string;
    formattedPhone?: string;
    title?: string;
    subTitle?: string;
    successPageDuration?: number | undefined; // Duration in milliseconds for the success page to show. If 0, it will not show the success page.
  }) => Promise<string>;
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
   * @param params.email - parameter to specify the new email address.
   * @param params.title - title for the modal.
   * @param params.subTitle - subtitle for the modal.
   * @param params.successPageDuration - duration (in ms) for the success page after update (default: 0, no success page).
   * @param params.stampWith - parameter to specify the stamper to use for the update (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   *
   * @returns A promise that resolves to the userId of the user that was changed.
   * @throws {TurnkeyError} If the client is not initialized, no active session is found, or if there is an error updating the email.
   */
  handleUpdateUserName: (params?: {
    userName?: string;
    title?: string;
    subTitle?: string;
    successPageDuration?: number | undefined; // Duration in milliseconds for the success page to show. If 0, it will not show the success page.
    stampWith?: StamperType | undefined;
  }) => Promise<string>;
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
   * @param params.email - parameter to specify the new email address.
   * @param params.title - title for the modal (defaults to "Connect an email" if the user does not have an email).
   * @param params.subTitle - subtitle for the modal.
   * @param params.successPageDuration - duration (in ms) for the success page after update (default: 0, no success page).
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
   * @param params.phoneNumber - parameter to specify the new phone number.
   * @param params.formattedPhone - parameter to specify the formatted phone number.
   * @param params.title - title for the modal.
   * @param params.subTitle - subtitle for the modal.
   * @param params.successPageDuration - duration (in ms) for the success page after update (default: 0, no success page).
   *
   * @returns A promise that resolves to the userId of the user that was changed.
   * @throws {TurnkeyError} If the client is not initialized, no active session is found, or if there is an error adding the phone number.
   */
  handleAddPhoneNumber: (params?: {
    phoneNumber?: string;
    formattedPhone?: string;
    title?: string;
    subTitle?: string;
    successPageDuration?: number | undefined; // Duration in milliseconds for the success page to show. If 0, it will not show the success page.
  }) => Promise<string>;

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
   * @param params.providerName - The name of the OAuth provider to add (OAuthProviders.GOOGLE, OAuthProviders.APPLE, OAuthProviders.FACEBOOK).
   * @param params.stampWith - parameter to specify the stamper to use for the addition (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   *
   * @returns A void promise.
   * @throws {TurnkeyError} If the client is not initialized, no active session is found, or if there is an error adding the provider.
   */
  handleAddOauthProvider: (params: {
    providerName: OAuthProviders;
    stampWith?: StamperType | undefined;
  }) => Promise<void>;

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
   * @param params.providerId - The ID of the OAuth provider to remove (as found in the user's provider list).
   * @param params.title - title for the modal.
   * @param params.subTitle - subtitle for the modal.
   * @param params.successPageDuration - duration (in ms) for the success page after removal (default: 0, no success page).
   * @param params.stampWith - parameter to specify the stamper to use for the removal (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   *
   * @returns A promise that resolves to an array of provider IDs that were removed.
   * @throws {TurnkeyError} If the client is not initialized, no active session is found, or if there is an error removing the provider.
   */
  handleRemoveOauthProvider: (params: {
    providerId: string;
    title?: string;
    subTitle?: string;
    successPageDuration?: number | undefined; // Duration in milliseconds for the success page to show. If 0, it will not show the success page.
    stampWith?: StamperType | undefined;
  }) => Promise<string[]>;

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
   * @param params.name - internal name for the passkey (for backend or developer reference).
   * @param params.displayName - display name for the passkey (shown to the user in the UI).
   * @param params.userId - user ID to add the passkey for a specific user (defaults to current session's userId).
   * @param params.successPageDuration - duration (in ms) for the success page after addition (default: 0, no success page).
   * @param params.stampWith - parameter to stamp the request with a specific stamper (`StamperType.Passkey`, `StamperType.ApiKey`, or `StamperType.Wallet`).
   *
   * @returns A promise that resolves to the user's updated passkeys.
   * @throws {TurnkeyError} If the client is not initialized, no active session is found, or if there is an error adding the passkey.
   */
  handleAddPasskey: (params?: {
    name?: string;
    displayName?: string;
    userId?: string;
    successPageDuration?: number | undefined; // Duration in milliseconds for the success page to show. If 0, it will not show the success page.
    stampWith?: StamperType | undefined;
  }) => Promise<string[]>;

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
   * @param params.authenticatorId - The ID of the authenticator (passkey) to remove.
   * @param params.userId - user ID to remove the passkey for a specific user (defaults to current session's userId).
   * @param params.title - title for the modal.
   * @param params.subTitle - subtitle for the modal.
   * @param params.successPageDuration - duration (in ms) for the success page after removal (default: 0, no success page).
   * @param params.stampWith - parameter to specify the stamper to use for the removal (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   *
   * @returns A promise that resolves to an array of authenticator IDs that were removed.
   * @throws {TurnkeyError} If the client is not initialized, no active session is found, or if there is an error removing the passkey.
   */
  handleRemovePasskey: (params: {
    authenticatorId: string;
    userId?: string;
    title?: string;
    subTitle?: string;
    successPageDuration?: number | undefined; // Duration in milliseconds for the success page to show. If 0, it will not show the success page.
    stampWith?: StamperType | undefined;
  }) => Promise<string[]>;

  /**
   * Handles the signing of a message by displaying a modal for user interaction.
   *
   * - This function opens a modal with the SignMessageModal component, prompting the user to review and approve the message signing request.
   * - Supports signing with any wallet account managed by Turnkey, including externally linked wallets.
   * - Allows for optional overrides of the encoding and hash function used for the payload, enabling advanced use cases or compatibility with specific blockchains.
   * - Optionally displays a subtext in the modal for additional context or instructions to the user.
   * - Returns a promise that resolves to a `v1SignRawPayloadResult` object containing the signed message, signature, and metadata.
   *
   * @param params.message - The message to sign.
   * @param params.walletAccount - The wallet account to use for signing.
   * @param params.encoding - encoding for the payload (defaults to the proper encoding for the account type).
   * @param params.hashFunction - hash function to use (defaults to the appropriate function for the account type).
   * @param params.addEthereumPrefix - whether to add the Ethereum prefix to the message (default: false).
   * @param params.subText - subtext to display in the modal.
   * @param params.successPageDuration - duration in seconds to display the success page after signing.
   * @param params.stampWith - parameter to stamp the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   * @returns A promise that resolves to a `v1SignRawPayloadResult` object containing the signed message.
   * @throws {TurnkeyError} If the client is not initialized or if there is an error during the signing process.
   */
  handleSignMessage: (params: {
    message: string;
    walletAccount: WalletAccount;
    encoding?: v1PayloadEncoding;
    hashFunction?: v1HashFunction;
    addEthereumPrefix?: boolean;
    subText?: string;
    successPageDuration?: number | undefined; // Duration in milliseconds for the success page to show. If 0, it will not show the success page.
    stampWith?: StamperType | undefined;
  }) => Promise<v1SignRawPayloadResult>;

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
   * @param params.successPageDuration - duration (in ms) for the success page after linking (default: 2000ms).
   *
   * @returns A void promise.
   * @throws {TurnkeyError} If the client is not initialized or if no active session is found.
   */
  handleLinkExternalWallet: (params?: {
    successPageDuration?: number | undefined;
  }) => Promise<void>;

  /**
   * Handles the removal of a user's email address from their Turnkey account.
   *
   * - This function opens a modal with the RemoveUserEmail component, allowing the user to confirm and remove their email address.
   *
   * @param params.userId - The user ID to remove the email for (defaults to current session's userId).
   * @param params.successPageDuration - duration (in ms) for the success page after removal (default: 0, no success page).
   * @param params.stampWith - parameter to specify the stamper to use for the removal (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   */
  handleRemoveUserEmail: (params?: {
    userId?: string;
    successPageDuration?: number | undefined;
    stampWith?: StamperType | undefined;
  }) => Promise<string>;

  /**
   * Handles the removal of a user's phone number from their Turnkey account.
   *
   * - This function opens a modal with the RemoveUserPhoneNumber component, allowing the user to confirm and remove their phone number.
   *
   * @param params.userId - The user ID to remove the phone number for (defaults to current session's userId).
   * @param params.successPageDuration - duration (in ms) for the success page after removal (default: 0, no success page).
   * @param params.stampWith - parameter to specify the stamper to use for the removal (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   */
  handleRemoveUserPhoneNumber: (params?: {
    userId?: string;
    successPageDuration?: number | undefined;
    stampWith?: StamperType | undefined;
  }) => Promise<string>;
}

/** @internal */
export const ClientContext = createContext<ClientContextType | undefined>(
  undefined,
);

"use client";

import type {
  TurnkeySDKClientBase,
  TurnkeyClientMethods,
  Wallet,
  StamperType,
} from "@turnkey/core";
import type {
  Session,
  v1User,
} from "@turnkey/sdk-types";
import type {
  TurnkeyProviderConfig,
  AuthState,
  ClientState,
} from "../types/base";
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

export interface ClientContextType
  extends Omit<TurnkeyClientMethods, "connectWalletAccount" | "fetchWalletProviders" | "disconnectWalletAccount" | "switchWalletAccountChain" | "loginWithWallet" | "signUpWithWallet" | "loginOrSignupWithWallet"> {
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
  }) => Promise<Wallet[]>;

  /**
   * Handles the Discord OAuth 2.0 flow.
   *
   * - This function initiates the OAuth 2.0 PKCE flow with Discord by redirecting the user to the Discord authorization page or opening it in a popup window.
   * - It supports both "popup" and "redirect" flows, determined by the `openInPage` parameter.
   * - Generates a new ephemeral API key pair and uses its public key as part of the state and a cryptographic nonce to bind the OAuth session.
   * - Creates a PKCE verifier/challenge pair, storing the verifier in `sessionStorage` for later use in the token exchange.
   * - Constructs the Discord OAuth URL with all required parameters, including client ID, redirect URI, response type, scope, PKCE code challenge, nonce, and state.
   * - The `state` parameter encodes the provider name, flow type, ephemeral public key, and any additional key-value pairs provided in `additionalState`.
   * - If `openInPage` is true, the current page is redirected to the OAuth URL and the function returns a promise that resolves on redirect or rejects after 5 minutes if no redirect occurs.
   * - If `openInPage` is false, a popup window is opened for the OAuth flow, and the function returns a promise that resolves when the OAuth code is captured or rejects if the popup is closed or times out.
   * - On receiving an authorization code, the function exchanges it for an OIDC token via the Turnkey proxy (`proxyOAuth2Authenticate`) using the PKCE verifier, redirect URI, and nonce.
   * - On successful authentication, the function either calls the provided `onOauthSuccess` callback, triggers the `onOauthRedirect` callback from provider callbacks, or completes the OAuth flow internally by calling `completeOauth`.
   * - Handles error cases such as missing configuration, popup failures, missing PKCE verifier, or Turnkey proxy failures, throwing a `TurnkeyError` with appropriate error codes.
   *
   * @param params.clientId - The Discord Client ID to use (defaults to the client ID from configuration).
   * @param params.openInPage - Whether to open the OAuth flow in the current page (redirect) or a popup window (default: false).
   * @param params.additionalState - Additional key-value pairs to include in the OAuth state parameter for tracking or custom logic.
   * @param params.onOauthSuccess - Callback function to handle the successful OAuth response (receives `{ oidcToken, providerName }`).
   *
   * onOauthSuccess params:
   * - oidcToken: The OIDC token issued by Turnkey after exchanging the auth code.
   * - providerName: The name of the OAuth provider ("discord").
   *
   * @returns A promise that resolves when the OAuth flow is successfully initiated and completed, or rejects on error or timeout.
   * @throws {TurnkeyError} If the configuration is not ready, required parameters are missing, or if there is an error initiating or completing the OAuth flow.
   */
  handleDiscordOauth: (params?: {
    clientId?: string;
    additionalState?: Record<string, string>;
    openInPage?: boolean;
    onOauthSuccess?: (params: {
      oidcToken: string;
      providerName: string;
    }) => any;
  }) => Promise<void>;

  /**
   * Handles the Twitter (X) OAuth 2.0 flow.
   *
   * - This function initiates the OAuth 2.0 PKCE flow with Twitter (X) by redirecting the user to the X authorization page or opening it in a popup window.
   * - It supports both "popup" and "redirect" flows, determined by the `openInPage` parameter.
   * - Generates a new ephemeral API key pair and uses its public key as part of the state and a cryptographic nonce to bind the OAuth session.
   * - Creates a PKCE verifier/challenge pair, storing the verifier in `sessionStorage` for later use in the token exchange.
   * - Constructs the Twitter (X) OAuth URL with all required parameters, including client ID, redirect URI, response type, scope, PKCE code challenge, nonce, and state.
   * - The `state` parameter encodes the provider name, flow type, ephemeral public key, and any additional key-value pairs provided in `additionalState`.
   * - If `openInPage` is true, the current page is redirected to the OAuth URL and the function returns a promise that resolves on redirect or rejects after 5 minutes if no redirect occurs.
   * - If `openInPage` is false, a popup window is opened for the OAuth flow, and the function returns a promise that resolves when the OAuth code is captured or rejects if the popup is closed or times out.
   * - On receiving an authorization code, the function exchanges it for an OIDC token via the Turnkey proxy (`proxyOAuth2Authenticate`) using the PKCE verifier, redirect URI, and nonce.
   * - On successful authentication, the function either calls the provided `onOauthSuccess` callback, triggers the `onOauthRedirect` callback from provider callbacks, or completes the OAuth flow internally by calling `completeOauth`.
   * - Handles error cases such as missing configuration, popup failures, missing PKCE verifier, or Turnkey proxy failures, throwing a `TurnkeyError` with appropriate error codes.
   *
   * @param params.clientId - The Twitter (X) Client ID to use (defaults to the client ID from configuration).
   * @param params.openInPage - Whether to open the OAuth flow in the current page (redirect) or a popup window (default: false).
   * @param params.additionalState - Additional key-value pairs to include in the OAuth state parameter for tracking or custom logic.
   * @param params.onOauthSuccess - Callback function to handle the successful OAuth response (receives `{ oidcToken, providerName }`).
   *
   * onOauthSuccess params:
   * - oidcToken: The OIDC token issued by Turnkey after exchanging the auth code.
   * - providerName: The name of the OAuth provider ("twitter").
   *
   * @returns A promise that resolves when the OAuth flow is successfully initiated and completed, or rejects on error or timeout.
   * @throws {TurnkeyError} If the configuration is not ready, required parameters are missing, or if there is an error initiating or completing the OAuth flow.
   */
  handleXOauth: (params?: {
    clientId?: string;
    additionalState?: Record<string, string>;
    openInPage?: boolean;
    onOauthSuccess?: (params: {
      oidcToken: string;
      providerName: string;
    }) => any;
  }) => Promise<void>;

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

}

/** @internal */
export const ClientContext = createContext<ClientContextType | undefined>(
  undefined,
);

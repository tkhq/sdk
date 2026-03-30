import {
  AuthAction,
  BaseAuthResult,
  OAuthProviders,
  TurnkeyError,
  TurnkeyErrorCodes,
} from "@turnkey/sdk-types";
import type { TurnkeyCallbacks } from "../../types/base";
import { consumePKCEVerifier, type PKCEProvider } from "./storage";
import { OAUTH_PROVIDER_CONFIGS } from "./config";
import type { OAuthResponseResult } from "./url";

/**
 * Parameters for unified OAuth completion.
 * This handles the core completion logic for both popup and redirect flows,
 * for both PKCE and non-PKCE providers.
 */
export interface CompleteOAuthFlowParams {
  /** The OAuth provider */
  provider: OAuthProviders;
  /** The public key generated during OAuth initiation */
  publicKey: string;
  /** The OIDC token (for non-PKCE providers, or after PKCE exchange) */
  oidcToken: string;
  /** Optional session key from the state parameter */
  sessionKey?: string | undefined;
  /** Optional callbacks for custom handling */
  callbacks?: TurnkeyCallbacks | undefined;
  /** Function to complete the OAuth authentication flow */
  completeOauth: (params: {
    oidcToken: string;
    publicKey: string;
    providerName: string;
    sessionKey?: string;
  }) => Promise<BaseAuthResult & { action: AuthAction }>;
  /** Optional callback when OAuth succeeds (alternative to completeOauth) */
  onOauthSuccess?:
    | ((params: {
        publicKey: string;
        oidcToken: string;
        providerName: string;
        sessionKey?: string;
      }) => void)
    | undefined;
  /** Optional callback for "add provider" flow (takes priority over auth) */
  onAddProvider?: ((oidcToken: string) => Promise<void>) | undefined;
}

/**
 * Unified OAuth completion handler.
 * Routes to the appropriate completion handler based on params:
 * Priority: onAddProvider > onOauthSuccess > callbacks.onOauthRedirect > completeOauth
 *
 * This is the core completion logic used by both popup and redirect flows.
 */
export async function completeOAuthFlow(
  params: CompleteOAuthFlowParams,
): Promise<void> {
  const {
    provider,
    publicKey,
    oidcToken,
    sessionKey,
    callbacks,
    completeOauth,
    onOauthSuccess,
    onAddProvider,
  } = params;

  if (onAddProvider) {
    await onAddProvider(oidcToken);
  } else if (onOauthSuccess) {
    onOauthSuccess({
      publicKey,
      oidcToken,
      providerName: provider,
      ...(sessionKey && { sessionKey }),
    });
  } else if (callbacks?.onOauthRedirect) {
    callbacks.onOauthRedirect({
      idToken: oidcToken,
      publicKey,
      ...(sessionKey && { sessionKey }),
    });
  } else {
    await completeOauth({
      oidcToken,
      publicKey,
      providerName: provider,
      ...(sessionKey && { sessionKey }),
    });
  }
}

/**
 * Common OAuth completion handler for popup flows
 * Handles both PKCE and non-PKCE provider completion
 */
export interface CompleteOAuthPopupParams {
  provider: OAuthProviders;
  publicKey: string;
  result: OAuthResponseResult;
  callbacks?: TurnkeyCallbacks | undefined;
  completeOauth: (params: {
    oidcToken: string;
    publicKey: string;
    providerName: string;
    sessionKey?: string;
  }) => Promise<BaseAuthResult & { action: AuthAction }>;
  onOauthSuccess?:
    | ((params: {
        publicKey: string;
        oidcToken: string;
        providerName: string;
        sessionKey?: string;
      }) => void)
    | undefined;
  /** For PKCE providers: function to exchange code for token */
  exchangeCodeForToken?: ((verifier: string) => Promise<string>) | undefined;
}

/**
 * Completes OAuth flow in popup - handles both PKCE and non-PKCE providers
 */
export async function completeOAuthPopup(
  params: CompleteOAuthPopupParams,
): Promise<void> {
  const {
    provider,
    publicKey,
    result,
    callbacks,
    completeOauth,
    onOauthSuccess,
    exchangeCodeForToken,
  } = params;

  const config = OAUTH_PROVIDER_CONFIGS[provider];

  if (config.usesPKCE) {
    // PKCE flow, so we use completePKCEFlow
    if (!exchangeCodeForToken) {
      throw new TurnkeyError(
        "exchangeCodeForToken is required for PKCE providers",
        TurnkeyErrorCodes.INTERNAL_ERROR,
      );
    }

    await completePKCEFlow({
      publicKey,
      providerName: provider as PKCEProvider,
      sessionKey: result.sessionKey,
      callbacks,
      completeOauth,
      onOauthSuccess,
      exchangeCodeForToken,
    });
  } else {
    // this is a non-PKCE flow, so we use our unified completion handler
    await completeOAuthFlow({
      provider,
      publicKey,
      oidcToken: result.idToken!,
      sessionKey: result.sessionKey,
      callbacks,
      completeOauth,
      onOauthSuccess,
    });
  }
}

/**
 * Parameters for the unified PKCE flow handler.
 * This is used by all PKCE-based OAuth providers (Facebook, Discord, Twitter/X).
 */
export interface CompletePKCEFlowParams {
  /** The public key generated during OAuth initiation */
  publicKey: string;
  /** The provider name */
  providerName: PKCEProvider;
  /** Optional session key from the state parameter */
  sessionKey?: string | undefined;
  /** Optional callbacks for custom handling */
  callbacks?: TurnkeyCallbacks | undefined;
  /** Function to complete the OAuth flow */
  completeOauth: (params: {
    oidcToken: string;
    publicKey: string;
    providerName: string;
    sessionKey?: string;
  }) => Promise<BaseAuthResult & { action: AuthAction }>;
  /** Optional callback when OAuth succeeds (used in popup flow) */
  onOauthSuccess?:
    | ((params: {
        publicKey: string;
        oidcToken: string;
        providerName: string;
        sessionKey?: string;
      }) => void)
    | undefined;
  /**
   * Optional callback for handling "add provider" flow in redirect scenarios.
   * When provided, this is called instead of completeOauth when adding an OAuth provider.
   * @param oidcToken - The OIDC token from the OAuth provider
   */
  onAddProvider?: ((oidcToken: string) => Promise<void>) | undefined;
  /**
   * Function to exchange the authorization code for an OIDC token.
   * This is provider-specific:
   * - Discord/Twitter: uses proxyOAuth2Authenticate
   * - Facebook: uses exchangeCodeForToken
   */
  exchangeCodeForToken: (verifier: string) => Promise<string>;
}

/**
 * Unified PKCE flow handler for all PKCE-based OAuth providers.
 * Handles the complete PKCE flow: verifier retrieval, token exchange, and completion routing.
 *
 * This function abstracts the common logic shared between popup and redirect flows
 * for Facebook, Discord, and Twitter/X.
 *
 * @param params - The PKCE flow parameters
 * @returns A promise that resolves when the flow is complete
 */
export async function completePKCEFlow({
  publicKey,
  providerName,
  sessionKey,
  callbacks,
  completeOauth,
  onOauthSuccess,
  onAddProvider,
  exchangeCodeForToken,
}: CompletePKCEFlowParams): Promise<void> {
  // Consume the verifier (retrieves and removes from storage)
  const verifier = consumePKCEVerifier(providerName);

  // Exchange the code for an OIDC token using the provider-specific function
  const oidcToken = await exchangeCodeForToken(verifier);

  // Use unified completion handler
  await completeOAuthFlow({
    provider: providerName,
    publicKey,
    oidcToken,
    sessionKey,
    callbacks,
    completeOauth,
    onOauthSuccess,
    onAddProvider,
  });
}

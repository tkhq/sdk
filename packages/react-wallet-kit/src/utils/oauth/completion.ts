import {
  AuthAction,
  BaseAuthResult,
  OAuthProviders,
  TurnkeyError,
  TurnkeyErrorCodes,
} from "@turnkey/sdk-types";
import type { TurnkeyCallbacks } from "../../types/base";
import type { PKCEProvider } from "./storage";
import { OAUTH_PROVIDER_CONFIGS } from "./config";
import { handlePKCEFlow } from "./pkce";
import type { OAuthResponseResult } from "./url";

/**
 * Parameters for unified OAuth completion.
 * This handles the core completion logic for both popup and redirect flows,
 * for both PKCE and non-PKCE providers.
 */
export interface OAuthCompletionParams {
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
  params: OAuthCompletionParams,
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
export interface OAuthPopupCompletionParams {
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
  params: OAuthPopupCompletionParams,
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
    // PKCE flow - use handlePKCEFlow
    if (!exchangeCodeForToken) {
      throw new TurnkeyError(
        "exchangeCodeForToken is required for PKCE providers",
        TurnkeyErrorCodes.INTERNAL_ERROR,
      );
    }

    await handlePKCEFlow({
      publicKey,
      providerName: provider as PKCEProvider,
      sessionKey: result.sessionKey,
      callbacks,
      completeOauth,
      onOauthSuccess,
      exchangeCodeForToken,
    });
  } else {
    // Non-PKCE flow - use unified completion handler
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

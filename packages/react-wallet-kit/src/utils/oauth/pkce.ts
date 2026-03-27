import { AuthAction, type BaseAuthResult } from "@turnkey/sdk-types";
import type { TurnkeyCallbacks } from "../../types/base";
import { FACEBOOK_GRAPH_URL } from "./config";
import type { PKCEProvider } from "./storage";
import { consumePKCEVerifier } from "./storage";
import { completeOAuthFlow } from "./completion";

/**
 * Generates a PKCE challenge pair (verifier and code challenge)
 */
export async function generateChallengePair(): Promise<{
  verifier: string;
  codeChallenge: string;
}> {
  const randomBytes = new Uint8Array(32);
  window.crypto.getRandomValues(randomBytes);
  const verifier = btoa(String.fromCharCode(...randomBytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await window.crypto.subtle.digest("SHA-256", data);

  const base64Challenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  return { verifier, codeChallenge: base64Challenge };
}

/**
 * Exchanges Facebook authorization code for token
 */
export async function exchangeFacebookCodeForToken(
  clientId: string,
  redirectUri: string,
  code: string,
  codeVerifier: string,
): Promise<{ id_token: string }> {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
    code: code,
    grant_type: "authorization_code",
  });

  const response = await fetch(FACEBOOK_GRAPH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(
      `Facebook token exchange failed: ${JSON.stringify(errorData)}`,
    );
  }

  return await response.json();
}

/**
 * Parameters for the unified PKCE flow handler.
 * This is used by all PKCE-based OAuth providers (Facebook, Discord, Twitter/X).
 */
export interface PKCEFlowParams {
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
export async function handlePKCEFlow({
  publicKey,
  providerName,
  sessionKey,
  callbacks,
  completeOauth,
  onOauthSuccess,
  onAddProvider,
  exchangeCodeForToken,
}: PKCEFlowParams): Promise<void> {
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

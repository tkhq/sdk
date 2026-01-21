import {
  AuthAction,
  BaseAuthResult,
  OAuthProviders,
  TurnkeyError,
  TurnkeyErrorCodes,
} from "@turnkey/sdk-types";
import type { TurnkeyCallbacks } from "../types/base";
import {
  faFacebook,
  faDiscord,
  faXTwitter,
  faApple,
  faGoogle,
} from "@fortawesome/free-brands-svg-icons";

// ============================================================================
// OAuth URL Constants
// ============================================================================

export const DISCORD_AUTH_URL = "https://discord.com/oauth2/authorize";
export const X_AUTH_URL = "https://x.com/i/oauth2/authorize";
export const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const APPLE_AUTH_URL = "https://account.apple.com/auth/authorize";
export const APPLE_AUTH_SCRIPT_URL =
  "https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js";
export const FACEBOOK_AUTH_URL = "https://www.facebook.com/v11.0/dialog/oauth";
export const FACEBOOK_GRAPH_URL =
  "https://graph.facebook.com/v11.0/oauth/access_token";

// ============================================================================
// OAuth Popup Constants
// ============================================================================

export const popupWidth = 500;
export const popupHeight = 600;

// ============================================================================
// OAuth Intent Constants
// ============================================================================

export const OAUTH_INTENT_ADD_PROVIDER = "addProvider";
export const OAUTH_ADD_PROVIDER_METADATA_KEY = "oauth_add_provider_metadata";

// ============================================================================
// OAuth Add Provider Metadata
// ============================================================================

export type OAuthAddProviderMetadata = {
  organizationId: string;
  userId: string;
  stampWith?: string;
  successPageDuration?: number;
};

/**
 * Stores OAuth add provider metadata in session storage
 * Used for addOauthProvider flow if opening in-page
 */
export function storeOAuthAddProviderMetadata(
  metadata: OAuthAddProviderMetadata,
): void {
  sessionStorage.setItem(
    OAUTH_ADD_PROVIDER_METADATA_KEY,
    JSON.stringify(metadata),
  );
}

/**
 * Retrieves OAuth add provider metadata from session storage
 */
export function getOAuthAddProviderMetadata(): OAuthAddProviderMetadata | null {
  const stored = sessionStorage.getItem(OAUTH_ADD_PROVIDER_METADATA_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored) as OAuthAddProviderMetadata;
  } catch {
    return null;
  }
}

/**
 * Clears OAuth add provider metadata from session storage
 */
export function clearOAuthAddProviderMetadata(): void {
  sessionStorage.removeItem(OAUTH_ADD_PROVIDER_METADATA_KEY);
}

// ============================================================================
// OAuth State Building
// ============================================================================

/**
 * Builds the OAuth state parameter string
 */
export function buildOAuthState(params: {
  provider: OAuthProviders;
  flow: "redirect" | "popup";
  publicKey: string;
  nonce?: string;
  additionalState?: Record<string, string> | undefined;
}): string {
  const { provider, flow, publicKey, nonce, additionalState } = params;
  let state = `provider=${provider}&flow=${flow}&publicKey=${encodeURIComponent(publicKey)}`;

  if (nonce) {
    state += `&nonce=${nonce}`;
  }

  if (additionalState) {
    const extra = Object.entries(additionalState)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join("&");
    if (extra) {
      state += `&${extra}`;
    }
  }

  return state;
}

// ============================================================================
// OAuth Provider Opening Utilities
// ============================================================================

/**
 * Opens a centered OAuth popup window
 */
export function openOAuthPopup(): Window | null {
  const width = popupWidth;
  const height = popupHeight;
  const left = window.screenX + (window.innerWidth - width) / 2;
  const top = window.screenY + (window.innerHeight - height) / 2;

  return window.open(
    "about:blank",
    "_blank",
    `width=${width},height=${height},top=${top},left=${left},scrollbars=yes,resizable=yes`,
  );
}

/**
 * Redirects to OAuth provider URL
 */
export function redirectToOAuthProvider(url: string): Promise<never> {
  window.location.href = url;
  return new Promise((_, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Authentication timed out."));
    }, 300000); // 5 minutes
    window.addEventListener("beforeunload", () => clearTimeout(timeout));
  });
}

// ============================================================================
// OAuth URL Cleanup
// ============================================================================

/**
 * Cleans up OAuth parameters from URL (removes hash and search)
 */
export function cleanupOAuthUrl(): void {
  window.history.replaceState(null, document.title, window.location.pathname);
}

/**
 * Cleans up OAuth hash from URL but preserves search parameters
 */
export function cleanupOAuthUrlPreserveSearch(): void {
  window.history.replaceState(
    null,
    document.title,
    window.location.pathname + window.location.search,
  );
}

// ============================================================================
// OAuth State Parsing
// ============================================================================

/**
 * Parses the OAuth state parameter string into an object
 */
export function parseStateParam(stateParam: string | null | undefined): {
  sessionKey?: string;
  oauthIntent?: string;
  provider?: string;
  flow?: string;
  publicKey?: string;
  openModal?: string;
  [key: string]: string | undefined;
} {
  if (!stateParam) return {};

  const result: { [key: string]: string | undefined } = {};
  const pairs = stateParam.split("&");

  for (const pair of pairs) {
    const [key, value] = pair.split("=");
    if (key && value !== undefined) {
      result[key] = decodeURIComponent(value);
    }
  }

  return result;
}

// ============================================================================
// OAuth Redirect Parsing
// ============================================================================

/**
 * Helper function to parse Apple OAuth redirects
 */
function parseAppleOAuthRedirect(hash: string): {
  idToken: string | null | undefined;
  provider: string | null;
  flow: string | null;
  publicKey: string | null;
  openModal: string | null;
  sessionKey: string | null;
  oauthIntent: string | null;
} {
  // Apple's format has unencoded parameters in the state portion
  const idTokenMatch = hash.match(/id_token=([^&]+)$/);
  const idToken = idTokenMatch ? idTokenMatch[1] : null;

  // Extract state parameters - state is at the beginning
  // It typically looks like: state=provider=apple&flow=redirect&publicKey=123...&openModal=true&code=...&id_token=...
  const stateEndIndex = hash.indexOf("&code=");
  if (stateEndIndex === -1)
    return {
      idToken,
      provider: null,
      flow: null,
      publicKey: null,
      openModal: null,
      sessionKey: null,
      oauthIntent: null,
    };

  const stateContent = hash.substring(6, stateEndIndex); // Remove "state=" prefix
  const stateParams = new URLSearchParams(stateContent);

  return {
    idToken,
    provider: stateParams.get("provider"),
    flow: stateParams.get("flow"),
    publicKey: stateParams.get("publicKey"),
    openModal: stateParams.get("openModal"),
    sessionKey: stateParams.get("sessionKey"),
    oauthIntent: stateParams.get("oauthIntent"),
  };
}

/**
 * Helper function to parse Google OAuth redirects
 */
function parseGoogleOAuthRedirect(hash: string): {
  idToken: string | null;
  provider: string | null;
  flow: string | null;
  publicKey: string | null;
  openModal: string | null;
  sessionKey: string | null;
  oauthIntent: string | null;
} {
  const hashParams = new URLSearchParams(hash);
  const idToken = hashParams.get("id_token");
  const state = hashParams.get("state");

  let provider = null;
  let flow = null;
  let publicKey = null;
  let openModal = null;
  let sessionKey = null;
  let oauthIntent = null;

  if (state) {
    const stateParams = new URLSearchParams(state);
    provider = stateParams.get("provider");
    flow = stateParams.get("flow");
    publicKey = stateParams.get("publicKey");
    openModal = stateParams.get("openModal");
    sessionKey = stateParams.get("sessionKey");
    oauthIntent = stateParams.get("oauthIntent");
  }

  return {
    idToken,
    provider,
    flow,
    publicKey,
    openModal,
    sessionKey,
    oauthIntent,
  };
}

/**
 * Main function to determine provider and parse OAuth redirect accordingly
 */
export function parseOAuthRedirect(hash: string): {
  idToken: string | null | undefined;
  provider: string | null;
  flow: string | null;
  publicKey: string | null;
  openModal: string | null;
  sessionKey: string | null;
  oauthIntent: string | null;
} {
  // Check if this is an Apple redirect
  if (hash.startsWith("state=provider=apple")) {
    return parseAppleOAuthRedirect(hash);
  } else {
    return parseGoogleOAuthRedirect(hash);
  }
}

// ============================================================================
// PKCE Utilities
// ============================================================================

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

/** Provider type for PKCE-based OAuth */
export type PKCEProvider =
  | OAuthProviders.FACEBOOK
  | OAuthProviders.DISCORD
  | OAuthProviders.X;

// ============================================================================
// Unified OAuth Completion
// ============================================================================

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

// ============================================================================
// PKCE Flow Utilities
// ============================================================================

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
 * Gets the verifier key name for a PKCE provider
 */
export function getPKCEVerifierKey(provider: PKCEProvider): string {
  return `${provider}_verifier`;
}

/**
 * Retrieves and removes the PKCE verifier from session storage
 * @param provider - The OAuth provider
 * @returns The verifier string
 * @throws TurnkeyError if verifier is not found
 */
export function consumePKCEVerifier(provider: PKCEProvider): string {
  const key = getPKCEVerifierKey(provider);
  const verifier = sessionStorage.getItem(key);
  if (!verifier) {
    throw new TurnkeyError(
      `Missing PKCE verifier for ${provider} authentication`,
      TurnkeyErrorCodes.OAUTH_SIGNUP_ERROR,
    );
  }
  sessionStorage.removeItem(key);
  return verifier;
}

/**
 * Stores the PKCE verifier in session storage
 * @param provider - The OAuth provider
 * @param verifier - The verifier string to store
 */
export function storePKCEVerifier(
  provider: PKCEProvider,
  verifier: string,
): void {
  sessionStorage.setItem(getPKCEVerifierKey(provider), verifier);
}

/**
 * Checks if a PKCE verifier exists for a provider (without consuming it)
 * @param provider - The OAuth provider
 * @returns true if verifier exists
 */
export function hasPKCEVerifier(provider: PKCEProvider): boolean {
  return sessionStorage.getItem(getPKCEVerifierKey(provider)) !== null;
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

// ============================================================================
// OAuth Provider Configuration
// ============================================================================

/**
 * OAuth provider configuration for unified OAuth flow handling
 */
export interface OAuthProviderConfig {
  /** The provider identifier */
  provider: OAuthProviders;
  /** The base OAuth authorization URL */
  authUrl: string;
  /** OAuth scopes to request */
  scopes: string;
  /** Whether this provider uses PKCE */
  usesPKCE: boolean;
  /** Response type for the OAuth request */
  responseType: string;
  /** Optional response mode (e.g., 'fragment' for Apple) */
  responseMode?: string;
  /** Whether to include nonce in the URL params (vs state) */
  nonceInParams?: boolean;
}

/**
 * Pre-configured OAuth provider settings
 */
export const OAUTH_PROVIDER_CONFIGS: Record<
  OAuthProviders,
  OAuthProviderConfig
> = {
  [OAuthProviders.GOOGLE]: {
    provider: OAuthProviders.GOOGLE,
    authUrl: GOOGLE_AUTH_URL,
    scopes: "openid email profile",
    usesPKCE: false,
    responseType: "id_token",
    nonceInParams: true,
  },
  [OAuthProviders.APPLE]: {
    provider: OAuthProviders.APPLE,
    authUrl: APPLE_AUTH_URL,
    scopes: "",
    usesPKCE: false,
    responseType: "code id_token",
    responseMode: "fragment",
    nonceInParams: true,
  },
  [OAuthProviders.FACEBOOK]: {
    provider: OAuthProviders.FACEBOOK,
    authUrl: FACEBOOK_AUTH_URL,
    scopes: "openid",
    usesPKCE: true,
    responseType: "code",
    nonceInParams: true,
  },
  [OAuthProviders.DISCORD]: {
    provider: OAuthProviders.DISCORD,
    authUrl: DISCORD_AUTH_URL,
    scopes: "identify email",
    usesPKCE: true,
    responseType: "code",
    nonceInParams: false,
  },
  [OAuthProviders.X]: {
    provider: OAuthProviders.X,
    authUrl: X_AUTH_URL,
    scopes: "tweet.read users.read",
    usesPKCE: true,
    responseType: "code",
    nonceInParams: false,
  },
};

// ============================================================================
// OAuth URL Building
// ============================================================================

/**
 * Parameters for building an OAuth URL
 */
export interface BuildOAuthUrlParams {
  provider: OAuthProviders;
  clientId: string;
  redirectUri: string;
  publicKey: string;
  nonce: string;
  flow: "redirect" | "popup";
  codeChallenge?: string | undefined;
  additionalState?: Record<string, string> | undefined;
}

/**
 * Builds the complete OAuth authorization URL for a provider
 */
export function buildOAuthUrl(params: BuildOAuthUrlParams): string {
  const {
    provider,
    clientId,
    redirectUri,
    publicKey,
    nonce,
    flow,
    codeChallenge,
    additionalState,
  } = params;

  const config = OAUTH_PROVIDER_CONFIGS[provider];
  const authUrl = new URL(config.authUrl);

  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", config.responseType);

  if (config.scopes) {
    authUrl.searchParams.set("scope", config.scopes);
  }

  if (config.responseMode) {
    authUrl.searchParams.set("response_mode", config.responseMode);
  }

  // PKCE parameters
  if (config.usesPKCE && codeChallenge) {
    authUrl.searchParams.set("code_challenge", codeChallenge);
    authUrl.searchParams.set("code_challenge_method", "S256");
  }

  // Nonce handling - some providers want it in URL params, others in state
  if (config.nonceInParams) {
    authUrl.searchParams.set("nonce", nonce);
  }

  // Google-specific: prompt for account selection
  if (provider === OAuthProviders.GOOGLE) {
    authUrl.searchParams.set("prompt", "select_account");
  }

  // Build state parameter
  const stateParams: Parameters<typeof buildOAuthState>[0] = {
    provider,
    flow,
    publicKey,
  };
  // Include nonce in state for providers that need it there (not in URL params)
  if (!config.nonceInParams) {
    stateParams.nonce = nonce;
  }
  if (additionalState) {
    stateParams.additionalState = additionalState;
  }
  authUrl.searchParams.set("state", buildOAuthState(stateParams));

  return authUrl.toString();
}

// ============================================================================
// OAuth Popup Response Parsing
// ============================================================================

/**
 * Result from parsing an OAuth popup response
 */
export interface OAuthPopupResult {
  /** The OIDC token (for non-PKCE providers) */
  idToken?: string | undefined;
  /** The authorization code (for PKCE providers) */
  authCode?: string | undefined;
  /** Session key from state */
  sessionKey?: string | undefined;
  /** The provider from state */
  provider?: string | undefined;
}

/**
 * Parses the OAuth response from a popup window URL
 * @param url - The popup window URL after OAuth redirect
 * @param provider - The expected OAuth provider
 * @returns Parsed OAuth result or null if not valid
 */
export function parseOAuthPopupResponse(
  url: string,
  provider: OAuthProviders,
): OAuthPopupResult | null {
  const config = OAUTH_PROVIDER_CONFIGS[provider];

  if (config.usesPKCE) {
    // PKCE providers return code in search params
    const urlParams = new URLSearchParams(new URL(url).search);
    const authCode = urlParams.get("code");
    const stateParam = urlParams.get("state");
    const { sessionKey, provider: stateProvider } = parseStateParam(stateParam);

    if (authCode && stateParam && stateProvider === provider) {
      return { authCode, sessionKey, provider: stateProvider };
    }
  } else {
    // Non-PKCE providers return id_token in hash
    const hashParams = new URLSearchParams(url.split("#")[1]);
    const idToken = hashParams.get("id_token");
    const stateParams = hashParams.get("state");
    const { sessionKey } = parseStateParam(stateParams);

    if (idToken) {
      return { idToken, sessionKey, provider };
    }
  }

  return null;
}

// ============================================================================
// OAuth Popup Completion
// ============================================================================

/**
 * Common OAuth completion handler for popup flows
 * Handles both PKCE and non-PKCE provider completion
 */
export interface OAuthPopupCompletionParams {
  provider: OAuthProviders;
  publicKey: string;
  result: OAuthPopupResult;
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

// ============================================================================
// OAuth Helper Utilities
// ============================================================================

/**
 * Capitalizes the first letter of a provider name
 * @param provider - The provider name (e.g., "facebook", "discord")
 * @returns The capitalized provider name (e.g., "Facebook", "Discord")
 */
export function capitalizeProviderName(provider: string): string {
  if (!provider) return "Provider";
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}

/**
 * Gets the FontAwesome icon for an OAuth provider
 * @param provider - The provider name
 * @returns The FontAwesome icon definition
 */
export function getProviderIcon(provider: string | null | undefined) {
  switch (provider) {
    case OAuthProviders.FACEBOOK:
      return faFacebook;
    case OAuthProviders.DISCORD:
      return faDiscord;
    case OAuthProviders.X:
      return faXTwitter;
    case OAuthProviders.APPLE:
      return faApple;
    case OAuthProviders.GOOGLE:
    default:
      return faGoogle;
  }
}

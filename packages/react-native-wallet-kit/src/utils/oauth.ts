import { sha256 } from "@noble/hashes/sha256";
import { stringToBase64urlString } from "@turnkey/encoding";
import { AuthAction, BaseAuthResult, OAuthProviders } from "@turnkey/sdk-types";
import AsyncStorageModule from "@react-native-async-storage/async-storage";

// some bundlers wrap the module as { default: AsyncStorage } instead of
// returning AsyncStorage directly. This handles both cases
const AsyncStorage = (AsyncStorageModule as any).default ?? AsyncStorageModule;

export const DISCORD_AUTH_URL = "https://discord.com/oauth2/authorize";
export const X_AUTH_URL = "https://x.com/i/oauth2/authorize";
export const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const APPLE_AUTH_URL = "https://account.apple.com/auth/authorize";
export const APPLE_AUTH_SCRIPT_URL =
  "https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js";
export const FACEBOOK_AUTH_URL = "https://www.facebook.com/v23.0/dialog/oauth";
export const FACEBOOK_GRAPH_URL =
  "https://graph.facebook.com/v23.0/oauth/access_token";

export const TURNKEY_OAUTH_ORIGIN_URL = "https://oauth-origin.turnkey.com";
export const TURNKEY_OAUTH_REDIRECT_URL = "https://oauth-redirect.turnkey.com";

// ============================================================================
// OAuth State Building
// ============================================================================

/**
 * Builds the OAuth state parameter string
 */
export function buildOAuthState(params: {
  provider: OAuthProviders;
  flow: "redirect";
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
// OAuth Response Parsing
// ============================================================================

/**
 * Result from parsing an OAuth response (both popup and redirect flows)
 */
export interface OAuthResponseResult {
  /** The OIDC token (for non-PKCE providers) */
  idToken?: string | null | undefined;
  /** The authorization code (for PKCE providers) */
  authCode?: string | null | undefined;
  /** Session key from state */
  sessionKey?: string | undefined;
  /** The provider from state */
  provider?: string | null;
  /** Flow type from state */
  flow?: string | null;
  /** Public key from state */
  publicKey?: string | null;
  /** Open modal flag from state */
  openModal?: string | null;
  /** OAuth intent from state */
  oauthIntent?: string | null;
  /** Nonce from state */
  nonce?: string | null;
}

/**
 * Unified OAuth response parser for both popup and redirect flows.
 * Handles both:
 * - PKCE flows (Facebook, Discord, X): code in search parameters
 * - Non-PKCE flows (Google, Apple): id_token in hash parameters
 * - Apple's non-standard hash format where state parameters are directly embedded
 *
 * @param url - The full URL to parse (from popup or redirect)
 * @param expectedProvider - Optional provider if already known (for popup flows)
 * @returns Parsed OAuth response data including tokens, codes, and state parameters, or null if invalid
 */
export function parseOAuthResponse(
  url: string,
  expectedProvider?: OAuthProviders,
): OAuthResponseResult | null {
  let idToken: string | null | undefined = null;
  let authCode: string | null | undefined = null;
  let stateString: string | null = null;

  const parsedUrl = new URL(url);
  const search = parsedUrl.search.substring(1); // Remove leading '?'
  const hash = parsedUrl.hash.substring(1); // Remove leading '#'

  // Handle PKCE flows (code in search parameters)
  if (search && search.includes("code=")) {
    const searchParams = new URLSearchParams(search);
    authCode = searchParams.get("code");
    stateString = searchParams.get("state");
  }
  // Handle non-PKCE flows (id_token in hash)
  else if (hash) {
    // Handle Apple's non-standard format: state=provider=apple&flow=redirect&...&code=...&id_token=...
    if (hash.startsWith("state=provider=apple")) {
      // Extract id_token from the end
      const idTokenMatch = hash.match(/id_token=([^&]+)$/);
      idToken = idTokenMatch ? idTokenMatch[1] : null;

      // Extract state content between "state=" and "&code="
      const stateEndIndex = hash.indexOf("&code=");
      if (stateEndIndex !== -1) {
        stateString = hash.substring(6, stateEndIndex); // Remove "state=" prefix
      }
    } else {
      // Standard OAuth format - parse as URLSearchParams
      const hashParams = new URLSearchParams(hash);
      idToken = hashParams.get("id_token");
      stateString = hashParams.get("state");
    }
  }

  // Parse state parameters
  const {
    provider,
    flow,
    publicKey,
    openModal,
    sessionKey,
    oauthIntent,
    nonce,
  } = parseStateParam(stateString);

  // If we have an expected provider (popup flow), validate it matches
  if (expectedProvider) {
    const config = OAUTH_PROVIDER_CONFIGS[expectedProvider];

    if (config.usesPKCE) {
      // PKCE providers must have authCode and matching provider in state
      if (!authCode || !stateString || provider !== expectedProvider) {
        return null;
      }
    } else {
      // Non-PKCE providers must have idToken
      if (!idToken) {
        return null;
      }
    }
  }

  return {
    idToken,
    authCode,
    provider: provider ?? null,
    flow: flow ?? null,
    publicKey: publicKey ?? null,
    openModal: openModal ?? null,
    sessionKey: sessionKey ?? undefined,
    oauthIntent: oauthIntent ?? null,
    nonce: nonce ?? null,
  };
}

// Function to generate PKCE challenge pair for Facebook OAuth
export async function generateChallengePair(): Promise<{
  verifier: string;
  codeChallenge: string;
}> {
  // Generate verifier from 32 random bytes
  const randomBytes = new Uint8Array(32);
  // eslint-disable-next-line no-undef
  crypto.getRandomValues(randomBytes);
  const randomAsBinary = String.fromCharCode(...randomBytes);
  const verifier = stringToBase64urlString(randomAsBinary);

  // Compute SHA-256 over ASCII(verifier), then base64url encode
  const ascii = new TextEncoder().encode(verifier);
  const digest = sha256(ascii);
  const digestAsBinary = String.fromCharCode(...digest);
  const codeChallenge = stringToBase64urlString(digestAsBinary);

  return { verifier, codeChallenge };
}

// ============================================================================
// PKCE Verifier Management (AsyncStorage-based)
// ============================================================================

/** Provider type for PKCE-based OAuth */
export type PKCEProvider =
  | OAuthProviders.FACEBOOK
  | OAuthProviders.DISCORD
  | OAuthProviders.X;

/**
 * Gets the AsyncStorage key name for a PKCE provider's verifier
 */
export function getPKCEVerifierKey(provider: PKCEProvider): string {
  return `${provider}_verifier`;
}

/**
 * Stores the PKCE verifier in AsyncStorage
 * @param provider - The OAuth provider
 * @param verifier - The verifier string to store
 */
export async function storePKCEVerifier(
  provider: PKCEProvider,
  verifier: string,
): Promise<void> {
  const key = getPKCEVerifierKey(provider);
  await AsyncStorage.setItem(key, verifier);
}

/**
 * Retrieves and removes the PKCE verifier from AsyncStorage
 * @param provider - The OAuth provider
 * @returns The verifier string
 * @throws Error if verifier is not found
 */
export async function consumePKCEVerifier(
  provider: PKCEProvider,
): Promise<string> {
  const key = getPKCEVerifierKey(provider);
  const verifier = await AsyncStorage.getItem(key);
  if (!verifier) {
    throw new Error(
      `Missing PKCE verifier for ${provider}. OAuth flow may have been interrupted.`,
    );
  }
  await AsyncStorage.removeItem(key);
  return verifier;
}

/**
 * Checks if a PKCE verifier exists for a provider (without consuming it)
 * @param provider - The OAuth provider
 * @returns true if verifier exists
 */
export async function hasPKCEVerifier(
  provider: PKCEProvider,
): Promise<boolean> {
  const key = getPKCEVerifierKey(provider);
  const verifier = await AsyncStorage.getItem(key);
  return verifier !== null;
}

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
  codeChallenge?: string | undefined;
  additionalState?: Record<string, string> | undefined;
  /** If true, uses direct provider URLs; if false, uses Turnkey OAuth proxy */
  useOauthProxyOrigin?: boolean;
}

/**
 * Builds the complete OAuth authorization URL for a provider
 * For react-native, can use either:
 * - Direct provider URLs (Discord, X)
 * - Turnkey OAuth proxy (Google, Apple, Facebook)
 */
export function buildOAuthUrl(params: BuildOAuthUrlParams): string {
  const {
    provider,
    clientId,
    redirectUri,
    publicKey,
    nonce,
    codeChallenge,
    additionalState,
    useOauthProxyOrigin = false,
  } = params;

  const config = OAUTH_PROVIDER_CONFIGS[provider];

  // Build state parameter
  const stateParams: Parameters<typeof buildOAuthState>[0] = {
    provider,
    flow: "redirect",
    publicKey,
  };
  if (!config.nonceInParams && nonce) {
    stateParams.nonce = nonce;
  }
  if (additionalState) {
    stateParams.additionalState = additionalState;
  }
  const state = buildOAuthState(stateParams);

  // If using Turnkey Oauth proxy (for Google, Apple, Facebook)
  if (useOauthProxyOrigin) {
    const url = new URL(TURNKEY_OAUTH_ORIGIN_URL);
    url.searchParams.set("provider", provider);
    url.searchParams.set("clientId", clientId);
    url.searchParams.set("redirectUri", redirectUri);
    url.searchParams.set("nonce", nonce);
    if (codeChallenge) {
      url.searchParams.set("codeChallenge", codeChallenge);
    }
    url.searchParams.set("state", state);
    return url.toString();
  }

  // Direct provider URLs (for Discord, X)
  const authUrl = new URL(config.authUrl);
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", config.responseType);

  if (config.scopes) {
    authUrl.searchParams.set("scope", config.scopes);
  }

  if (config.usesPKCE && codeChallenge) {
    authUrl.searchParams.set("code_challenge", codeChallenge);
    authUrl.searchParams.set("code_challenge_method", "S256");
  }

  authUrl.searchParams.set("state", state);

  return authUrl.toString();
}

// ============================================================================
// InAppBrowser Result Parsing
// ============================================================================

/**
 * Parsed result from an InAppBrowser OAuth deep link
 */
export interface ParsedInAppBrowserResult {
  /** The OIDC token (for non-PKCE providers) */
  idToken?: string | null;
  /** The authorization code (for PKCE providers) */
  authCode?: string | null;
  /** Session key from state */
  sessionKey?: string | undefined;
  /** The provider from state */
  provider?: string | null;
  /** Public key from state */
  publicKey?: string | null;
  /** Nonce from state */
  nonce?: string | null;
}

/**
 * Parses the deep link URL returned from InAppBrowser after OAuth redirect
 * @param deepLinkUrl - The URL from InAppBrowser result (e.g., "myapp://?id_token=...&state=...")
 * @returns Parsed OAuth response data
 */
export function parseInAppBrowserResult(
  deepLinkUrl: string,
): ParsedInAppBrowserResult {
  const qsIndex = deepLinkUrl.indexOf("?");
  const queryString = qsIndex >= 0 ? deepLinkUrl.substring(qsIndex + 1) : "";
  const urlParams = new URLSearchParams(queryString);

  const idToken = urlParams.get("id_token");
  const authCode = urlParams.get("code");
  const stateParam = urlParams.get("state");

  // Parse state parameter
  const stateData = parseStateParam(stateParam);

  return {
    idToken: idToken ?? null,
    authCode: authCode ?? null,
    sessionKey: stateData.sessionKey,
    provider: stateData.provider ?? null,
    publicKey: stateData.publicKey ?? null,
    nonce: stateData.nonce ?? null,
  };
}

// ============================================================================
// OAuth Completion Flow
// ============================================================================

/**
 * Completion handler callbacks for OAuth flow
 */
export interface OAuthCompletionCallbacks {
  /** Called on successful OAuth completion */
  onOauthSuccess?: (params: {
    oidcToken: string;
    providerName: string;
    publicKey: string;
    sessionKey?: string;
  }) => void;
  /** Called when OAuth should redirect */
  onOauthRedirect?: (params: {
    idToken: string;
    publicKey: string;
    sessionKey?: string;
  }) => void;
}

/**
 * Parameters for completing an OAuth flow
 */
export interface CompleteOAuthFlowParams {
  provider: OAuthProviders;
  publicKey: string;
  oidcToken: string;
  sessionKey?: string;
  callbacks?: OAuthCompletionCallbacks;
  /** Function to complete the OAuth authentication */
  completeOauth: (params: {
    oidcToken: string;
    publicKey: string;
    providerName: string;
    sessionKey?: string;
  }) => Promise<BaseAuthResult & { action: AuthAction }>;
}

/**
 * Unified OAuth completion handler.
 * Routes to the appropriate completion handler based on params:
 * Priority: callbacks.onOauthSuccess > callbacks.onOauthRedirect > completeOauth
 *
 * This is the core completion logic used by InAppBrowser flows.
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
  } = params;

  const completionParams = {
    oidcToken,
    providerName: provider,
    publicKey,
    ...(sessionKey && { sessionKey }),
  };

  if (callbacks?.onOauthSuccess) {
    callbacks.onOauthSuccess(completionParams);
    return;
  }

  if (callbacks?.onOauthRedirect) {
    callbacks.onOauthRedirect({
      idToken: oidcToken,
      publicKey,
      ...(sessionKey && { sessionKey }),
    });
    return;
  }

  await completeOauth(completionParams);
}

// ============================================================================
// PKCE Flow Handler
// ============================================================================

/**
 * Parameters for the unified PKCE flow handler
 */
export interface HandlePKCEFlowParams {
  provider: PKCEProvider;
  publicKey: string;
  authCode: string;
  sessionKey?: string;
  callbacks?: OAuthCompletionCallbacks;
  completeOauth: (params: {
    oidcToken: string;
    publicKey: string;
    providerName: string;
    sessionKey?: string;
  }) => Promise<BaseAuthResult & { action: AuthAction }>;
  /** Function to exchange code for token (provider-specific) */
  exchangeCodeForToken: (codeVerifier: string) => Promise<string>;
}

/**
 * Unified PKCE flow handler for all PKCE-based OAuth providers.
 * Handles the complete PKCE flow: verifier retrieval, token exchange, and completion routing.
 *
 * @param params - The PKCE flow parameters
 * @returns A promise that resolves when the flow is complete
 */
export async function handlePKCEFlow(
  params: HandlePKCEFlowParams,
): Promise<void> {
  const {
    provider,
    publicKey,
    authCode,
    sessionKey,
    callbacks,
    completeOauth,
    exchangeCodeForToken,
  } = params;

  if (!authCode) {
    throw new Error(`Missing authorization code from ${provider} OAuth`);
  }

  // Get and consume the stored verifier
  const verifier = await consumePKCEVerifier(provider);

  try {
    // Exchange code for token
    const oidcToken = await exchangeCodeForToken(verifier);

    if (!oidcToken) {
      throw new Error(`Missing oidcToken from ${provider} OAuth exchange`);
    }

    // Complete the OAuth flow
    const completionParams: CompleteOAuthFlowParams = {
      provider,
      publicKey,
      oidcToken,
      completeOauth,
    };
    if (sessionKey) {
      completionParams.sessionKey = sessionKey;
    }
    if (callbacks) {
      completionParams.callbacks = callbacks;
    }
    await completeOAuthFlow(completionParams);
  } catch (error) {
    // Ensure cleanup even on error
    const key = getPKCEVerifierKey(provider);
    await AsyncStorage.removeItem(key).catch(() => {
      /* ignore cleanup errors */
    });
    throw error;
  }
}

// Function to exchange Facebook authorization code for token
export async function exchangeCodeForToken(
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

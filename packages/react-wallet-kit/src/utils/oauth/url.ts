import { OAuthProviders } from "@turnkey/sdk-types";
import { OAUTH_PROVIDER_CONFIGS, popupWidth, popupHeight } from "./config";

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
  const timeLimit = 5 * 60 * 1000; // 5 minutes
  return new Promise((_, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Authentication timed out."));
    }, timeLimit);
    window.addEventListener("beforeunload", () => clearTimeout(timeout));
  });
}

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

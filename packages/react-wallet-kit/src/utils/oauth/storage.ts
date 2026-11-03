import {
  TurnkeyError,
  TurnkeyErrorCodes,
  OAuthProviders,
} from "@turnkey/sdk-types";

export const OAUTH_INTENT_ADD_PROVIDER = "addProvider";
export const OAUTH_ADD_PROVIDER_METADATA_KEY = "oauth_add_provider_metadata";
export const OAUTH_STATE_KEY = "oauth_state";
export const OAUTH_CAPTCHA_TOKEN_KEY = "oauth_captcha_token";

export type OAuthAddProviderMetadata = {
  organizationId: string;
  userId: string;
  stampWith?: string;
  successPageDuration?: number;
};

/** Provider type for PKCE-based OAuth */
export type PKCEProvider =
  | OAuthProviders.FACEBOOK
  | OAuthProviders.DISCORD
  | OAuthProviders.X;

// We use localStorage instead of sessionStorage to store OAuth data since the user
// might leave the current browsing context during the OAuth flow. We ran into this
// with X OAuth on Android where if the user has the X app installed, oauth would
// open the native app and when they come back to the browser, sessionStorage is gone

/**
 * Stores OAuth add provider metadata in local storage
 * Used for addOauthProvider flow if opening in-page
 */
export function storeOAuthAddProviderMetadata(
  metadata: OAuthAddProviderMetadata,
): void {
  localStorage.setItem(
    OAUTH_ADD_PROVIDER_METADATA_KEY,
    JSON.stringify(metadata),
  );
}

/**
 * Retrieves OAuth add provider metadata from local storage
 */
export function getOAuthAddProviderMetadata(): OAuthAddProviderMetadata | null {
  const stored = localStorage.getItem(OAUTH_ADD_PROVIDER_METADATA_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored) as OAuthAddProviderMetadata;
  } catch {
    return null;
  }
}

/**
 * Retrieves and removes the OAuth add provider metadata, so it is used by
 * exactly the one flow that completes with it, the way the PKCE verifier and
 * captcha token are consumed.
 */
export function consumeOAuthAddProviderMetadata(): OAuthAddProviderMetadata | null {
  const metadata = getOAuthAddProviderMetadata();
  localStorage.removeItem(OAUTH_ADD_PROVIDER_METADATA_KEY);
  return metadata;
}

/**
 * Gets the verifier key name for a PKCE provider
 */
export function getPKCEVerifierKey(provider: PKCEProvider): string {
  return `${provider}_verifier`;
}

/**
 * Retrieves and removes the PKCE verifier from local storage
 * @param provider - The OAuth provider
 * @returns The verifier string
 * @throws TurnkeyError if verifier is not found
 */
export function consumePKCEVerifier(provider: PKCEProvider): string {
  const key = getPKCEVerifierKey(provider);
  const verifier = localStorage.getItem(key);
  if (!verifier) {
    throw new TurnkeyError(
      `Missing PKCE verifier for ${provider} authentication`,
      TurnkeyErrorCodes.NO_PKCE_VERIFIER_FOUND,
    );
  }
  localStorage.removeItem(key);
  return verifier;
}

/**
 * Stores the PKCE verifier in local storage
 * @param provider - The OAuth provider
 * @param verifier - The verifier string to store
 */
export function storePKCEVerifier(
  provider: PKCEProvider,
  verifier: string,
): void {
  localStorage.setItem(getPKCEVerifierKey(provider), verifier);
}

/**
 * Checks if a PKCE verifier exists for a provider (without consuming it)
 * @param provider - The OAuth provider
 * @returns true if verifier exists
 */
export function hasPKCEVerifier(provider: PKCEProvider): boolean {
  return localStorage.getItem(getPKCEVerifierKey(provider)) !== null;
}

/**
 * Stores the captcha token for an in-page OAuth redirect.
 */
export function storeOAuthCaptchaToken(token: string): void {
  localStorage.setItem(OAUTH_CAPTCHA_TOKEN_KEY, token);
}

/**
 * Retrieves and removes the captcha token stored for an OAuth redirect.
 * @returns The captcha token, or null if none was stored
 */
export function consumeOAuthCaptchaToken(): string | null {
  const token = localStorage.getItem(OAUTH_CAPTCHA_TOKEN_KEY);
  localStorage.removeItem(OAUTH_CAPTCHA_TOKEN_KEY);
  return token;
}

/**
 * Builds the storage key for a single OAuth attempt.
 *
 * The state string is unique per attempt, so using it in the key keeps
 * concurrent flows — a second tab, or a second attempt started before the
 * first finished — from overwriting each other's state.
 */
function getOAuthStateKey(state: string): string {
  return `${OAUTH_STATE_KEY}:${state}`;
}

/**
 * Stores the OAuth state string in local storage for later validation
 * @param state - The OAuth state string to store
 */
export function storeOAuthState(state: string) {
  localStorage.setItem(getOAuthStateKey(state), state);
}

/** Clears the stored state for one OAuth attempt without affecting others. */
export function clearOAuthState(state: string): void {
  localStorage.removeItem(getOAuthStateKey(state));

  // Also clean up this attempt if it was stored by a version that used the
  // legacy, unscoped key. Preserve it when it belongs to another attempt.
  if (localStorage.getItem(OAUTH_STATE_KEY) === state) {
    localStorage.removeItem(OAUTH_STATE_KEY);
  }
}

/**
 * Consumes the OAuth state string from local storage for validation
 * @param returnedState - The OAuth state string returned from the provider
 */
export function consumeOAuthState(returnedState: string) {
  const key = getOAuthStateKey(returnedState);
  try {
    // The legacy unscoped key is still read so a redirect that was already in
    // flight when this version shipped can still complete.
    const stored =
      localStorage.getItem(key) ?? localStorage.getItem(OAUTH_STATE_KEY);

    if (!stored) {
      throw new TurnkeyError(
        "Missing OAuth state in storage",
        TurnkeyErrorCodes.INVALID_OAUTH_STATE,
      );
    }

    if (stored !== returnedState) {
      throw new TurnkeyError(
        "OAuth state mismatch",
        TurnkeyErrorCodes.INVALID_OAUTH_STATE,
      );
    }
  } finally {
    localStorage.removeItem(key);
    localStorage.removeItem(OAUTH_STATE_KEY);
  }
}

/**
 * Clears all OAuth-related data from local storage
 */
export function clearAllOAuthData(): void {
  localStorage.removeItem(OAUTH_ADD_PROVIDER_METADATA_KEY);
  localStorage.removeItem(OAUTH_STATE_KEY);
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (key?.startsWith(`${OAUTH_STATE_KEY}:`)) {
      localStorage.removeItem(key);
    }
  }
  localStorage.removeItem(OAUTH_CAPTCHA_TOKEN_KEY);
  const pkceProviders: PKCEProvider[] = [
    OAuthProviders.FACEBOOK,
    OAuthProviders.DISCORD,
    OAuthProviders.X,
  ];
  for (const provider of pkceProviders) {
    localStorage.removeItem(getPKCEVerifierKey(provider));
  }
}

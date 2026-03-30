import {
  TurnkeyError,
  TurnkeyErrorCodes,
  OAuthProviders,
} from "@turnkey/sdk-types";

export const OAUTH_INTENT_ADD_PROVIDER = "addProvider";
export const OAUTH_ADD_PROVIDER_METADATA_KEY = "oauth_add_provider_metadata";

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
 * Clears all OAuth-related data from local storage
 */
export function clearAllOAuthData(): void {
  localStorage.removeItem(OAUTH_ADD_PROVIDER_METADATA_KEY);
  const pkceProviders: PKCEProvider[] = [
    OAuthProviders.FACEBOOK,
    OAuthProviders.DISCORD,
    OAuthProviders.X,
  ];
  for (const provider of pkceProviders) {
    localStorage.removeItem(getPKCEVerifierKey(provider));
  }
}

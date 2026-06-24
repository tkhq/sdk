import {
  TurnkeyError,
  TurnkeyErrorCodes,
  OAuthProviders,
} from "@turnkey/sdk-types";
import {
  encryptAndStore,
  retrieveAndDecrypt,
  removeStoredValue,
} from "../crypto";

export const OAUTH_INTENT_ADD_PROVIDER = "addProvider";
export const OAUTH_ADD_PROVIDER_METADATA_KEY = "oauth_add_provider_metadata";
export const OAUTH_STATE_KEY = "oauth_state";

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
//
// All values are encrypted at rest using AES-GCM with a non-extractable CryptoKey
// stored in IndexedDB (Cure53 audit finding TUR-02-004). If Web Crypto API or
// IndexedDB is unavailable, storage falls back to plaintext localStorage so the
// auth flow is never broken.

/**
 * Stores OAuth add provider metadata in local storage (encrypted at rest)
 * Used for addOauthProvider flow if opening in-page
 */
export async function storeOAuthAddProviderMetadata(
  metadata: OAuthAddProviderMetadata,
): Promise<void> {
  await encryptAndStore(
    OAUTH_ADD_PROVIDER_METADATA_KEY,
    JSON.stringify(metadata),
  );
}

/**
 * Retrieves OAuth add provider metadata from local storage
 */
export async function getOAuthAddProviderMetadata(): Promise<OAuthAddProviderMetadata | null> {
  const stored = await retrieveAndDecrypt(OAUTH_ADD_PROVIDER_METADATA_KEY);
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
export async function consumePKCEVerifier(provider: PKCEProvider): Promise<string> {
  const key = getPKCEVerifierKey(provider);
  const verifier = await retrieveAndDecrypt(key);
  if (!verifier) {
    throw new TurnkeyError(
      `Missing PKCE verifier for ${provider} authentication`,
      TurnkeyErrorCodes.NO_PKCE_VERIFIER_FOUND,
    );
  }
  removeStoredValue(key);
  return verifier;
}

/**
 * Stores the PKCE verifier in local storage (encrypted at rest)
 * @param provider - The OAuth provider
 * @param verifier - The verifier string to store
 */
export async function storePKCEVerifier(
  provider: PKCEProvider,
  verifier: string,
): Promise<void> {
  await encryptAndStore(getPKCEVerifierKey(provider), verifier);
}

/**
 * Checks if a PKCE verifier exists for a provider (without consuming it)
 * @param provider - The OAuth provider
 * @returns true if verifier exists
 */
export async function hasPKCEVerifier(provider: PKCEProvider): Promise<boolean> {
  const value = await retrieveAndDecrypt(getPKCEVerifierKey(provider));
  return value !== null;
}

/**
 * Stores the OAuth state string in local storage (encrypted at rest) for later validation
 * @param state - The OAuth state string to store
 */
export async function storeOAuthState(state: string): Promise<void> {
  await encryptAndStore(OAUTH_STATE_KEY, state);
}

/**
 * Consumes the OAuth state string from local storage for validation
 * @param returnedState - The OAuth state string returned from the provider
 */
export async function consumeOAuthState(returnedState: string): Promise<void> {
  try {
    const stored = await retrieveAndDecrypt(OAUTH_STATE_KEY);

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
    removeStoredValue(OAUTH_STATE_KEY);
  }
}

/**
 * Clears all OAuth-related data from local storage
 */
export function clearAllOAuthData(): void {
  removeStoredValue(OAUTH_ADD_PROVIDER_METADATA_KEY);
  removeStoredValue(OAUTH_STATE_KEY);
  const pkceProviders: PKCEProvider[] = [
    OAuthProviders.FACEBOOK,
    OAuthProviders.DISCORD,
    OAuthProviders.X,
  ];
  for (const provider of pkceProviders) {
    removeStoredValue(getPKCEVerifierKey(provider));
  }
}

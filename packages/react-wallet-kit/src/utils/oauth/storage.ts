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
  try {
    localStorage.setItem(
      OAUTH_ADD_PROVIDER_METADATA_KEY,
      JSON.stringify(metadata),
    );
  } catch (error) {
    throw new TurnkeyError(
      `Failed to store OAuth add provider metadata: ${error instanceof Error ? error.message : "Unknown error"}`,
      TurnkeyErrorCodes.OAUTH_SIGNUP_ERROR,
    );
  }
}

/**
 * Retrieves OAuth add provider metadata from local storage
 */
export function getOAuthAddProviderMetadata(): OAuthAddProviderMetadata | null {
  try {
    const stored = localStorage.getItem(OAUTH_ADD_PROVIDER_METADATA_KEY);
    if (!stored) return null;
    try {
      return JSON.parse(stored) as OAuthAddProviderMetadata;
    } catch {
      return null;
    }
  } catch (error) {
    throw new TurnkeyError(
      `Failed to retrieve OAuth add provider metadata: ${error instanceof Error ? error.message : "Unknown error"}`,
      TurnkeyErrorCodes.OAUTH_SIGNUP_ERROR,
    );
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
  try {
    const key = getPKCEVerifierKey(provider);
    const verifier = localStorage.getItem(key);
    if (!verifier) {
      throw new TurnkeyError(
        `Missing PKCE verifier for ${provider} authentication`,
        TurnkeyErrorCodes.OAUTH_SIGNUP_ERROR,
      );
    }
    localStorage.removeItem(key);
    return verifier;
  } catch (error) {
    if (error instanceof TurnkeyError) {
      throw error;
    }
    throw new TurnkeyError(
      `Failed to access PKCE verifier for ${provider}: ${error instanceof Error ? error.message : "Unknown error"}`,
      TurnkeyErrorCodes.OAUTH_SIGNUP_ERROR,
    );
  }
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
  try {
    localStorage.setItem(getPKCEVerifierKey(provider), verifier);
  } catch (error) {
    throw new TurnkeyError(
      `Failed to store PKCE verifier for ${provider}: ${error instanceof Error ? error.message : "Unknown error"}`,
      TurnkeyErrorCodes.OAUTH_SIGNUP_ERROR,
    );
  }
}

/**
 * Checks if a PKCE verifier exists for a provider (without consuming it)
 * @param provider - The OAuth provider
 * @returns true if verifier exists
 */
export function hasPKCEVerifier(provider: PKCEProvider): boolean {
  try {
    return localStorage.getItem(getPKCEVerifierKey(provider)) !== null;
  } catch (error) {
    throw new TurnkeyError(
      `Failed to check PKCE verifier for ${provider}: ${error instanceof Error ? error.message : "Unknown error"}`,
      TurnkeyErrorCodes.OAUTH_SIGNUP_ERROR,
    );
  }
}

/**
 * Clears all OAuth-related data from local storage
 */
export function clearAllOAuthData(): void {
  try {
    localStorage.removeItem(OAUTH_ADD_PROVIDER_METADATA_KEY);
    const pkceProviders: PKCEProvider[] = [
      OAuthProviders.FACEBOOK,
      OAuthProviders.DISCORD,
      OAuthProviders.X,
    ];
    for (const provider of pkceProviders) {
      localStorage.removeItem(getPKCEVerifierKey(provider));
    }
  } catch {
    // Best-effort cleanup
  }
}

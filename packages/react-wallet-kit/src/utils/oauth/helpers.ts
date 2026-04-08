import {
  OAuthProviders,
  v1OauthProviderParamsV2,
  v1OidcClaims,
} from "@turnkey/sdk-types";
import {
  faFacebook,
  faDiscord,
  faXTwitter,
  faApple,
  faGoogle,
} from "@fortawesome/free-brands-svg-icons";
import jwtDecode from "jwt-decode";

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

/**
 * Decodes the OIDC token to extract `iss` and `sub`, then builds a list of
 * `oidcClaims` (one per secondary client ID) suitable for use as the `aud` in
 * `v1OauthProviderParamsV2.oidcClaims`. Returns an empty array if there are no
 * secondary client IDs or if the token is missing `iss`/`sub`.
 */
export function buildSecondaryOidcClaims(
  oidcToken: string,
  secondaryClientIds: string[],
): v1OidcClaims[] {
  if (secondaryClientIds.length === 0) return [];
  const { iss, sub } = jwtDecode<{ iss?: string; sub?: string }>(oidcToken);
  if (!iss || !sub) return [];
  return secondaryClientIds.map((aud) => ({ iss, sub, aud }));
}

/**
 * Builds secondary `v1OauthProviderParamsV2` entries (using `oidcClaims`-style
 * audiences) from a list of secondary client IDs. Each entry is tagged with the
 * given `providerName`.
 */
export function buildSecondaryOauthProviders(
  oidcToken: string,
  providerName: string,
  secondaryClientIds: string[],
): v1OauthProviderParamsV2[] {
  return buildSecondaryOidcClaims(oidcToken, secondaryClientIds).map(
    (oidcClaims) => ({ providerName, oidcClaims }),
  );
}

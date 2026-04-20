import { OAuthProviders } from "@turnkey/sdk-types";
import {
  faFacebook,
  faDiscord,
  faXTwitter,
  faApple,
  faGoogle,
} from "@fortawesome/free-brands-svg-icons";

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

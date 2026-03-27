import { OAuthProviders } from "@turnkey/sdk-types";

export const DISCORD_AUTH_URL = "https://discord.com/oauth2/authorize";
export const X_AUTH_URL = "https://x.com/i/oauth2/authorize";
export const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const APPLE_AUTH_URL = "https://account.apple.com/auth/authorize";
export const APPLE_AUTH_SCRIPT_URL =
  "https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js";
export const FACEBOOK_AUTH_URL = "https://www.facebook.com/v11.0/dialog/oauth";
export const FACEBOOK_GRAPH_URL =
  "https://graph.facebook.com/v11.0/oauth/access_token";

export const popupWidth = 500;
export const popupHeight = 600;

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

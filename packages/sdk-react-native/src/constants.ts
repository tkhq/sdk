export enum StorageKeys {
  DefaultSession = "@turnkey/session",
  EmbeddedKey = "@turnkey/embedded-key",
  RefreshEmbeddedKey = "@turnkey/refresh-embedded-key",
  SessionKeys = "@turnkey/session-keys",
  SelectedSession = "@turnkey/selected-session",
}

export const OTP_AUTH_DEFAULT_EXPIRATION_SECONDS = 15 * 60;
export const MAX_SESSIONS = 15;
export const SESSION_WARNING_THRESHOLD_SECONDS = 15;

export const TURNKEY_OAUTH_ORIGIN_URL = "https://oauth-redirect.preprod.turnkey.engineering"; // TODO: we need to change this when we go deploy to prod
export const TURNKEY_REDIRECT_ORIGIN_URL = "https://oauth-redirect.preprod.turnkey.engineering"; // TODO: we need to change this when we go deploy to prod

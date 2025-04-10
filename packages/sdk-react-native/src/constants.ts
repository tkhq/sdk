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
export const TURNKEY_OAUTH_PROXY_URL = "http://localhost:3000"; // TODO: WE NEED TO CHANGE THIS WHEN WE DEPLOY THE PROXY

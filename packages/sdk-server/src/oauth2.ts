import type { v1Oauth2Provider } from "@turnkey/sdk-types";

export type ExchangeOauth2CodeParams = {
  /** The OAuth 2.0 credential to authenticate with, from `createOauth2Credential`. */
  oauth2CredentialId: string;
  /** Must match the credential's provider. */
  provider: v1Oauth2Provider;
  /** Must match the credential's client ID. */
  clientId: string;
  /** Authorization code returned by the provider. */
  authCode: string;
  /** PKCE code verifier used in the authorization request. */
  codeVerifier: string;
  /** Redirect URI used in the authorization request. */
  redirectUri: string;
  /** Nonce bound into the OIDC token, normally `sha256(publicKey)` as lowercase hex. */
  nonce: string;
  /** Optional uncompressed P-256 public key that receives the provider bearer token, encrypted, in the OIDC token. */
  bearerTokenTargetPublicKey?: string;
  organizationId?: string;
  /** Override the TLS Fetcher public key used to verify the encryption target. Testing only. */
  dangerouslyOverrideSignerPublicKey?: string;
};

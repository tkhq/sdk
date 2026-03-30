import { FACEBOOK_GRAPH_URL } from "./config";

/**
 * Generates a PKCE challenge pair (verifier and code challenge)
 */
export async function generateChallengePair(): Promise<{
  verifier: string;
  codeChallenge: string;
}> {
  const randomBytes = new Uint8Array(32);
  window.crypto.getRandomValues(randomBytes);
  const verifier = btoa(String.fromCharCode(...randomBytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await window.crypto.subtle.digest("SHA-256", data);

  const base64Challenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  return { verifier, codeChallenge: base64Challenge };
}

/**
 * Exchanges Facebook authorization code for token
 */
export async function exchangeFacebookCodeForToken(
  clientId: string,
  redirectUri: string,
  code: string,
  codeVerifier: string,
): Promise<{ id_token: string }> {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
    code: code,
    grant_type: "authorization_code",
  });

  const response = await fetch(FACEBOOK_GRAPH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(
      `Facebook token exchange failed: ${JSON.stringify(errorData)}`,
    );
  }

  return await response.json();
}

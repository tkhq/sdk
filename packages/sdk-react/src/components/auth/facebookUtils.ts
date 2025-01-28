"use server";

import crypto from "crypto";
import { FACEBOOK_GRAPH_URL } from "./constants";

export async function generateChallengePair() {
  const verifier = crypto.randomBytes(32).toString("base64url");
  const codeChallenge = crypto
    .createHash("sha256")
    .update(verifier)
    .digest("base64url");
  return { verifier, codeChallenge };
}

export async function exchangeCodeForToken(
  clientId: string,
  redirectURI: string,
  authCode: string,
  verifier: string,
) {
  const response = await fetch(FACEBOOK_GRAPH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      redirect_uri: redirectURI,
      code: authCode,
      code_verifier: verifier,
    }),
  });

  const tokenData = await response.json();
  if (!response.ok) {
    throw new Error("Token exchange failed: " + JSON.stringify(tokenData));
  }
  return tokenData;
}

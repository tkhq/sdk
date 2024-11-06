"use server";
import crypto from "crypto";

export async function generateChallengePair() {
  const verifier = crypto.randomBytes(32).toString("base64url");
  const codeChallenge = await verifierSegmentToChallenge(verifier);
  return { verifier, codeChallenge };
}

async function verifierSegmentToChallenge(segment: string) {
  const salt = process.env.FACEBOOK_SECRET_SALT!
  const saltedVerifier = segment + salt;
  return crypto.createHash("sha256").update(saltedVerifier).digest("base64url");
}

export async function exchangeCodeForToken(clientId: any, redirectURI: any, authCode: any, verifier: any) {
  console.log(clientId)
  console.log(redirectURI)
  console.log(authCode)
  console.log(verifier)
  const response = await fetch(`https://graph.facebook.com/v11.0/oauth/access_token`, {
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

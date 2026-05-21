import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export async function GET(req: NextRequest) {
  const state = req.nextUrl.searchParams.get("state");
  if (!state) {
    return NextResponse.json(
      { error: "Missing state parameter" },
      { status: 400 },
    );
  }

  const codeVerifier = crypto.randomBytes(32).toString("base64url");
  const codeChallenge = crypto
    .createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");

  const params = new URLSearchParams({
    redirect_uri: process.env.X_REDIRECT_URI!, // should match exactly what is entered on X's developer portal
    response_type: "code",
    client_id: process.env.X_CLIENT_ID!,
    scope: "tweet.read users.read", // the minimum scope required for Turnkey to perform OAuth 2.0 authentication on behalf of an end-user
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  const response = NextResponse.redirect(
    `https://x.com/i/oauth2/authorize?${params.toString()}`,
  );
  response.cookies.set("pkce_verifier", codeVerifier, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return response;
}

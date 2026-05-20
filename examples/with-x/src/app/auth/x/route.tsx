import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const state = req.nextUrl.searchParams.get("state");
  if (!state) {
    return NextResponse.json(
      { error: "Missing state parameter" },
      { status: 400 },
    );
  }

  const params = new URLSearchParams({
    redirect_uri: process.env.X_REDIRECT_URI!, // should match exactly what is entered on X's developer portal
    response_type: "code",
    client_id: process.env.X_CLIENT_ID!,
    scope: "tweet.read users.read", // the minimum scope required for Turnkey to perform OAuth 2.0 authentication on behalf of an end-user
    state,
    code_challenge: "base64_encoded_sha256(code_verifier)", // the base64 encoded sha256 of code_verifier should be used in production
    code_challenge_method: "plain", // you should use the S256 challenge method in production
  });

  return NextResponse.redirect(
    `https://x.com/i/oauth2/authorize?${params.toString()}`,
  );
}

import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
    // your callback endpoint, use 127.0.0.1, not localhost, for testing
    const redirect_uri = `http://127.0.0.1:${process.env.PORT!}/auth/x/redirect`; // cannot be in URL Search params because it % encodes this field's value when it should not be
    const params = new URLSearchParams({
        response_type: "code",
        client_id: process.env.X_CLIENT_ID!,
        scope: "users.read", // the minimum scope required for Turnkey to perform OAuth 2.0 authentication on behalf of an end-user
        state: "random_state", // in production this value should be a random value that is check when the user is redirected back to your application from X
        code_challenge: "base64_encoded_sha256(code_verififer)", // the base64 encoded sha256 of code_verifier should be used in production
        code_challenge_method: "plain", // you should use the P256 challenge method in production
    });

    return NextResponse.redirect(
        `https://x.com/i/oauth2/authorize?redirect_uri=${redirect_uri}&${params.toString()}`
    );
}
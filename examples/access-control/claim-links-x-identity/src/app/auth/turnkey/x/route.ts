import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { generateP256KeyPair } from "@turnkey/crypto";
import { sha256 } from "@noble/hashes/sha2";
import { bytesToHex } from "@noble/hashes/utils";
import {
  assertClaimMatches,
  ClaimGateError,
  CLAIM_MISMATCH_MESSAGE,
  numericXIdFromSubject,
  decodeOidcSubject,
} from "@/lib/claim-gate";
import { claimantSignAllowPolicy } from "@/lib/policies";
import { getAllocation, turnkeyClient } from "@/lib/turnkey-server";

async function step<T>(name: string, fn: () => Promise<T>): Promise<T> {
  try {
    const out = await fn();
    console.info(`claim step ok: ${name}`);
    return out;
  } catch (e) {
    console.error(`claim step FAILED: ${name}: ${e instanceof Error ? e.message : String(e)}`);
    throw e;
  }
}

interface ClaimRequest {
  auth_code?: unknown;
  state?: unknown;
  public_key?: unknown;
}

export async function POST(req: Request) {
  const body: ClaimRequest = await req.json();
  if (typeof body.auth_code !== "string") return NextResponse.json({ error: "Missing auth_code" }, { status: 400 });
  if (typeof body.state !== "string") return NextResponse.json({ error: "Missing state" }, { status: 400 });
  if (typeof body.public_key !== "string") return NextResponse.json({ error: "Missing public_key" }, { status: 400 });
  if (!process.env.X_CLIENT_ID) return NextResponse.json({ error: "Missing X_CLIENT_ID environment variable, please set it in .env.local" }, { status: 400 });
  if (!process.env.X_REDIRECT_URI) return NextResponse.json({ error: "Missing X_REDIRECT_URI environment variable, please set it in .env.local" }, { status: 400 });

  const cookieStore = await cookies();
  const codeVerifier = cookieStore.get("pkce_verifier")?.value;
  const expectedState = cookieStore.get("pkce_state")?.value;
  const subOrgId = cookieStore.get("claim_allocation")?.value;
  if (!codeVerifier || !expectedState) return NextResponse.json({ error: "Missing PKCE verifier" }, { status: 400 });
  if (body.state !== expectedState) return NextResponse.json({ error: "Invalid state" }, { status: 400 });
  if (!subOrgId) return NextResponse.json({ error: "Missing claim allocation" }, { status: 400 });

  // Hoist the narrowed values: TypeScript does not keep narrowing of object
  // properties inside the closures below.
  const authCode: string = body.auth_code;
  const clientPublicKey: string = body.public_key;
  const redirectUri: string = process.env.X_REDIRECT_URI;

  try {
    const parent = turnkeyClient();
    const keypair = generateP256KeyPair();
    const authenticated = await step("oauth2Authenticate", () => parent.oauth2Authenticate({
      oauth2CredentialId: process.env.OAUTH2_CREDENTIAL_ID!,
      authCode,
      redirectUri,
      codeVerifier,
      bearerTokenTargetPublicKey: keypair.publicKeyUncompressed,
      nonce: bytesToHex(sha256(clientPublicKey)),
    }));
    const allocation = await getAllocation(subOrgId);
    // Log before the gate, not after: a rejection is exactly when this is needed,
    // and the claimant only ever sees the generic message.
    try {
      const payload = authenticated.oidcToken.split(".")[1]!;
      const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
      console.info(
        `claim gate: sub=${JSON.stringify(claims.sub)} allocation=${JSON.stringify(allocation.name)} claims=${Object.keys(claims).join(",")}`,
      );
    } catch (e) {
      console.info(`claim gate: could not decode OIDC token payload: ${e}`);
    }
    const numericXId = assertClaimMatches(authenticated.oidcToken, allocation.name ?? "");
    const subject = decodeOidcSubject(authenticated.oidcToken);
    const subOrg = turnkeyClient(subOrgId);

    let claimantExists = false;
    for (const user of allocation.users ?? []) {
      for (const provider of user.oauthProviders) {
        if (provider.subject === subject) claimantExists = true;
      }
    }
    if (!claimantExists) {
      // The X provider must be attached in the same call that creates the user.
      // Turnkey rejects a user with no credential at all ("user missing valid
      // credential"), so creating an empty user and calling createOauthProviders
      // afterwards can never work. This matches the with-x example, which builds
      // its root user with oauthProviders inline.
      const created = await step("createUsers", () => subOrg.createUsers({ users: [{
        userName: `X claimant ${numericXId}`,
        apiKeys: [],
        authenticators: [],
        oauthProviders: [{ providerName: "X", oidcToken: authenticated.oidcToken }],
        userTags: [],
      }] }));
      const claimantUserId = created.userIds[0];
      if (!claimantUserId) throw new Error("createUsers returned no claimant user ID");
      console.info(`claim: created claimant ${claimantUserId}`);
      await step("createPolicy(claimant allow)", () => subOrg.createPolicy(claimantSignAllowPolicy(claimantUserId)));
      await step("updateRootQuorum", () => subOrg.updateRootQuorum({ threshold: 1, userIds: [claimantUserId] }));
    }

    // oauth_login both proves the attached provider and creates the claimant's session.
    numericXIdFromSubject(subject);
    const login = await step("oauthLogin", () => parent.oauthLogin({
      organizationId: subOrgId,
      oidcToken: authenticated.oidcToken,
      publicKey: clientPublicKey,
    }));
    const response = NextResponse.json({ ok: true, session: login.session });
    response.cookies.delete("pkce_verifier");
    response.cookies.delete("pkce_state");
    response.cookies.delete("claim_allocation");
    return response;
  } catch (error: unknown) {
    if (error instanceof ClaimGateError) {
      console.warn(`claim gate refused: ${error.detail}`);
      // JSON, like every other error path here, so the client can read it uniformly.
      // The claimant gets the generic message; the reason stays server-side.
      return NextResponse.json({ error: CLAIM_MISMATCH_MESSAGE }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Error performing OAuth 2.0 authentication: ${message}` }, { status: 400 });
  }
}

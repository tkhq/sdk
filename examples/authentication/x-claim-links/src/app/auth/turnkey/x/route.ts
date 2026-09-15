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

  try {
    const parent = turnkeyClient();
    const keypair = generateP256KeyPair();
    const authenticated = await parent.oauth2Authenticate({
      oauth2CredentialId: process.env.OAUTH2_CREDENTIAL_ID!,
      authCode: body.auth_code,
      redirectUri: process.env.X_REDIRECT_URI,
      codeVerifier,
      bearerTokenTargetPublicKey: keypair.publicKeyUncompressed,
      nonce: bytesToHex(sha256(body.public_key)),
    });
    const allocation = await getAllocation(subOrgId);
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
      const created = await subOrg.createUsers({ users: [{
        userName: `X claimant ${numericXId}`,
        apiKeys: [], authenticators: [], oauthProviders: [], userTags: [],
      }] });
      const claimantUserId = created.userIds[0];
      if (!claimantUserId) throw new Error("createUsers returned no claimant user ID");
      await subOrg.createOauthProviders({
        userId: claimantUserId,
        oauthProviders: [{ providerName: "X", oidcToken: authenticated.oidcToken }],
      });
      await subOrg.createPolicy(claimantSignAllowPolicy(claimantUserId));
      await subOrg.updateRootQuorum({ threshold: 1, userIds: [claimantUserId] });
    }

    // oauth_login both proves the attached provider and creates the claimant's session.
    numericXIdFromSubject(subject);
    const login = await parent.oauthLogin({
      organizationId: subOrgId,
      oidcToken: authenticated.oidcToken,
      publicKey: body.public_key,
    });
    const response = NextResponse.json({ ok: true, session: login.session });
    response.cookies.delete("pkce_verifier");
    response.cookies.delete("pkce_state");
    response.cookies.delete("claim_allocation");
    return response;
  } catch (error: unknown) {
    if (error instanceof ClaimGateError) {
      return new NextResponse(CLAIM_MISMATCH_MESSAGE, { status: 403 });
    }
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Error performing OAuth 2.0 authentication: ${message}` }, { status: 400 });
  }
}

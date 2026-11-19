import { jwkThumbprint } from "@turnkey/sdk-server";
import type { Ed25519PublicJwk, TurnkeyBotSigner } from "@turnkey/sdk-server";
import * as Identity from "mppx/identity";
import * as Attestation from "mppx/extensions/identity/attestation";
import * as WebBotAuth from "mppx/extensions/identity/web-bot-auth";

/** A Turnkey-held Ed25519 key and its public JWK. */
export type TurnkeyKey = { key: TurnkeyBotSigner; jwk: Ed25519PublicJwk };

export const MERCHANT = "https://merchant.example";
export const AGENT_DIRECTORY = "https://agent.example";
export const ISSUER = "https://issuer.example";

/**
 * The agent signs a request with Web Bot Auth (RFC 9421). The merchant
 * verifies it against the key that the agent's directory publishes.
 * Mppx builds the signature base and the headers. Turnkey only signs bytes.
 */
export async function webBotAuth({ key, jwk }: TurnkeyKey) {
  const keyId = await jwkThumbprint(jwk);
  const merchant = WebBotAuth.Server.verifier({
    // Trust only the agent directory that this merchant registered. In
    // production, read the key from that directory's published key set.
    keyResolver: ({ signatureAgent, keyId: received }) =>
      signatureAgent === AGENT_DIRECTORY && received === keyId
        ? key.publicKey
        : undefined,
    nonceStore: Identity.Store.memory(),
  });
  const agent = Identity.Client.from([
    WebBotAuth.Client.prover({
      key,
      signatureAgent: AGENT_DIRECTORY,
      scope: [MERCHANT],
    }),
  ]);
  // Stands in for the merchant's HTTPS endpoint.
  const sent = await agent.send(
    async (input, init) => {
      const identity = await merchant.verify(new Request(input, init));
      return Response.json(identity, {
        status: identity.status === "valid" ? 200 : 401,
      });
    },
    new Request(`${MERCHANT}/catalog`),
  );
  const replay = await merchant.verify(sent.request);
  return {
    keyId,
    request: sent.request,
    result: (await sent.response.json()) as Awaited<
      ReturnType<typeof merchant.verify>
    >,
    replay,
  };
}

/**
 * An issuer whose key is in Turnkey signs an `mpp-attestation+jwt` about the
 * agent. The merchant verifies it with the issuer's JSON Web Key Set, which
 * the issuer serves at `/.well-known/jwks.json`.
 */
export async function attestation(
  issuer: TurnkeyKey,
  subject: string,
  now = Math.floor(Date.now() / 1000),
) {
  const claims = {
    iss: ISSUER,
    aud: MERCHANT,
    sub: subject,
    type: "agent",
    iat: now,
    exp: now + 300,
  };
  const token = await Attestation.sign(claims, { key: issuer.key });
  const kid = await jwkThumbprint(issuer.jwk);
  const jwks = { keys: [{ ...issuer.jwk, kid, alg: "EdDSA", use: "sig" }] };
  // Stands in for the issuer's HTTPS endpoint.
  const issuerFetch: typeof fetch = async (input) =>
    String(input instanceof Request ? input.url : input) ===
    `${ISSUER}/.well-known/jwks.json`
      ? Response.json(jwks)
      : new Response(null, { status: 404 });
  const result = await Attestation.verify(token, {
    type: "agent",
    issuer: ISSUER,
    audience: MERCHANT,
    keyResolver: Attestation.Jwks.resolver({ fetch: issuerFetch }),
  });
  return { token, kid, header: Attestation.decode(token)?.header, result };
}

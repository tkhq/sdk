import assert from "node:assert/strict";
import { test } from "node:test";
import { TurnkeySigningError, jwkThumbprint } from "@turnkey/sdk-server";
import * as Attestation from "mppx/extensions/identity/attestation";
import { attestation, webBotAuth } from "../src/flows.ts";
import { offlineKey } from "../src/offline.ts";

test("mppx Web Bot Auth signs through the Turnkey adapter and verifies", async () => {
  const agent = await offlineKey();
  const bot = await webBotAuth(agent);
  assert.equal(bot.result.status, "valid");
  // Mppx derives the keyid from the adapter's public key; it matches the
  // thumbprint that the SDK computes for the agent's directory.
  assert.equal(bot.keyId, await jwkThumbprint(agent.jwk));
  assert.match(
    bot.request.headers.get("signature-input") ?? "",
    new RegExp(`keyid="${bot.keyId}"`),
  );
  // The nonce is spent, so the same signed request cannot be replayed.
  assert.equal(bot.replay.status, "invalid");
  // Turnkey received the full RFC 9421 signature base, not a digest.
  assert.equal(agent.requests.length, 1);
  const [request] = agent.requests as {
    payload: string;
    hashFunction: string;
  }[];
  assert.equal(request!.hashFunction, "HASH_FUNCTION_NOT_APPLICABLE");
  assert.match(
    Buffer.from(request!.payload, "hex").toString("utf8"),
    /"@signature-params": /,
  );
});

test("a Turnkey-held issuer key signs an mpp attestation that verifies through its JWKS", async () => {
  const issuer = await offlineKey();
  const attested = await attestation(issuer, "agent-key-thumbprint");
  assert.equal(attested.result.status, "valid");
  assert.deepEqual(attested.header, {
    alg: "EdDSA",
    kid: await jwkThumbprint(issuer.jwk),
    typ: "mpp-attestation+jwt",
  });
  // A token for another audience does not verify.
  const other = await Attestation.verify(attested.token, {
    type: "agent",
    issuer: "https://issuer.example",
    audience: "https://other.example",
    keyResolver: () => issuer.key.publicKey,
  });
  assert.notEqual(other.status, "valid");
});

test("a Turnkey policy denial reaches the caller with its activity ID", async () => {
  const denied = await offlineKey({ deny: true });
  await assert.rejects(webBotAuth(denied), (error: unknown) => {
    assert.ok(error instanceof TurnkeySigningError);
    assert.equal(error.code, "SIGNING_REQUEST_FAILED");
    assert.equal(error.activityId, "offline-denied-activity");
    assert.equal(error.activityStatus, "ACTIVITY_STATUS_REJECTED");
    return true;
  });
});

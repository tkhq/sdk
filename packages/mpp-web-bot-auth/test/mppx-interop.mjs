import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";
import * as WebBotAuth from "mppx/extensions/identity/web-bot-auth";
import { Store } from "mppx/server";
import {
  createWebBotAuthProver,
  createTurnkeyBotSigner,
  jwkThumbprint,
} from "../dist/index.mjs";

async function fixture() {
  const keys = await crypto.subtle.generateKey("Ed25519", true, [
    "sign",
    "verify",
  ]);
  const publicKeyJwk = await crypto.subtle.exportKey("jwk", keys.publicKey);
  const prover = await createWebBotAuthProver({
    publicKeyJwk,
    sign: async (bytes) =>
      new Uint8Array(
        await crypto.subtle.sign("Ed25519", keys.privateKey, bytes),
      ),
    signatureAgent: "https://bot.example",
    scope: ["https://api.example"],
  });
  const verifier = WebBotAuth.Server.verifier({
    keyResolver: ({ signatureAgent }) =>
      signatureAgent === "https://bot.example" ? keys.publicKey : undefined,
    nonceStore: Store.memory(),
    maxAge: 60,
  });
  return { keys, publicKeyJwk, prover, verifier };
}

test("built ESM package interoperates with stock mppx 0.17.1 and rejects replay", async () => {
  const { prover, verifier } = await fixture();
  const request = new Request("https://api.example/resource");
  const initial = await prover.prove(request);
  assert.equal((await verifier.verify(initial)).status, "valid");
  assert.equal((await verifier.verify(initial)).status, "invalid");
  const retry = await prover.prove(request);
  assert.notEqual(
    retry.headers.get("Signature"),
    initial.headers.get("Signature"),
  );
  assert.equal((await verifier.verify(retry)).status, "valid");
});

test("headers are byte-identical to upstream WebBotAuth.Client.prover for the same key and context", async () => {
  const { keys, publicKeyJwk, prover } = await fixture();
  const upstream = WebBotAuth.Client.prover({
    key: keys.privateKey,
    keyId: await jwkThumbprint(publicKeyJwk),
    scope: ["https://api.example"],
    signatureAgent: "https://bot.example",
  });
  const context = { created: 1_900_000_000, nonce: "pinned-nonce-AAAAAAAAAA" };
  const ours = await prover.prove(
    new Request("https://api.example/resource"),
    context,
  );
  const theirs = await upstream.prove(
    new Request("https://api.example/resource"),
    context,
  );
  for (const name of ["Signature", "Signature-Input", "Signature-Agent"]) {
    assert.ok(ours.headers.get(name), `${name} is set`);
    assert.equal(ours.headers.get(name), theirs.headers.get(name), name);
  }

  // The same holds with a non-default label, Signature-Agent key and port.
  const custom = { label: "bot1", signatureAgentKey: "agent1" };
  const customOurs = await createWebBotAuthProver({
    publicKeyJwk,
    sign: async (bytes) =>
      new Uint8Array(
        await crypto.subtle.sign("Ed25519", keys.privateKey, bytes),
      ),
    signatureAgent: "https://bot.example",
    scope: ["https://api.example:8443"],
    ...custom,
  });
  const customTheirs = WebBotAuth.Client.prover({
    key: keys.privateKey,
    keyId: await jwkThumbprint(publicKeyJwk),
    scope: ["https://api.example:8443"],
    signatureAgent: "https://bot.example",
    ...custom,
  });
  const a = await customOurs.prove(
    new Request("https://api.example:8443/x"),
    context,
  );
  const b = await customTheirs.prove(
    new Request("https://api.example:8443/x"),
    context,
  );
  for (const name of ["Signature", "Signature-Input", "Signature-Agent"]) {
    assert.equal(a.headers.get(name), b.headers.get(name), name);
  }
});

test("mppx rejects tampered authority and directory identity", async () => {
  const { prover, verifier } = await fixture();
  const signed = await prover.prove(
    new Request("https://api.example/resource"),
  );
  assert.equal(
    (
      await verifier.verify(
        new Request("https://other.example/resource", {
          headers: signed.headers,
        }),
      )
    ).status,
    "invalid",
  );
  const headers = new Headers(signed.headers);
  headers.set("Signature-Agent", 'webbot="https://untrusted.example"');
  assert.notEqual(
    (await verifier.verify(new Request(signed, { headers }))).status,
    "valid",
  );
});

test("injected authenticated-client adapter produces an MPP-verifiable signature", async () => {
  const { keys, publicKeyJwk, verifier } = await fixture();
  const sign = createTurnkeyBotSigner({
    organizationId: "test-organization",
    signWith: "test-key-reference",
    client: {
      async signRawPayload(input) {
        assert.equal(input.hashFunction, "HASH_FUNCTION_NOT_APPLICABLE");
        assert.equal(input.encoding, "PAYLOAD_ENCODING_HEXADECIMAL");
        const bytes = await crypto.subtle.sign(
          "Ed25519",
          keys.privateKey,
          Buffer.from(input.payload, "hex"),
        );
        const signature = Buffer.from(bytes).toString("hex");
        return {
          r: signature.slice(0, 64),
          s: signature.slice(64),
          activity: { status: "ACTIVITY_STATUS_COMPLETED" },
        };
      },
    },
  });
  const prover = await createWebBotAuthProver({
    publicKeyJwk,
    sign,
    signatureAgent: "https://bot.example",
    scope: ["https://api.example"],
  });
  assert.equal(
    (
      await verifier.verify(
        await prover.prove(new Request("https://api.example/resource")),
      )
    ).status,
    "valid",
  );
});

test("built CommonJS entrypoint exposes the same public API", () => {
  const require = createRequire(import.meta.url);
  const api = require("../dist/index.js");
  assert.equal(typeof api.createWebBotAuthProver, "function");
  assert.equal(typeof api.createTurnkeyBotSigner, "function");
  assert.equal(typeof api.jwkThumbprint, "function");
  assert.equal(typeof api.ed25519PublicKeyToJwk, "function");
});

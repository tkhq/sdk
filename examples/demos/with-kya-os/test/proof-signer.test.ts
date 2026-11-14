import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { test } from "node:test";
import {
  NodeCryptoProvider,
  generateDidKeyFromBase64,
  generateRequestProof,
} from "@kya-os/mcp";
import { createPublicVerifier } from "../src/verification";

async function fixture() {
  const pair = (await webcrypto.subtle.generateKey("Ed25519", false, [
    "sign",
    "verify",
  ])) as webcrypto.CryptoKeyPair;
  const raw = Buffer.from(
    await webcrypto.subtle.exportKey("raw", pair.publicKey),
  );
  const did = generateDidKeyFromBase64(raw.toString("base64"));
  const kid = `${did}#${did.slice("did:key:".length)}`;
  return { pair, did, kid, publicKey: raw.toString("base64") };
}

test("the KYA-OS patch preserves non-extractable CryptoKey signing", async () => {
  const { pair, did, kid, publicKey } = await fixture();
  const proof = await generateRequestProof({
    identity: {
      did,
      kid,
      publicKey,
      privateKey: pair.privateKey as unknown as CryptoKey,
    },
    crypto: new NodeCryptoProvider(),
    toolName: "get_report",
    args: {},
    audience: "did:web:server.example",
  });
  const jwk = await webcrypto.subtle.exportKey("jwk", pair.publicKey);
  const result = await createPublicVerifier().verifyProof(
    proof,
    { kty: "OKP", crv: "Ed25519", x: jwk.x!, kid },
    { request: { method: "get_report", params: {} } },
    { expectedDid: did, expectedAudience: "did:web:server.example" },
  );
  assert.equal(result.valid, true);
});

test("the remote proof hook rejects an invalid signature result", async () => {
  const { did, kid, publicKey } = await fixture();
  await assert.rejects(
    generateRequestProof({
      identity: {
        did,
        kid,
        publicKey,
        privateKey: {
          algorithm: "ed25519",
          sign: async () => new Uint8Array(63),
        },
      },
      crypto: new NodeCryptoProvider(),
      toolName: "get_report",
      args: {},
      audience: "did:web:server.example",
    }),
    /Invalid remote Ed25519 proof signature/,
  );
});

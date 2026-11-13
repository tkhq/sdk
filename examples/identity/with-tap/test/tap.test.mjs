import assert from "node:assert/strict";
import { test } from "node:test";
import { createTurnkeyBotSigner } from "@turnkey/sdk-server";
import { Tap, Identity } from "../src/runtime.mjs";
import { softwareClient } from "../src/software-client.mjs";

async function fixture(intent = Tap.Constants.intents.browse, clientOverride) {
  const software = await softwareClient();
  const keyId = "merchant-registered-agent";
  const key = createTurnkeyBotSigner({
    client: clientOverride ?? software.client,
    publicKey: software.publicKey,
    organizationId: "offline-org",
    signWith: "offline-key",
  });
  const agent = Identity.Client.from([
    Tap.Client.prover({
      key,
      keyId,
      intent,
      scope: ["https://merchant.example"],
    }),
  ]);
  const nonceStore = Identity.Store.memory();
  const verifier = () =>
    Tap.Server.verifier({
      keyResolver: ({ keyId: received, algorithm }) =>
        received === keyId && algorithm === "ed25519"
          ? software.publicKey
          : undefined,
      nonceStore,
    });
  return { software, agent, verifier };
}
const capture = async () => new Response(null, { status: 204 });

test("both intent tags use the actual TAP runner and checked Turnkey adapter", async () => {
  for (const intent of [
    Tap.Constants.intents.browse,
    Tap.Constants.intents.payment,
  ]) {
    const { agent, verifier, software } = await fixture(intent);
    const { request } = await agent.send(
      capture,
      new Request("https://merchant.example/catalog"),
    );
    const result = await verifier().verify(request);
    assert.equal(result.status, "valid");
    assert.equal(result.value.intent, intent);
    assert.equal(software.calls.length, 1);
  }
});

test("fresh sends are recognized and shared nonce state rejects replay", async () => {
  const { agent, verifier } = await fixture();
  const first = await agent.send(
    capture,
    new Request("https://merchant.example/catalog"),
  );
  const second = await agent.send(
    capture,
    new Request("https://merchant.example/catalog"),
  );
  const a = await verifier().verify(first.request);
  const b = await verifier().verify(second.request);
  assert.equal(a.status, "valid");
  assert.equal(b.status, "valid");
  assert.notEqual(a.value.nonce, b.value.nonce);
  assert.equal((await verifier().verify(first.request)).status, "invalid");
});

test("the TAP signature rejects authority and path changes", async () => {
  const { agent, verifier } = await fixture();
  const { request } = await agent.send(
    capture,
    new Request("https://merchant.example/catalog"),
  );
  for (const url of [
    "https://other.example/catalog",
    "https://merchant.example/checkout",
  ])
    assert.equal(
      (await verifier().verify(new Request(url, { headers: request.headers })))
        .status,
      "invalid",
    );
  assert.equal((await verifier().verify(request)).status, "valid");
});

test("the identity runner does not call the signer outside its exact origin scope", async () => {
  const { agent, verifier, software } = await fixture();
  const { request } = await agent.send(
    capture,
    new Request("https://merchant.example.other/catalog"),
  );
  assert.equal((await verifier().verify(request)).status, "missing");
  assert.equal(software.calls.length, 0);
});

test("a wrong key or pending activity fails before the transport is called", async () => {
  const other = await softwareClient();
  for (const client of [
    other.client,
    {
      signRawPayload: async () => ({
        r: "00".repeat(32),
        s: "00".repeat(32),
        activity: { status: "ACTIVITY_STATUS_CONSENSUS_NEEDED" },
      }),
    },
  ]) {
    const { agent } = await fixture(Tap.Constants.intents.payment, client);
    let sent = false;
    await assert.rejects(
      agent.send(async () => {
        sent = true;
        return capture();
      }, new Request("https://merchant.example/checkout")),
    );
    assert.equal(sent, false);
  }
});

test("agent recognition does not bind the HTTP method, query, or body", async () => {
  const { agent, verifier } = await fixture(Tap.Constants.intents.payment);
  const { request } = await agent.send(
    capture,
    new Request("https://merchant.example/checkout?cart=one"),
  );
  const changed = new Request("https://merchant.example/checkout?cart=two", {
    method: "POST",
    headers: request.headers,
    body: "different input",
  });
  assert.equal((await verifier().verify(changed)).status, "valid");
});

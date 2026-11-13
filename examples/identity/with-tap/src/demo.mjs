import assert from "node:assert/strict";
import { createTurnkeyBotSigner } from "@turnkey/sdk-server";
import { Tap, Identity } from "./runtime.mjs";
import { softwareClient } from "./software-client.mjs";

// This run is offline. For real signing, inject an authenticated Turnkey client.
const fixture = await softwareClient();
const key = createTurnkeyBotSigner({
  client: fixture.client,
  organizationId: "offline-organization",
  signWith: "offline-agent-key",
  publicKey: fixture.publicKey,
});
const keyId = "merchant-registered-agent";
const nonceStore = Identity.Store.memory();
const merchant = Tap.Server.verifier({
  keyResolver: ({ keyId: received, algorithm }) =>
    received === keyId && algorithm === "ed25519"
      ? fixture.publicKey
      : undefined,
  nonceStore,
});
const recognized = [];
for (const intent of [
  Tap.Constants.intents.browse,
  Tap.Constants.intents.payment,
]) {
  const agent = Identity.Client.from([
    Tap.Client.prover({
      key,
      keyId,
      intent,
      scope: ["https://merchant.example"],
    }),
  ]);
  const sent = await agent.send(async (request) => {
    const identity = await merchant.verify(request);
    return Response.json({
      status: identity.status,
      intent: identity.status === "valid" ? identity.value.intent : undefined,
    });
  }, new Request("https://merchant.example/catalog"));
  const result = await sent.response.json();
  assert.equal(result.status, "valid");
  assert.equal((await merchant.verify(sent.request)).status, "invalid");
  recognized.push(result);
}
console.log(
  JSON.stringify({ mode: "offline-software-signer", recognized }, null, 2),
);

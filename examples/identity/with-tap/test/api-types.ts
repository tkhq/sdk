import { createTurnkeyBotSigner } from "@turnkey/sdk-server";
import type { TurnkeyBotSigningClient } from "@turnkey/sdk-server";
import * as Tap from "../../../../.build-artifacts/tap-mppx/dist/extensions/identity/tap/index.js";

declare const client: TurnkeyBotSigningClient;
declare const publicKey: CryptoKey;
const key = createTurnkeyBotSigner({
  client,
  publicKey,
  organizationId: "org",
  signWith: "key",
});
Tap.Client.prover({
  key,
  keyId: "registered-agent",
  intent: "payment",
  scope: ["https://merchant.example"],
});

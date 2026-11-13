import { existsSync } from "node:fs";
import {
  Turnkey,
  createTurnkeyBotSigner,
  ed25519PublicKeyToJwk,
} from "@turnkey/sdk-server";
import { attestation, webBotAuth } from "./flows.ts";
import type { TurnkeyKey } from "./flows.ts";
import { offlineKey } from "./offline.ts";

// process.loadEnvFile is in Node.js 20.12 and later; the workspace's
// @types/node predates it.
if (existsSync(".env.local"))
  (process as { loadEnvFile?: (path: string) => void }).loadEnvFile?.(
    ".env.local",
  );

const {
  API_PUBLIC_KEY,
  API_PRIVATE_KEY,
  BASE_URL = "https://api.turnkey.com",
  ORGANIZATION_ID,
  AGENT_PRIVATE_KEY_ID,
  ISSUER_PRIVATE_KEY_ID,
} = process.env;
const live = Boolean(
  API_PUBLIC_KEY && API_PRIVATE_KEY && ORGANIZATION_ID && AGENT_PRIVATE_KEY_ID,
);

async function turnkeyKey(privateKeyId: string): Promise<TurnkeyKey> {
  const client = new Turnkey({
    apiBaseUrl: BASE_URL,
    apiPublicKey: API_PUBLIC_KEY!,
    apiPrivateKey: API_PRIVATE_KEY!,
    defaultOrganizationId: ORGANIZATION_ID!,
  }).apiClient();
  const { privateKey } = await client.getPrivateKey({ privateKeyId });
  if (privateKey.curve !== "CURVE_ED25519")
    throw new Error(`${privateKeyId} is not a CURVE_ED25519 private key.`);
  const jwk = ed25519PublicKeyToJwk(privateKey.publicKey);
  const publicKey = await crypto.subtle.importKey("jwk", jwk, "Ed25519", true, [
    "verify",
  ]);
  const key = createTurnkeyBotSigner({
    client,
    organizationId: ORGANIZATION_ID!,
    signWith: privateKeyId,
    publicKey,
    onActivity: (id) => console.log(`Turnkey activity ${id} signed.`),
  });
  return { key, jwk };
}

const agent = live
  ? await turnkeyKey(AGENT_PRIVATE_KEY_ID!)
  : await offlineKey();
const issuer = live
  ? ISSUER_PRIVATE_KEY_ID
    ? await turnkeyKey(ISSUER_PRIVATE_KEY_ID)
    : agent
  : await offlineKey();

const bot = await webBotAuth(agent);
// The issuer attests the agent's Web Bot Auth key ID.
const attested = await attestation(issuer, bot.keyId);

console.log(
  JSON.stringify(
    {
      mode: live ? "turnkey" : "offline (set .env.local to sign with Turnkey)",
      webBotAuth: {
        keyId: bot.keyId,
        signatureInput: bot.request.headers.get("signature-input"),
        signatureAgent: bot.request.headers.get("signature-agent"),
        merchant: bot.result.status,
        replay: bot.replay.status,
      },
      attestation: {
        header: attested.header,
        merchant: attested.result.status,
      },
    },
    null,
    2,
  ),
);

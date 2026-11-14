import {
  createTurnkeyBotSigner,
  ed25519PublicKeyToJwk,
} from "@turnkey/sdk-server";
import type { TurnkeyBotSigningClient } from "@turnkey/sdk-server";
import type { TurnkeyKey } from "./flows.ts";

const hex = (bytes: ArrayBuffer | Uint8Array) =>
  Array.from(new Uint8Array(bytes), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");

/**
 * Stands in for an authenticated Turnkey client so the demo and tests run
 * without credentials. It accepts the same request that the adapter sends to
 * Turnkey and signs with a local Ed25519 key. `deny` simulates a policy denial.
 */
export async function offlineKey(
  options: { deny?: boolean } = {},
): Promise<TurnkeyKey & { requests: unknown[] }> {
  const pair = (await crypto.subtle.generateKey("Ed25519", true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;
  const requests: unknown[] = [];
  const client: TurnkeyBotSigningClient = {
    async signRawPayload(input) {
      requests.push(input);
      if (options.deny)
        throw Object.assign(new Error("Policy denied the request."), {
          activityId: "offline-denied-activity",
          activityStatus: "ACTIVITY_STATUS_REJECTED",
        });
      const payload = Uint8Array.from(input.payload.match(/../g) ?? [], (b) =>
        Number.parseInt(b, 16),
      );
      const signature = hex(
        await crypto.subtle.sign("Ed25519", pair.privateKey, payload),
      );
      return {
        r: signature.slice(0, 64),
        s: signature.slice(64),
        activity: {
          id: `offline-activity-${requests.length}`,
          status: "ACTIVITY_STATUS_COMPLETED",
        },
      };
    },
  };
  const jwk = ed25519PublicKeyToJwk(
    hex(await crypto.subtle.exportKey("raw", pair.publicKey)),
  );
  const publicKey = await crypto.subtle.importKey("jwk", jwk, "Ed25519", true, [
    "verify",
  ]);
  const key = createTurnkeyBotSigner({
    client,
    organizationId: "offline-organization",
    signWith: "offline-ed25519-key",
    publicKey,
  });
  return { key, jwk, requests };
}

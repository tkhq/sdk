import {
  verifyTurnkeyWebhookSignature,
  type TurnkeyWebhookVerificationKey,
  type TurnkeyWebhookVerificationResult,
} from "@turnkey/crypto";
import { serverEnv } from "@/server/env";

// Reject deliveries whose signed timestamp is more than 5 minutes off.
const MAX_TIMESTAMP_AGE_MS = 5 * 60 * 1000;

let cachedKeys: TurnkeyWebhookVerificationKey[] | null = null;

// Turnkey publishes its webhook signing keys as a JWKS. Each key's `x` is a
// base64url Ed25519 public key; the verifier wants hex.
async function fetchVerificationKeys(): Promise<
  TurnkeyWebhookVerificationKey[]
> {
  const url = `${serverEnv.apiBaseUrl}/public/v1/discovery/webhooks/jwks`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`JWKS fetch failed with status ${res.status}`);
  }
  const body: unknown = await res.json();
  const keys =
    typeof body === "object" && body !== null && "keys" in body
      ? body.keys
      : null;
  if (!Array.isArray(keys)) {
    throw new Error("JWKS response has no keys");
  }

  const parsed: TurnkeyWebhookVerificationKey[] = [];
  for (const key of keys) {
    if (
      typeof key === "object" &&
      key !== null &&
      "kid" in key &&
      typeof key.kid === "string" &&
      "x" in key &&
      typeof key.x === "string"
    ) {
      parsed.push({
        keyId: key.kid,
        publicKey: Buffer.from(key.x, "base64url").toString("hex"),
        algorithm: "ed25519",
      });
    }
  }
  return parsed;
}

// Verifies the delivery against the exact raw body. On success the result
// carries the signed event id, which is stable across retries.
export async function verifyWebhook(
  headers: Headers,
  rawBody: string,
): Promise<TurnkeyWebhookVerificationResult> {
  const verify = (keys: TurnkeyWebhookVerificationKey[]) =>
    verifyTurnkeyWebhookSignature({
      headers,
      body: rawBody,
      verificationKeys: keys,
      maxTimestampAgeMs: MAX_TIMESTAMP_AGE_MS,
    });

  cachedKeys ??= await fetchVerificationKeys();
  const result = verify(cachedKeys);

  // An unknown key id usually means Turnkey rotated keys: refetch once.
  if (!result.ok && result.reason === "missing_key") {
    cachedKeys = await fetchVerificationKeys();
    return verify(cachedKeys);
  }
  return result;
}

// Each webhook event is handled at most once per process. Turnkey retries
// with the same event id, so a retry after a slow response is dropped here.
const MAX_SEEN_EVENTS = 10_000;

declare global {
  // eslint-disable-next-line no-var
  var __depositSeenEvents: Set<string> | undefined;
}

export function firstDelivery(eventId: string): boolean {
  const seen = (globalThis.__depositSeenEvents ??= new Set());
  if (seen.has(eventId)) return false;
  seen.add(eventId);
  if (seen.size > MAX_SEEN_EVENTS) {
    const oldest = seen.values().next().value;
    if (oldest !== undefined) seen.delete(oldest);
  }
  return true;
}

export type BalanceDeposit = {
  subOrgId: string;
  address: string;
  caip2: string;
  txHash: string;
  caip19: string;
  symbol: string;
  amount: string;
};

// Pulls the fields this example uses out of a balance webhook payload.
// Returns null for anything that is not a confirmed incoming deposit.
export function parseConfirmedDeposit(value: unknown): BalanceDeposit | null {
  if (
    typeof value !== "object" ||
    value === null ||
    !("type" in value) ||
    value.type !== "balances:confirmed" ||
    !("organizationId" in value) ||
    typeof value.organizationId !== "string" ||
    !("msg" in value) ||
    typeof value.msg !== "object" ||
    value.msg === null
  ) {
    return null;
  }
  const msg = value.msg;
  if (
    !("operation" in msg) ||
    msg.operation !== "deposit" ||
    !("address" in msg) ||
    typeof msg.address !== "string" ||
    !("caip2" in msg) ||
    typeof msg.caip2 !== "string" ||
    !("txHash" in msg) ||
    typeof msg.txHash !== "string" ||
    !("asset" in msg) ||
    typeof msg.asset !== "object" ||
    msg.asset === null
  ) {
    return null;
  }
  const asset = msg.asset;
  return {
    subOrgId: value.organizationId,
    address: msg.address,
    caip2: msg.caip2,
    txHash: msg.txHash,
    caip19:
      "caip19" in asset && typeof asset.caip19 === "string" ? asset.caip19 : "",
    symbol:
      "symbol" in asset && typeof asset.symbol === "string" ? asset.symbol : "",
    amount:
      "amount" in asset && typeof asset.amount === "string" ? asset.amount : "",
  };
}

import { test, expect, describe } from "@jest/globals";
import { ed25519 } from "@noble/curves/ed25519";
import { uint8ArrayToHexString } from "@turnkey/encoding";
import {
  TurnkeyWebhookVerificationFailureReasons,
  verifyTurnkeyWebhookSignature,
  type TurnkeyWebhookVerificationKey,
} from "../";
import { buildSignedInput } from "../webhooks";

const PRIVATE_KEY = new Uint8Array([
  0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c,
  0x0d, 0x0e, 0x0f, 0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18, 0x19,
  0x1a, 0x1b, 0x1c, 0x1d, 0x1e, 0x1f,
]);

const KEY_ID = "webhook-key-1";
const EVENT_ID = "evt_123";
const TIMESTAMP_MS = 1_700_000_000_000;
const NOW_MS = TIMESTAMP_MS + 1_000;
const MAX_TIMESTAMP_AGE_MS = 5 * 60 * 1_000;
const BODY = '{"type":"activity.created","data":{"id":"act_123"}}';

describe("verifyTurnkeyWebhookSignature", () => {
  test("verifies a valid signature with plain record headers", () => {
    const fixture = createFixture({ body: BODY });

    const result = verifyTurnkeyWebhookSignature({
      headers: {
        "x-turnkey-timestamp": String(TIMESTAMP_MS),
        "X-Turnkey-Event-Id": EVENT_ID,
        "x-turnkey-signature-key-id": KEY_ID,
        "X-Turnkey-Signature-Algorithm": "ed25519",
        "x-turnkey-signature-version": "v1",
        "X-Turnkey-Signature": fixture.signature,
      },
      body: BODY,
      verificationKeys: fixture.verificationKeys,
      maxTimestampAgeMs: MAX_TIMESTAMP_AGE_MS,
      nowMs: NOW_MS,
    });

    expect(result).toEqual({
      ok: true,
      eventId: EVENT_ID,
      keyId: KEY_ID,
      timestampMs: TIMESTAMP_MS,
    });
  });

  test("verifies a valid signature with Headers and Uint8Array body", () => {
    const body = new TextEncoder().encode(BODY);
    const fixture = createFixture({ body });
    const headers = new Headers({
      "X-Turnkey-Timestamp": String(TIMESTAMP_MS),
      "X-Turnkey-Event-Id": EVENT_ID,
      "X-Turnkey-Signature-Key-Id": KEY_ID,
      "X-Turnkey-Signature-Algorithm": "ed25519",
      "X-Turnkey-Signature-Version": "v1",
      "X-Turnkey-Signature": fixture.signature,
    });

    const result = verifyTurnkeyWebhookSignature({
      headers,
      body,
      verificationKeys: fixture.verificationKeys,
      maxTimestampAgeMs: MAX_TIMESTAMP_AGE_MS,
      nowMs: NOW_MS,
    });

    expect(result.ok).toBe(true);
  });

  test("verifies a valid signature with string array header values and ArrayBuffer body", () => {
    const body = new TextEncoder().encode(BODY).buffer;
    const fixture = createFixture({ body });

    const result = verifyTurnkeyWebhookSignature({
      headers: {
        "x-turnkey-timestamp": [String(TIMESTAMP_MS)],
        "x-turnkey-event-id": [EVENT_ID],
        "x-turnkey-signature-key-id": [KEY_ID],
        "x-turnkey-signature-algorithm": ["ed25519"],
        "x-turnkey-signature-version": ["v1"],
        "x-turnkey-signature": [fixture.signature],
      },
      body,
      verificationKeys: fixture.verificationKeys,
      maxTimestampAgeMs: MAX_TIMESTAMP_AGE_MS,
      nowMs: NOW_MS,
    });

    expect(result.ok).toBe(true);
  });

  test("rejects a tampered body", () => {
    const fixture = createFixture({ body: BODY });

    const result = verifyTurnkeyWebhookSignature({
      headers: fixture.headers,
      body: `${BODY}\n`,
      verificationKeys: fixture.verificationKeys,
      maxTimestampAgeMs: MAX_TIMESTAMP_AGE_MS,
      nowMs: NOW_MS,
    });

    expect(result).toEqual({
      ok: false,
      reason: TurnkeyWebhookVerificationFailureReasons.InvalidSignature,
    });
  });

  test("rejects a tampered signature", () => {
    const fixture = createFixture({ body: BODY });

    const result = verifyTurnkeyWebhookSignature({
      headers: {
        ...fixture.headers,
        "x-turnkey-signature": `00${fixture.signature.slice(2)}`,
      },
      body: BODY,
      verificationKeys: fixture.verificationKeys,
      maxTimestampAgeMs: MAX_TIMESTAMP_AGE_MS,
      nowMs: NOW_MS,
    });

    expect(result).toEqual({
      ok: false,
      reason: TurnkeyWebhookVerificationFailureReasons.InvalidSignature,
    });
  });

  test("rejects a short signature", () => {
    const fixture = createFixture({ body: BODY });

    const result = verifyTurnkeyWebhookSignature({
      headers: {
        ...fixture.headers,
        "x-turnkey-signature": fixture.signature.slice(2),
      },
      body: BODY,
      verificationKeys: fixture.verificationKeys,
      maxTimestampAgeMs: MAX_TIMESTAMP_AGE_MS,
      nowMs: NOW_MS,
    });

    expect(result).toEqual({
      ok: false,
      reason: TurnkeyWebhookVerificationFailureReasons.InvalidSignature,
    });
  });

  test("rejects a tampered signed header", () => {
    const fixture = createFixture({ body: BODY });

    const result = verifyTurnkeyWebhookSignature({
      headers: {
        ...fixture.headers,
        "x-turnkey-event-id": "evt_tampered",
      },
      body: BODY,
      verificationKeys: fixture.verificationKeys,
      maxTimestampAgeMs: MAX_TIMESTAMP_AGE_MS,
      nowMs: NOW_MS,
    });

    expect(result).toEqual({
      ok: false,
      reason: TurnkeyWebhookVerificationFailureReasons.InvalidSignature,
    });
  });

  test("rejects a missing required header", () => {
    const fixture = createFixture({ body: BODY });
    const { "x-turnkey-signature": _signature, ...headers } = fixture.headers;

    const result = verifyTurnkeyWebhookSignature({
      headers,
      body: BODY,
      verificationKeys: fixture.verificationKeys,
      maxTimestampAgeMs: MAX_TIMESTAMP_AGE_MS,
      nowMs: NOW_MS,
    });

    expect(result).toEqual({
      ok: false,
      reason: TurnkeyWebhookVerificationFailureReasons.MissingHeader,
      headerName: "x-turnkey-signature",
    });
  });

  test("rejects a missing key", () => {
    const fixture = createFixture({ body: BODY });

    const result = verifyTurnkeyWebhookSignature({
      headers: fixture.headers,
      body: BODY,
      verificationKeys: [],
      maxTimestampAgeMs: MAX_TIMESTAMP_AGE_MS,
      nowMs: NOW_MS,
    });

    expect(result).toEqual({
      ok: false,
      reason: TurnkeyWebhookVerificationFailureReasons.MissingKey,
    });
  });

  test("rejects a short verification key", () => {
    const fixture = createFixture({ body: BODY });
    const verificationKey = fixture.verificationKeys[0]!;

    const result = verifyTurnkeyWebhookSignature({
      headers: fixture.headers,
      body: BODY,
      verificationKeys: [
        {
          ...verificationKey,
          publicKey: verificationKey.publicKey.slice(2),
        },
      ],
      maxTimestampAgeMs: MAX_TIMESTAMP_AGE_MS,
      nowMs: NOW_MS,
    });

    expect(result).toEqual({
      ok: false,
      reason: TurnkeyWebhookVerificationFailureReasons.InvalidVerificationKey,
    });
  });

  test("rejects a stale timestamp", () => {
    const fixture = createFixture({ body: BODY });

    const result = verifyTurnkeyWebhookSignature({
      headers: fixture.headers,
      body: BODY,
      verificationKeys: fixture.verificationKeys,
      maxTimestampAgeMs: MAX_TIMESTAMP_AGE_MS,
      nowMs: TIMESTAMP_MS + MAX_TIMESTAMP_AGE_MS + 1,
    });

    expect(result).toEqual({
      ok: false,
      reason: TurnkeyWebhookVerificationFailureReasons.StaleTimestamp,
    });
  });

  test("rejects an unsupported algorithm", () => {
    const fixture = createFixture({ body: BODY });

    const result = verifyTurnkeyWebhookSignature({
      headers: {
        ...fixture.headers,
        "x-turnkey-signature-algorithm": "ecdsa",
      },
      body: BODY,
      verificationKeys: fixture.verificationKeys,
      maxTimestampAgeMs: MAX_TIMESTAMP_AGE_MS,
      nowMs: NOW_MS,
    });

    expect(result).toEqual({
      ok: false,
      reason:
        TurnkeyWebhookVerificationFailureReasons.UnsupportedSignatureAlgorithm,
    });
  });

  test("rejects an unsupported version", () => {
    const fixture = createFixture({ body: BODY });

    const result = verifyTurnkeyWebhookSignature({
      headers: {
        ...fixture.headers,
        "x-turnkey-signature-version": "v2",
      },
      body: BODY,
      verificationKeys: fixture.verificationKeys,
      maxTimestampAgeMs: MAX_TIMESTAMP_AGE_MS,
      nowMs: NOW_MS,
    });

    expect(result).toEqual({
      ok: false,
      reason:
        TurnkeyWebhookVerificationFailureReasons.UnsupportedSignatureVersion,
    });
  });
});

function createFixture({ body }: { body: string | Uint8Array | ArrayBuffer }) {
  const publicKey = ed25519.getPublicKey(PRIVATE_KEY);
  const verificationKeys: TurnkeyWebhookVerificationKey[] = [
    {
      keyId: KEY_ID,
      publicKey: uint8ArrayToHexString(publicKey),
      algorithm: "ed25519",
    },
  ];
  const signedInput = buildSignedInput({
    version: "v1",
    algorithm: "ed25519",
    keyId: KEY_ID,
    timestampMs: String(TIMESTAMP_MS),
    eventId: EVENT_ID,
    body,
  });
  const signature = uint8ArrayToHexString(
    ed25519.sign(signedInput, PRIVATE_KEY),
  );

  return {
    verificationKeys,
    signature,
    headers: {
      "x-turnkey-timestamp": String(TIMESTAMP_MS),
      "x-turnkey-event-id": EVENT_ID,
      "x-turnkey-signature-key-id": KEY_ID,
      "x-turnkey-signature-algorithm": "ed25519",
      "x-turnkey-signature-version": "v1",
      "x-turnkey-signature": signature,
    },
  };
}

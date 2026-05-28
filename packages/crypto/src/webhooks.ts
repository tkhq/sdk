import { ed25519 } from "@noble/curves/ed25519";
import { uint8ArrayFromHexString } from "@turnkey/encoding";

export type TurnkeyWebhookVerificationKey = {
  keyId: string;
  publicKey: string;
  algorithm?: "ed25519";
};

export type TurnkeyWebhookHeaders =
  | Headers
  | Record<string, string | string[] | undefined>;

export type TurnkeyWebhookBody = string | Uint8Array | ArrayBuffer;

export type VerifyTurnkeyWebhookSignatureParams = {
  headers: TurnkeyWebhookHeaders;
  body: TurnkeyWebhookBody;
  verificationKeys: TurnkeyWebhookVerificationKey[];
  maxTimestampAgeMs: number;
  nowMs?: number;
};

export const TurnkeyWebhookVerificationFailureReasons = {
  InvalidMaxTimestampAge: "invalid_max_timestamp_age",
  InvalidNow: "invalid_now",
  MissingHeader: "missing_header",
  InvalidTimestamp: "invalid_timestamp",
  StaleTimestamp: "stale_timestamp",
  UnsupportedSignatureVersion: "unsupported_signature_version",
  UnsupportedSignatureAlgorithm: "unsupported_signature_algorithm",
  MissingKey: "missing_key",
  InvalidVerificationKeyAlgorithm: "invalid_verification_key_algorithm",
  InvalidVerificationKey: "invalid_verification_key",
  InvalidSignature: "invalid_signature",
} as const;

export type TurnkeyWebhookVerificationFailureReason =
  (typeof TurnkeyWebhookVerificationFailureReasons)[keyof typeof TurnkeyWebhookVerificationFailureReasons];

export type TurnkeyWebhookVerificationSuccess = {
  ok: true;
  eventId: string;
  keyId: string;
  timestampMs: number;
};

export type TurnkeyWebhookVerificationFailure = {
  ok: false;
  reason: TurnkeyWebhookVerificationFailureReason;
  headerName?: string;
};

export type TurnkeyWebhookVerificationResult =
  | TurnkeyWebhookVerificationSuccess
  | TurnkeyWebhookVerificationFailure;

const HEADER_TIMESTAMP = "x-turnkey-timestamp";
const HEADER_EVENT_ID = "x-turnkey-event-id";
const HEADER_KEY_ID = "x-turnkey-signature-key-id";
const HEADER_ALGORITHM = "x-turnkey-signature-algorithm";
const HEADER_VERSION = "x-turnkey-signature-version";
const HEADER_SIGNATURE = "x-turnkey-signature";

const SUPPORTED_VERSION = "v1";
const SUPPORTED_ALGORITHM = "ed25519";
const PUBLIC_KEY_BYTE_LENGTH = 32;
const ED25519_SIGNATURE_BYTE_LENGTH = 64;

/**
 * Verifies a Turnkey webhook signature with caller-provided Ed25519
 * verification keys.
 *
 * Pass the exact raw request body bytes Turnkey sent, the request headers, and
 * a bounded `maxTimestampAgeMs` replay window. The function returns a typed
 * failure result for invalid webhook input instead of throwing, so handlers can
 * reject expected verification failures without exception-driven control flow.
 */
export function verifyTurnkeyWebhookSignature({
  headers,
  body,
  verificationKeys,
  maxTimestampAgeMs,
  nowMs = Date.now(),
}: VerifyTurnkeyWebhookSignatureParams): TurnkeyWebhookVerificationResult {
  if (!Number.isFinite(maxTimestampAgeMs) || maxTimestampAgeMs < 0) {
    return invalid(
      TurnkeyWebhookVerificationFailureReasons.InvalidMaxTimestampAge,
    );
  }
  if (!Number.isFinite(nowMs)) {
    return invalid(TurnkeyWebhookVerificationFailureReasons.InvalidNow);
  }

  const timestampHeader = getRequiredHeader(headers, HEADER_TIMESTAMP);
  if (!timestampHeader.ok) {
    return timestampHeader;
  }
  const eventIdHeader = getRequiredHeader(headers, HEADER_EVENT_ID);
  if (!eventIdHeader.ok) {
    return eventIdHeader;
  }
  const keyIdHeader = getRequiredHeader(headers, HEADER_KEY_ID);
  if (!keyIdHeader.ok) {
    return keyIdHeader;
  }
  const algorithmHeader = getRequiredHeader(headers, HEADER_ALGORITHM);
  if (!algorithmHeader.ok) {
    return algorithmHeader;
  }
  const versionHeader = getRequiredHeader(headers, HEADER_VERSION);
  if (!versionHeader.ok) {
    return versionHeader;
  }
  const signatureHeader = getRequiredHeader(headers, HEADER_SIGNATURE);
  if (!signatureHeader.ok) {
    return signatureHeader;
  }

  const timestampMs = parseTimestampMs(timestampHeader.value);
  if (timestampMs === undefined) {
    return invalid(TurnkeyWebhookVerificationFailureReasons.InvalidTimestamp);
  }

  if (Math.abs(nowMs - timestampMs) > maxTimestampAgeMs) {
    return invalid(TurnkeyWebhookVerificationFailureReasons.StaleTimestamp);
  }

  if (versionHeader.value !== SUPPORTED_VERSION) {
    return invalid(
      TurnkeyWebhookVerificationFailureReasons.UnsupportedSignatureVersion,
    );
  }
  if (algorithmHeader.value !== SUPPORTED_ALGORITHM) {
    return invalid(
      TurnkeyWebhookVerificationFailureReasons.UnsupportedSignatureAlgorithm,
    );
  }

  const key = verificationKeys.find(
    (candidate) => candidate.keyId === keyIdHeader.value,
  );
  if (!key) {
    return invalid(TurnkeyWebhookVerificationFailureReasons.MissingKey);
  }
  const publicKeyResult = getPublicKeyBytes(key);
  if (!publicKeyResult.ok) {
    return publicKeyResult;
  }

  const signatureResult = hexToBytes(
    signatureHeader.value,
    ED25519_SIGNATURE_BYTE_LENGTH,
    TurnkeyWebhookVerificationFailureReasons.InvalidSignature,
  );
  if (!signatureResult.ok) {
    return signatureResult;
  }

  const signedInput = buildSignedInput({
    version: versionHeader.value,
    algorithm: algorithmHeader.value,
    keyId: keyIdHeader.value,
    timestampMs: timestampHeader.value,
    eventId: eventIdHeader.value,
    body,
  });

  let verified = false;
  try {
    verified = ed25519.verify(
      signatureResult.value,
      signedInput,
      publicKeyResult.value,
    );
  } catch {
    return invalid(TurnkeyWebhookVerificationFailureReasons.InvalidSignature);
  }
  if (!verified) {
    return invalid(TurnkeyWebhookVerificationFailureReasons.InvalidSignature);
  }

  return {
    ok: true,
    eventId: eventIdHeader.value,
    keyId: keyIdHeader.value,
    timestampMs,
  };
}

export function buildSignedInput({
  version,
  algorithm,
  keyId,
  timestampMs,
  eventId,
  body,
}: {
  version: string;
  algorithm: string;
  keyId: string;
  timestampMs: string;
  eventId: string;
  body: TurnkeyWebhookBody;
}): Uint8Array {
  const prefix = new TextEncoder().encode(
    `${version}.${algorithm}.${keyId}.${timestampMs}.${eventId}.`,
  );
  const bodyBytes = bodyToBytes(body);
  const signedInput = new Uint8Array(prefix.length + bodyBytes.length);
  signedInput.set(prefix, 0);
  signedInput.set(bodyBytes, prefix.length);
  return signedInput;
}

function bodyToBytes(body: TurnkeyWebhookBody): Uint8Array {
  if (typeof body === "string") {
    return new TextEncoder().encode(body);
  }
  if (body instanceof Uint8Array) {
    return body;
  }
  return new Uint8Array(body);
}

function getRequiredHeader(
  headers: TurnkeyWebhookHeaders,
  name: string,
): { ok: true; value: string } | TurnkeyWebhookVerificationFailure {
  const value = getHeader(headers, name);
  if (value === undefined || value === "") {
    return invalid(TurnkeyWebhookVerificationFailureReasons.MissingHeader, {
      headerName: name,
    });
  }
  return { ok: true, value };
}

function getHeader(
  headers: TurnkeyWebhookHeaders,
  name: string,
): string | undefined {
  if (isHeaders(headers)) {
    return headers.get(name) ?? undefined;
  }

  for (const [headerName, headerValue] of Object.entries(headers)) {
    if (headerName.toLowerCase() !== name) {
      continue;
    }
    if (Array.isArray(headerValue)) {
      return headerValue[0];
    }
    return headerValue;
  }
  return undefined;
}

function isHeaders(headers: TurnkeyWebhookHeaders): headers is Headers {
  return typeof Headers !== "undefined" && headers instanceof Headers;
}

function parseTimestampMs(timestamp: string): number | undefined {
  if (!/^[0-9]+$/.test(timestamp)) {
    return undefined;
  }
  const parsed = Number(timestamp);
  if (!Number.isSafeInteger(parsed)) {
    return undefined;
  }
  return parsed;
}

function getPublicKeyBytes(
  key: TurnkeyWebhookVerificationKey,
): { ok: true; value: Uint8Array } | TurnkeyWebhookVerificationFailure {
  if (key.algorithm !== undefined && key.algorithm !== SUPPORTED_ALGORITHM) {
    return invalid(
      TurnkeyWebhookVerificationFailureReasons.InvalidVerificationKeyAlgorithm,
    );
  }

  return hexToBytes(
    key.publicKey,
    PUBLIC_KEY_BYTE_LENGTH,
    TurnkeyWebhookVerificationFailureReasons.InvalidVerificationKey,
  );
}

function hexToBytes(
  input: string,
  expectedLength: number,
  reason: TurnkeyWebhookVerificationFailureReason,
): { ok: true; value: Uint8Array } | TurnkeyWebhookVerificationFailure {
  if (input.length !== expectedLength * 2) {
    return invalid(reason);
  }

  try {
    return {
      ok: true,
      value: uint8ArrayFromHexString(input),
    };
  } catch {
    return invalid(reason);
  }
}

function invalid(
  reason: TurnkeyWebhookVerificationFailureReason,
  details: Omit<TurnkeyWebhookVerificationFailure, "ok" | "reason"> = {},
): TurnkeyWebhookVerificationFailure {
  return { ok: false, reason, ...details };
}

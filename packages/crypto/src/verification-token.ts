/// <reference lib="dom" />
import { p256 } from "@noble/curves/p256";
import { sha256 } from "@noble/hashes/sha2";
import {
  DEFAULT_JWK_MEMBER_BYTE_LENGTH,
  decodeBase64urlToString,
  hexStringToBase64url,
  pointEncode,
  uint8ArrayFromHexString,
  uint8ArrayToHexString,
} from "@turnkey/encoding";
import type {
  v1Confirmation,
  v1JsonWebKey,
  v1SubjectIdentifier,
  v1VerificationClaims,
} from "@turnkey/sdk-types";

import {
  PRODUCTION_TLS_FETCHER_SIGN_PUBLIC_KEY,
  PRODUCTION_UMP_SIGN_PUBLIC_KEY,
} from "./constants";
export const VERIFICATION_TOKEN_TYPE_V1 =
  "application/vnd.turnkey.verification-v1+jwt";
export const AUTH_METHOD_WALLET = "WALLET";
export const AUTH_METHOD_EMAIL_OTP = "email_otp";
export const AUTH_METHOD_SMS_OTP = "sms_otp";
export const NIL_SESSION_PROFILE_SCOPE =
  "session_profile:00000000-0000-0000-0000-000000000000";

const ES256_ALG = "ES256";
const ISSUER_PREFIX = "https://id.turnkey.com/t/";
const AUDIENCE_PREFIX = "urn:turnkey:org:";
const SUBORGS_SUFFIX = ":suborgs";
const WALLET_FORMAT = "wallet";
const EMAIL_FORMAT = "email";
const PHONE_NUMBER_FORMAT = "phone_number";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COMPACT_SIGNATURE_LENGTH = 64;

export type VerifyVerificationTokenOptions = {
  /**
   * Hex P-256 public key (or keys) used to verify the enclave signature.
   * Defaults to the production TLS fetcher and UMP signing keys; `kid`
   * selects which one signed the token.
   */
  dangerouslyOverrideSignerPublicKey?: string | readonly string[];
  /** Compressed or uncompressed hex of the stamp's ephemeral P-256 public key. */
  stampPublicKey?: string;
  /** Organization that is presenting the token. */
  targetOrganizationId?: string;
  /** Parent organization, required when `aud` is `urn:turnkey:org:<parent>:suborgs`. */
  parentOrganizationId?: string;
  /** Clock used for expiry, in milliseconds since the epoch. Defaults to `Date.now()`. */
  nowMs?: number;
};

type VerificationAudience =
  | { type: "organization"; organizationId: string }
  | { type: "suborgs"; parentOrganizationId: string };

type VerificationTokenHeader = {
  alg: string;
  typ: string;
  kid: string;
};

/**
 * Enclave-signed verification JWT
 *
 * `parse` checks compact-JWT structure, header, and claims. Signature, expiry, audience,
 * and stamp binding are checked by `verify`.
 */
export class VerificationToken {
  readonly claims: v1VerificationClaims;
  readonly header: VerificationTokenHeader;

  private readonly signatureBase: string;
  private readonly signature: Uint8Array;
  private readonly ephemeralPublicKeyHex: string;
  private readonly audience: VerificationAudience;

  private constructor(params: {
    claims: v1VerificationClaims;
    header: VerificationTokenHeader;
    signatureBase: string;
    signature: Uint8Array;
    ephemeralPublicKeyHex: string;
    audience: VerificationAudience;
  }) {
    this.claims = params.claims;
    this.header = params.header;
    this.signatureBase = params.signatureBase;
    this.signature = params.signature;
    this.ephemeralPublicKeyHex = params.ephemeralPublicKeyHex;
    this.audience = params.audience;
  }

  /** Decodes a compact JWT. Does not check the enclave signature. */
  static parse(token: string): VerificationToken {
    const parts = token.split(".");
    if (parts.length !== 3) {
      throw new Error(
        `invalid verification token: found ${parts.length} sections, expected 3`,
      );
    }
    const [encodedHeader, encodedClaims, encodedSignature] = parts as [
      string,
      string,
      string,
    ];

    const header = parseHeader(encodedHeader);
    const wire = parseJson(encodedClaims, "claims") as Record<string, unknown>;
    const claims = claimsFromWire(wire);
    const ephemeralPublicKeyHex = compressedHexFromP256Jwk(claims.cnf.jwk);
    if (claims.nonce !== publicKeyNonce(ephemeralPublicKeyHex)) {
      throw new Error(
        "verification token nonce does not match the confirmation key",
      );
    }

    const signature = base64UrlToBytes(encodedSignature);
    if (signature.length !== COMPACT_SIGNATURE_LENGTH) {
      throw new Error("verification token signature length is invalid");
    }

    return new VerificationToken({
      claims,
      header,
      signatureBase: `${encodedHeader}.${encodedClaims}`,
      signature,
      ephemeralPublicKeyHex,
      audience: audienceFromWire(claims.aud),
    });
  }

  /** Unique identifier for this verification (`jti`). */
  get jti(): string {
    return this.claims.jti;
  }

  /** `hex(sha256(ephemeralPublicKey))`. */
  get nonce(): string {
    return this.claims.nonce;
  }

  /** Authentication method that was verified. */
  get authMethod(): string {
    return this.claims.auth_method;
  }

  /** Compressed lowercase hex of the ephemeral P-256 key in `cnf.jwk`. */
  get ephemeralPublicKey(): string {
    return this.ephemeralPublicKeyHex;
  }

  /** Subject of the verified authentication method. */
  get subId(): v1SubjectIdentifier {
    return this.claims.sub_id;
  }

  toJSON(): v1VerificationClaims {
    return this.claims;
  }

  /**
   * Checks the enclave signature and expiry. Optionally checks audience and
   * that `cnf` / `nonce` match the stamp's ephemeral public key.
   */
  verify(options: VerifyVerificationTokenOptions = {}): this {
    this.verifySignature(options.dangerouslyOverrideSignerPublicKey);
    this.verifyExpiry(options.nowMs);
    if (options.targetOrganizationId !== undefined) {
      this.verifyAudience(
        options.targetOrganizationId,
        options.parentOrganizationId,
      );
    }
    if (options.stampPublicKey !== undefined) {
      this.verifyEphemeralKey(options.stampPublicKey);
    }
    return this;
  }

  /** Checks the ES256 signature against the production enclave key identified by `kid` or the overridden key. */
  verifySignature(signerPublicKeyHex?: string | readonly string[]): this {
    const signerHex = signerForKid(this.header.kid, signerPublicKeyHex);
    const publicKey = uint8ArrayFromHexString(signerHex);
    const msgDigest = sha256(new TextEncoder().encode(this.signatureBase));
    if (!p256.verify(this.signature, msgDigest, publicKey)) {
      throw new Error("invalid enclave signature on verification token");
    }
    return this;
  }

  /** Checks that `nowMs` is not past `exp` (unix seconds). */
  verifyExpiry(nowMs: number = Date.now()): this {
    const expSeconds = Number(this.claims.exp);
    if (!Number.isFinite(expSeconds)) {
      throw new Error("verification token expiration is invalid");
    }
    const expMs = expSeconds * 1000;
    if (nowMs > expMs) {
      throw new Error("verification token is expired");
    }
    return this;
  }

  /**
   * Checks `aud` against the target organization and optional parent.
   * `urn:turnkey:org:<id>` matches that organization only.
   * `urn:turnkey:org:<parent>:suborgs` matches sub-organizations of that parent,
   * not the parent itself.
   */
  verifyAudience(
    targetOrganizationId: string,
    parentOrganizationId?: string,
  ): this {
    const matches =
      this.audience.type === "organization"
        ? this.audience.organizationId === targetOrganizationId
        : parentOrganizationId === this.audience.parentOrganizationId &&
          targetOrganizationId !== this.audience.parentOrganizationId;
    if (!matches) {
      throw new Error(
        "verification token audience does not match the organization",
      );
    }
    return this;
  }

  /** Checks that `cnf` and `nonce` are the stamp's ephemeral key. */
  verifyEphemeralKey(stampPublicKey: string): this {
    const stampCompressed = compressedHexFromPublicKeyHex(stampPublicKey);
    if (stampCompressed !== this.ephemeralPublicKeyHex) {
      throw new Error(
        "verification token confirmation key does not match the stamp public key",
      );
    }
    if (publicKeyNonce(stampCompressed) !== this.nonce) {
      throw new Error(
        "verification token nonce does not match the stamp public key",
      );
    }
    return this;
  }
}

/**
 * `hex(sha256(publicKey))` of the UTF-8 hex string. This is the nonce an
 * ephemeral P-256 key commits to in a verification token.
 */
export function publicKeyNonce(publicKey: string): string {
  return uint8ArrayToHexString(sha256(new TextEncoder().encode(publicKey)));
}

function trustedVerificationTokenEnclaveSigners(): readonly string[] {
  return [
    PRODUCTION_TLS_FETCHER_SIGN_PUBLIC_KEY,
    PRODUCTION_UMP_SIGN_PUBLIC_KEY,
  ];
}

function signerForKid(
  kid: string,
  override?: string | readonly string[],
): string {
  const signers =
    override === undefined
      ? trustedVerificationTokenEnclaveSigners()
      : typeof override === "string"
        ? [override]
        : override;
  const signerHex = signers.find(
    (hex) => jwkThumbprintFromPublicKeyHex(hex) === kid,
  );
  if (!signerHex) {
    throw new Error(
      "verification token kid does not match a trusted enclave signing key",
    );
  }
  return signerHex;
}

function parseHeader(encodedHeader: string): VerificationTokenHeader {
  const header = parseJson(encodedHeader, "header") as Record<string, unknown>;
  if (header.alg !== ES256_ALG) {
    throw new Error("unsupported verification token algorithm");
  }
  if (header.typ !== VERIFICATION_TOKEN_TYPE_V1) {
    throw new Error("unsupported verification token type");
  }
  if (typeof header.kid !== "string" || header.kid.length === 0) {
    throw new Error("verification token kid is missing");
  }
  return {
    alg: header.alg,
    typ: header.typ,
    kid: header.kid,
  };
}

function claimsFromWire(wire: Record<string, unknown>): v1VerificationClaims {
  const jti = requiredString(wire.jti, "jti");
  if (!UUID_RE.test(jti)) {
    throw new Error("verification token jti is invalid");
  }
  const iss = requiredString(wire.iss, "iss");
  const issuingOrganizationId = iss.startsWith(ISSUER_PREFIX)
    ? iss.slice(ISSUER_PREFIX.length)
    : "";
  if (!validOrganizationId(issuingOrganizationId)) {
    throw new Error("verification token issuer is invalid");
  }
  const aud = requiredString(wire.aud, "aud");
  audienceFromWire(aud);
  const nonce = requiredString(wire.nonce, "nonce");
  const authMethod = requiredString(wire.auth_method, "auth_method");
  const scope = requiredString(wire.scope, "scope");
  parseScope(scope);
  const iat = requiredInt64String(wire.iat, "iat");
  const exp = requiredInt64String(wire.exp, "exp");
  if (BigInt(exp) <= BigInt(iat)) {
    throw new Error("verification token expiration is invalid");
  }
  const cnf = confirmationFromWire(wire.cnf);
  const subId = subjectFromWire(authMethod, wire.sub_id);
  return {
    jti,
    iss,
    aud,
    cnf,
    nonce,
    auth_method: authMethod,
    sub_id: subId,
    scope,
    iat,
    exp,
  };
}

function confirmationFromWire(value: unknown): v1Confirmation {
  if (typeof value !== "object" || value === null) {
    throw new Error("verification token confirmation key is invalid");
  }
  const cnf = value as { jwk?: unknown };
  return { jwk: jsonWebKeyFromWire(cnf.jwk) };
}

function jsonWebKeyFromWire(value: unknown): v1JsonWebKey {
  if (typeof value !== "object" || value === null) {
    throw new Error("verification token confirmation key is invalid");
  }
  const jwk = value as Partial<v1JsonWebKey>;
  if (
    typeof jwk.kty !== "string" ||
    typeof jwk.crv !== "string" ||
    typeof jwk.x !== "string" ||
    typeof jwk.y !== "string"
  ) {
    throw new Error("verification token confirmation key is invalid");
  }
  return { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y };
}

function subjectFromWire(
  authMethod: string,
  value: unknown,
): v1SubjectIdentifier {
  if (typeof value !== "object" || value === null) {
    throw new Error("verification token subject is incomplete");
  }
  const subId = value as v1SubjectIdentifier;
  if (typeof subId.format !== "string" || subId.format.length === 0) {
    throw new Error("unsupported verification token subject format");
  }
  switch (subId.format) {
    case EMAIL_FORMAT: {
      if (authMethod !== AUTH_METHOD_EMAIL_OTP) {
        throw new Error(
          "verification token auth method does not match the subject",
        );
      }
      if (!subId.email) {
        throw new Error("verification token subject is missing email");
      }
      break;
    }
    case PHONE_NUMBER_FORMAT: {
      if (authMethod !== AUTH_METHOD_SMS_OTP) {
        throw new Error(
          "verification token auth method does not match the subject",
        );
      }
      if (!subId.phone_number) {
        throw new Error("verification token subject is missing phone_number");
      }
      break;
    }
    case WALLET_FORMAT: {
      if (authMethod !== AUTH_METHOD_WALLET) {
        throw new Error(
          "verification token auth method does not match the subject",
        );
      }
      if (!subId.type) {
        throw new Error("verification token subject is missing type");
      }
      if (!subId.address) {
        throw new Error("verification token subject is missing address");
      }
      if (!subId.domain) {
        throw new Error("verification token subject is missing domain");
      }
      break;
    }
    default:
      throw new Error("unsupported verification token subject format");
  }
  return subId;
}

function audienceFromWire(aud: string): VerificationAudience {
  if (!aud.startsWith(AUDIENCE_PREFIX)) {
    throw new Error("verification token audience is invalid");
  }
  const rest = aud.slice(AUDIENCE_PREFIX.length);
  if (rest.endsWith(SUBORGS_SUFFIX)) {
    const id = rest.slice(0, -SUBORGS_SUFFIX.length);
    if (!validOrganizationId(id)) {
      throw new Error("verification token audience is invalid");
    }
    return { type: "suborgs", parentOrganizationId: id };
  }
  if (!validOrganizationId(rest)) {
    throw new Error("verification token audience is invalid");
  }
  return { type: "organization", organizationId: rest };
}

function parseScope(scope: string): void {
  if (!scope.startsWith("session_profile:")) {
    throw new Error("verification token scope is invalid");
  }
  const id = scope.slice("session_profile:".length);
  if (!UUID_RE.test(id)) {
    throw new Error("verification token scope is invalid");
  }
}

function validOrganizationId(id: string): boolean {
  return id.length > 0 && !id.includes(":") && !id.includes("/");
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`verification token missing required '${field}' claim`);
  }
  return value;
}

function requiredInt64String(value: unknown, field: string): string {
  if (typeof value === "number" && Number.isInteger(value)) {
    return String(value);
  }
  if (typeof value === "string" && /^-?\d+$/.test(value)) {
    return value;
  }
  throw new Error(`verification token has an invalid '${field}' claim`);
}

function compressedHexFromP256Jwk(jwk: v1JsonWebKey): string {
  if (jwk.kty !== "EC" || jwk.crv !== "P-256") {
    throw new Error("verification token confirmation key is invalid");
  }
  const x = base64UrlToBytes(jwk.x);
  const y = base64UrlToBytes(jwk.y);
  if (
    x.length !== DEFAULT_JWK_MEMBER_BYTE_LENGTH ||
    y.length !== DEFAULT_JWK_MEMBER_BYTE_LENGTH
  ) {
    throw new Error("verification token confirmation key is invalid");
  }
  const uncompressed = new Uint8Array(65);
  uncompressed[0] = 0x04;
  uncompressed.set(x, 1);
  uncompressed.set(y, 33);
  try {
    p256.ProjectivePoint.fromHex(uncompressed);
  } catch {
    throw new Error("verification token confirmation key is invalid");
  }
  return uint8ArrayToHexString(pointEncode(uncompressed));
}

function compressedHexFromPublicKeyHex(hex: string): string {
  const lower = hex.trim().replace(/^0x/i, "").toLowerCase();
  const bytes = uint8ArrayFromHexString(lower);
  if (bytes.length === 65 && bytes[0] === 0x04) {
    p256.ProjectivePoint.fromHex(bytes);
    return uint8ArrayToHexString(pointEncode(bytes));
  }
  if (bytes.length === 33) {
    p256.ProjectivePoint.fromHex(bytes);
    return lower;
  }
  throw new Error("verification token key is invalid");
}

function jwkFromPublicKeyHex(hex: string): v1JsonWebKey {
  const lower = hex.trim().replace(/^0x/i, "").toLowerCase();
  let bytes = uint8ArrayFromHexString(lower);
  if (bytes.length === 33) {
    bytes = p256.ProjectivePoint.fromHex(bytes).toRawBytes(false);
  }
  if (bytes.length !== 65 || bytes[0] !== 0x04) {
    throw new Error("verification token key is invalid");
  }
  return {
    kty: "EC",
    crv: "P-256",
    x: hexStringToBase64url(
      uint8ArrayToHexString(bytes.subarray(1, 33)),
      DEFAULT_JWK_MEMBER_BYTE_LENGTH,
    ),
    y: hexStringToBase64url(
      uint8ArrayToHexString(bytes.subarray(33, 65)),
      DEFAULT_JWK_MEMBER_BYTE_LENGTH,
    ),
  };
}

function jwkThumbprintFromPublicKeyHex(hex: string): string {
  const jwk = jwkFromPublicKeyHex(hex);
  const canonical = `{"crv":"P-256","kty":"EC","x":"${jwk.x}","y":"${jwk.y}"}`;
  return bytesToBase64Url(sha256(new TextEncoder().encode(canonical)));
}

function parseJson(encoded: string, part: string): unknown {
  let bytes: Uint8Array;
  try {
    bytes = base64UrlToBytes(encoded);
  } catch {
    throw new Error(`verification token ${part} is not base64url`);
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new Error(`verification token ${part} is invalid`);
  }
}

function base64UrlToBytes(b64url: string): Uint8Array {
  return Uint8Array.from(decodeBase64urlToString(b64url), (c) =>
    c.charCodeAt(0),
  );
}

function bytesToBase64Url(bytes: Uint8Array): string {
  return hexStringToBase64url(uint8ArrayToHexString(bytes));
}

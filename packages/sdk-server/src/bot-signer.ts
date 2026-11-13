import type { webcrypto } from "node:crypto";
import { uncompressRawPublicKey } from "@turnkey/crypto";

type HashFunction = "HASH_FUNCTION_NOT_APPLICABLE" | "HASH_FUNCTION_SHA256";
type SigningClient<Hash extends HashFunction> = {
  signRawPayload(input: {
    organizationId: string;
    signWith: string;
    payload: string;
    encoding: "PAYLOAD_ENCODING_HEXADECIMAL";
    hashFunction: Hash;
  }): Promise<{
    r: string;
    s: string;
    activity?: { id?: string; status?: string };
  }>;
};

type SignerOptions<Client> = {
  client: Client;
  organizationId: string;
  signWith: string;
  publicKey: webcrypto.CryptoKey;
  /** Called with the activity ID after a checked, successful signature. Failed
   * requests report the activity ID on the thrown `TurnkeySigningError`. */
  onActivity?: (id: string) => void;
};

/** Why a remote signing request failed. */
export type TurnkeySigningErrorCode =
  /** The client threw, for example on a network, authentication or policy error. */
  | "SIGNING_REQUEST_FAILED"
  /** The activity ended in a status other than completed, such as consensus
   * needed, rejected or failed. */
  | "ACTIVITY_NOT_COMPLETED"
  /** The result did not contain a well-formed signature. */
  | "INVALID_SIGNATURE"
  /** The signature does not verify against the configured public key. */
  | "SIGNATURE_MISMATCH";

/**
 * A failed remote signing request. The message and `code` do not include
 * upstream error text. `activityId` and `activityStatus` are set when Turnkey
 * reported them, so callers can audit or alert on denied requests. `cause` is
 * the error that the client threw, if any.
 */
export class TurnkeySigningError extends Error {
  readonly code: TurnkeySigningErrorCode;
  readonly activityId: string | undefined;
  readonly activityStatus: string | undefined;
  readonly cause: unknown;

  constructor(
    message: string,
    details: {
      code: TurnkeySigningErrorCode;
      activityId?: string | undefined;
      activityStatus?: string | undefined;
      cause?: unknown;
    },
  ) {
    super(message);
    this.name = "TurnkeySigningError";
    this.code = details.code;
    this.activityId = details.activityId;
    this.activityStatus = details.activityStatus;
    this.cause = details.cause;
  }
}

/** An authenticated client that returns a completed Ed25519 signing result. */
export type TurnkeyBotSigningClient =
  SigningClient<"HASH_FUNCTION_NOT_APPLICABLE">;

/** An authenticated client that hashes the supplied bytes once with SHA-256. */
export type TurnkeyEs256SigningClient = SigningClient<"HASH_FUNCTION_SHA256">;

/** Signs `payload` and resolves with the raw signature. `payload` is the
 * complete message, such as an RFC 9421 signature base or a JWS signing input,
 * never a precomputed digest. Matches mppx's identity `Signer`. */
type SignFunction = (parameters: {
  readonly payload: Uint8Array;
}) => Promise<Uint8Array>;

/** A remote Ed25519 key for HTTP message signature provers and attestation
 * issuers. Assignable to mppx's identity `Signer`. */
export type TurnkeyBotSigner = {
  algorithm: "ed25519";
  publicKey: webcrypto.CryptoKey;
  sign: SignFunction;
};

/** A remote ES256 key. The algorithm label is RFC 9421's HTTP signature name.
 * Signatures are 64-byte IEEE P1363 r || s, also used by JOSE ES256. */
export type TurnkeyEs256Signer = {
  algorithm: "ecdsa-p256-sha256";
  publicKey: webcrypto.CryptoKey;
  sign: SignFunction;
};

/**
 * Signs exact bytes with Ed25519 and checks the signature before returning it.
 *
 * Pass the complete message, not a digest. Ed25519 (RFC 8032, PureEdDSA)
 * hashes the message inside the algorithm, so Turnkey signs the bytes as given
 * with `HASH_FUNCTION_NOT_APPLICABLE`. Signing a digest instead produces a
 * signature over the digest that verifiers of the original message reject.
 */
export function createTurnkeyBotSigner(
  options: SignerOptions<TurnkeyBotSigningClient>,
): TurnkeyBotSigner {
  return createCheckedSigner(
    options,
    "ed25519",
    "HASH_FUNCTION_NOT_APPLICABLE",
  );
}

/** Sends the original bytes for SHA-256 hashing and P-256 signing in Turnkey.
 * The caller supplies the message or JWS signing input, not a precomputed digest. */
export function createTurnkeyEs256Signer(
  options: SignerOptions<TurnkeyEs256SigningClient>,
): TurnkeyEs256Signer {
  return createCheckedSigner(
    options,
    "ecdsa-p256-sha256",
    "HASH_FUNCTION_SHA256",
  );
}

function createCheckedSigner<
  Algorithm extends "ed25519" | "ecdsa-p256-sha256",
  Hash extends HashFunction,
>(
  {
    client,
    organizationId,
    signWith,
    publicKey,
    onActivity,
  }: SignerOptions<SigningClient<Hash>>,
  algorithm: Algorithm,
  hashFunction: Hash,
): {
  algorithm: Algorithm;
  publicKey: webcrypto.CryptoKey;
  sign: SignFunction;
} {
  if (!organizationId || !signWith)
    throw new Error(
      "A Turnkey organization and bot key reference are required.",
    );
  const es256 = algorithm === "ecdsa-p256-sha256";
  const keyAlgorithm = publicKey.algorithm as {
    name: string;
    namedCurve?: string;
  };
  if (
    publicKey.type !== "public" ||
    !publicKey.usages.includes("verify") ||
    (es256
      ? keyAlgorithm.name !== "ECDSA" || keyAlgorithm.namedCurve !== "P-256"
      : keyAlgorithm.name !== "Ed25519")
  )
    throw new Error(
      es256
        ? "An ECDSA P-256 public verification key is required."
        : "An Ed25519 public verification key is required.",
    );
  if (!globalThis.crypto?.subtle)
    throw new Error("Web Crypto is required to verify bot signatures.");
  return {
    algorithm,
    publicKey,
    async sign({ payload: bytes }) {
      const payload = Uint8Array.from(bytes);
      let result: Awaited<ReturnType<SigningClient<Hash>["signRawPayload"]>>;
      try {
        result = await client.signRawPayload({
          organizationId,
          signWith,
          payload: Array.from(payload, (byte) =>
            byte.toString(16).padStart(2, "0"),
          ).join(""),
          encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
          hashFunction,
        });
      } catch (error) {
        const upstream = (error ?? {}) as {
          activityId?: unknown;
          activityStatus?: unknown;
        };
        throw new TurnkeySigningError(
          "Turnkey did not complete the bot signing activity.",
          {
            code: "SIGNING_REQUEST_FAILED",
            activityId: stringOrUndefined(upstream.activityId),
            activityStatus: stringOrUndefined(upstream.activityStatus),
            cause: error,
          },
        );
      }
      const activityId = stringOrUndefined(result?.activity?.id);
      const activityStatus = stringOrUndefined(result?.activity?.status);
      if (activityStatus !== "ACTIVITY_STATUS_COMPLETED")
        throw new TurnkeySigningError(
          "Turnkey did not complete the bot signing activity.",
          { code: "ACTIVITY_NOT_COMPLETED", activityId, activityStatus },
        );
      // ECDSA scalars may omit leading zeroes. Ed25519 halves are fixed bytes.
      const partPattern = es256 ? /^[a-fA-F0-9]{1,64}$/ : /^[a-fA-F0-9]{64}$/;
      if (
        typeof result.r !== "string" ||
        typeof result.s !== "string" ||
        !partPattern.test(result.r) ||
        !partPattern.test(result.s)
      )
        throw new TurnkeySigningError(
          `Turnkey returned an invalid ${es256 ? "ES256" : "Ed25519"} signature.`,
          { code: "INVALID_SIGNATURE", activityId, activityStatus },
        );
      const signature = Uint8Array.from(
        (result.r.padStart(64, "0") + result.s.padStart(64, "0")).match(/../g)!,
        (byte) => Number.parseInt(byte, 16),
      );
      if (
        !(await globalThis.crypto.subtle.verify(
          es256 ? { name: "ECDSA", hash: "SHA-256" } : "Ed25519",
          publicKey,
          signature,
          payload,
        ))
      )
        throw new TurnkeySigningError(
          "The bot signature does not match the configured public key.",
          { code: "SIGNATURE_MISMATCH", activityId, activityStatus },
        );
      if (activityId) onActivity?.(activityId);
      return signature;
    },
  };
}

/** A public Ed25519 JSON Web Key (RFC 8037). */
export type Ed25519PublicJwk = { kty: "OKP"; crv: "Ed25519"; x: string };

/** A public P-256 JSON Web Key for ES256 (RFC 7518). */
export type P256PublicJwk = { kty: "EC"; crv: "P-256"; x: string; y: string };

const ED25519_PUBLIC_KEY_HEX = /^[0-9a-fA-F]{64}$/;
const BASE64URL_32_BYTES = /^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/;

/**
 * Converts a 32-byte Ed25519 public key in hex (optional `0x` prefix), as
 * Turnkey returns it, into a public JWK. Import the JWK with Web Crypto to get
 * the `publicKey` that `createTurnkeyBotSigner` needs.
 */
export function ed25519PublicKeyToJwk(hex: string): Ed25519PublicJwk {
  const stripped = typeof hex === "string" ? hex.replace(/^0x/, "") : "";
  if (!ED25519_PUBLIC_KEY_HEX.test(stripped))
    throw new TypeError("An Ed25519 public key must be 32 bytes of hex.");
  const bytes = Uint8Array.from(stripped.match(/../g)!, (byte) =>
    Number.parseInt(byte, 16),
  );
  return { kty: "OKP", crv: "Ed25519", x: base64url(bytes) };
}

/** Converts a compressed or uncompressed SEC1 P-256 point in hex to a public
 * JWK. Accepts an optional `0x` prefix and rejects invalid curve points. */
export function p256PublicKeyToJwk(hex: string): P256PublicJwk {
  const stripped = typeof hex === "string" ? hex.replace(/^0x/, "") : "";
  if (!/^(?:0[23][0-9a-fA-F]{64}|04[0-9a-fA-F]{128})$/.test(stripped))
    throw new TypeError(
      "A P-256 public key must be a compressed or uncompressed SEC1 point in hex.",
    );
  const bytes = Uint8Array.from(stripped.match(/../g)!, (byte) =>
    Number.parseInt(byte, 16),
  );
  const compressed =
    bytes.length === 33
      ? bytes
      : new Uint8Array([2 | (bytes[64]! & 1), ...bytes.subarray(1, 33)]);
  let point: Uint8Array;
  try {
    point = uncompressRawPublicKey(compressed, "CURVE_P256");
  } catch {
    throw new TypeError("A valid P-256 public curve point is required.");
  }
  if (bytes.length === 65 && !bytes.every((byte, i) => byte === point[i]))
    throw new TypeError("A valid P-256 public curve point is required.");
  return {
    kty: "EC",
    crv: "P-256",
    x: base64url(point.subarray(1, 33)),
    y: base64url(point.subarray(33)),
  };
}

/**
 * Computes the RFC 7638 SHA-256 thumbprint of a public Ed25519 or P-256 JWK, encoded as
 * base64url. HTTP message signature provers commonly use it as the key ID.
 */
export async function jwkThumbprint(
  jwk: Ed25519PublicJwk | P256PublicJwk,
): Promise<string> {
  if (
    typeof jwk !== "object" ||
    jwk === null ||
    "d" in jwk ||
    typeof jwk.x !== "string" ||
    !BASE64URL_32_BYTES.test(jwk.x) ||
    !(
      (jwk.kty === "OKP" && jwk.crv === "Ed25519") ||
      (jwk.kty === "EC" &&
        jwk.crv === "P-256" &&
        typeof jwk.y === "string" &&
        BASE64URL_32_BYTES.test(jwk.y))
    )
  )
    throw new TypeError("A public Ed25519 or P-256 JWK is required.");
  if (!globalThis.crypto?.subtle)
    throw new Error("Web Crypto is required to compute a JWK thumbprint.");
  // RFC 7638 section 3.2: required members only, in lexicographic order.
  const canonical = JSON.stringify(
    jwk.kty === "EC"
      ? { crv: jwk.crv, kty: jwk.kty, x: jwk.x, y: jwk.y }
      : { crv: jwk.crv, kty: jwk.kty, x: jwk.x },
  );
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonical),
  );
  return base64url(new Uint8Array(digest));
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

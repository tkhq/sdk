import {
  hexStringToBase64url,
  uint8ArrayFromHexString,
  uint8ArrayToHexString,
} from "@turnkey/encoding";

/**
 * A remote signer for mppx RFC 9421 identity provers.
 *
 * Structurally identical to `Signer` in `mppx/extensions/identity`, so this
 * package does not depend on mppx. Pass it as `key` to
 * `WebBotAuth.Client.prover` or `Tap.Client.prover`.
 */
export type Signer = {
  readonly algorithm: "ed25519" | "rsa-pss-sha512";
  readonly sign: (data: Uint8Array) => Promise<Uint8Array>;
};

/** Input that `createTurnkeySigner` sends to `signRawPayload`. */
export type SignRawPayloadInput = {
  organizationId: string;
  signWith: string;
  payload: string;
  encoding: "PAYLOAD_ENCODING_HEXADECIMAL";
  hashFunction: "HASH_FUNCTION_NOT_APPLICABLE";
};

/** The fields of a `signRawPayload` result that `createTurnkeySigner` reads. */
export type SignRawPayloadResult = {
  r: string;
  s: string;
  activity?: { id?: string; status?: string };
};

/**
 * A Turnkey client that can sign a raw payload and return top-level `r`/`s`.
 *
 * The `@turnkey/sdk-server` and `@turnkey/core` clients satisfy this type. The
 * raw `@turnkey/http` `TurnkeyClient` does not, because it nests the signature
 * inside the activity result.
 */
export type TurnkeyRawSigner = {
  signRawPayload(input: SignRawPayloadInput): Promise<SignRawPayloadResult>;
};

/** Configuration for `createTurnkeySigner`. */
export type TurnkeySignerConfig = {
  /** An authenticated Turnkey client. */
  client: TurnkeyRawSigner;
  /** The organization that owns the signing key. */
  organizationId: string;
  /** The Turnkey private key ID, wallet account address, or public key to sign with. */
  signWith: string;
  /** The Ed25519 public key of `signWith`, as 32-byte hex with an optional `0x` prefix. */
  publicKey: string;
  /** Called with the activity ID after each verified signature. */
  onActivity?: (id: string) => void;
};

/** A public Ed25519 JSON Web Key (RFC 8037). */
export type Ed25519PublicJwk = {
  kty: "OKP";
  crv: "Ed25519";
  x: string;
};

const ED25519_KEY_HEX = /^[0-9a-fA-F]{64}$/;
const BASE64URL_32_BYTES = /^[A-Za-z0-9_-]{43}$/;

/**
 * Creates an Ed25519 `Signer` backed by a Turnkey key. The private key never
 * leaves Turnkey.
 *
 * Each signature is verified against `publicKey` before it is returned, so a
 * `signWith` that points at a different key fails instead of producing
 * signatures that verifiers reject.
 *
 * @throws {TypeError} If `organizationId`, `signWith` or `publicKey` is invalid.
 */
export function createTurnkeySigner(config: TurnkeySignerConfig): Signer {
  const { client, organizationId, signWith, onActivity } = config;
  if (!organizationId) {
    throw new TypeError("organizationId is required.");
  }
  if (!signWith) {
    throw new TypeError("signWith is required.");
  }
  const publicKeyBytes = parseEd25519PublicKey(config.publicKey);
  let verifyKey: Promise<CryptoKey> | undefined;

  const sign = async (data: Uint8Array): Promise<Uint8Array> => {
    verifyKey ??= crypto.subtle.importKey(
      "raw",
      toArrayBuffer(publicKeyBytes),
      "Ed25519",
      false,
      ["verify"],
    );

    let result: SignRawPayloadResult;
    try {
      result = await client.signRawPayload({
        organizationId,
        signWith,
        payload: uint8ArrayToHexString(data),
        encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
        hashFunction: "HASH_FUNCTION_NOT_APPLICABLE",
      });
    } catch (cause) {
      throw new Error("Turnkey raw payload signing failed.", { cause });
    }

    const status = result.activity?.status;
    if (status !== undefined && status !== "ACTIVITY_STATUS_COMPLETED") {
      throw new Error(`Turnkey signing activity did not complete: ${status}.`);
    }
    if (!ED25519_KEY_HEX.test(result.r) || !ED25519_KEY_HEX.test(result.s)) {
      throw new Error("Turnkey returned a malformed Ed25519 signature.");
    }

    const signature = uint8ArrayFromHexString(result.r + result.s);
    const valid = await crypto.subtle.verify(
      "Ed25519",
      await verifyKey,
      toArrayBuffer(signature),
      toArrayBuffer(data),
    );
    if (!valid) {
      throw new Error(
        "Turnkey signature does not verify against the configured public key.",
      );
    }

    const activityId = result.activity?.id;
    if (activityId) {
      onActivity?.(activityId);
    }
    return signature;
  };

  return { algorithm: "ed25519", sign };
}

/**
 * Converts a 32-byte Ed25519 public key in hex (optional `0x` prefix) into a
 * public JWK.
 *
 * @throws {TypeError} If the key is not 32 bytes of hex.
 */
export function ed25519PublicKeyToJwk(hex: string): Ed25519PublicJwk {
  const bytes = parseEd25519PublicKey(hex);
  return {
    kty: "OKP",
    crv: "Ed25519",
    x: hexStringToBase64url(uint8ArrayToHexString(bytes), 32),
  };
}

/**
 * Computes the RFC 7638 SHA-256 thumbprint of a public Ed25519 JWK, encoded as
 * base64url. mppx identity provers use it as `keyId`.
 *
 * @throws {TypeError} If the JWK is not a public Ed25519 key.
 */
export async function jwkThumbprint(jwk: Ed25519PublicJwk): Promise<string> {
  if (
    typeof jwk !== "object" ||
    jwk === null ||
    "d" in jwk ||
    jwk.kty !== "OKP" ||
    jwk.crv !== "Ed25519" ||
    typeof jwk.x !== "string" ||
    !BASE64URL_32_BYTES.test(jwk.x)
  ) {
    throw new TypeError("A public Ed25519 JWK is required.");
  }
  // RFC 7638 section 3.2: required members only, in lexicographic order.
  const canonical = JSON.stringify({ crv: jwk.crv, kty: jwk.kty, x: jwk.x });
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonical),
  );
  return hexStringToBase64url(uint8ArrayToHexString(new Uint8Array(digest)));
}

function parseEd25519PublicKey(hex: string): Uint8Array {
  const stripped =
    typeof hex === "string" && hex.startsWith("0x") ? hex.slice(2) : hex;
  if (typeof stripped !== "string" || !ED25519_KEY_HEX.test(stripped)) {
    throw new TypeError(
      "publicKey must be a 32-byte Ed25519 public key in hex.",
    );
  }
  return uint8ArrayFromHexString(stripped);
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return Uint8Array.from(bytes).buffer;
}

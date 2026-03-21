import {
  uint8ArrayToHexString,
  uint8ArrayFromHexString,
} from "@turnkey/encoding";
import { sha256 } from "@noble/hashes/sha256";
import { sha512 } from "@noble/hashes/sha512";
import {
  buildSshsigSignedData,
  buildSshsigEnvelope,
  armorSshSignature,
} from "./ssh-wire";

/**
 * Encode a string as base64url (no padding).
 */
function toBase64url(input: string): string {
  const bytes = new TextEncoder().encode(input);
  const base64 = btoa(String.fromCharCode(...bytes));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Encode raw bytes as base64url (no padding).
 */
function bytesToBase64url(input: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...input));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Sign a JWT with ES256 (P256) using the agent's wallet key.
 *
 * Produces a standards-compliant JWT (RFC 7515) with an ES256 signature.
 * The signing key must be a P256 wallet account address.
 *
 * Claims (iat, exp, aud, etc.) are the caller's responsibility.
 * This function does not auto-add any claims.
 *
 * @param client - TurnkeyApiClient (agent or admin)
 * @param params - JWT parameters
 * @returns Complete JWT string (header.payload.signature)
 */
export async function signJwt(
  client: { signRawPayload: Function; [key: string]: any },
  params: {
    organizationId: string;
    signingKey: string;
    header?: Record<string, unknown>;
    payload: Record<string, unknown>;
  },
): Promise<string> {
  const header = params.header ?? { alg: "ES256", typ: "JWT" };

  // Step 1: Base64url encode header and payload
  const encodedHeader = toBase64url(JSON.stringify(header));
  const encodedPayload = toBase64url(JSON.stringify(params.payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  // Step 2: SHA-256 hash client-side (Turnkey's P256 signer uses sign_prehash)
  const signingInputBytes = new TextEncoder().encode(signingInput);
  const digest = sha256(signingInputBytes);
  const hexDigest = uint8ArrayToHexString(digest);

  // Step 3: Sign the pre-hashed digest with Turnkey
  const signResult = await client.signRawPayload({
    organizationId: params.organizationId,
    signWith: params.signingKey,
    payload: hexDigest,
    encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
    hashFunction: "HASH_FUNCTION_NO_OP",
  });

  // Step 4: Assemble ES256 signature (raw r||s, NOT DER)
  // Turnkey returns r and s as fixed 64 hex char strings ([u8; 32] in Rust)
  const r = signResult.r as string;
  const s = signResult.s as string;

  if (r.length !== 64 || s.length !== 64) {
    throw new Error(
      `Unexpected signature component length: r=${r.length}, s=${s.length} (expected 64 each)`,
    );
  }

  const signatureBytes = uint8ArrayFromHexString(r + s);
  const encodedSignature = bytesToBase64url(signatureBytes);

  return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
}

/**
 * Sign a git commit with Ed25519 in SSHSIG format.
 *
 * Produces a standards-compliant SSHSIG armored signature that git recognizes
 * for commit signing. The private key never leaves Turnkey's enclave.
 *
 * The signing key must be an Ed25519 wallet account address.
 *
 * @param client - TurnkeyApiClient (agent or admin)
 * @param params - SSHSIG parameters
 * @returns Armored SSH signature string
 */
export async function signSshCommit(
  client: { signRawPayload: Function; [key: string]: any },
  params: {
    organizationId: string;
    signingKey: string;
    commitBuffer: string; // hex-encoded git commit content
    publicKey: string; // Ed25519 public key hex (for SSHSIG envelope)
    namespace?: string;
  },
): Promise<string> {
  const namespace = params.namespace ?? "git";
  const hashAlgorithm = "sha512";

  // Step 1: Hash the commit content with SHA-512
  const commitBytes = uint8ArrayFromHexString(params.commitBuffer);
  const messageHash = sha512(commitBytes);

  // Step 2: Build the "data to be signed" blob (what Ed25519 signs)
  const signedData = buildSshsigSignedData({
    namespace,
    hashAlgorithm,
    messageHash,
  });

  // Step 3: Send to Turnkey for Ed25519 signing
  const hexPayload = uint8ArrayToHexString(signedData);
  const signResult = await client.signRawPayload({
    organizationId: params.organizationId,
    signWith: params.signingKey,
    payload: hexPayload,
    encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
    hashFunction: "HASH_FUNCTION_NOT_APPLICABLE", // Ed25519 does internal SHA-512 per RFC 8032
  });

  // Step 4: Assemble the 64-byte Ed25519 signature (r || s)
  const r = signResult.r as string;
  const s = signResult.s as string;
  const signatureBytes = uint8ArrayFromHexString(r + s);

  // Step 5: Build the SSHSIG output envelope
  const envelope = buildSshsigEnvelope({
    publicKeyHex: params.publicKey,
    namespace,
    hashAlgorithm,
    signature: signatureBytes,
  });

  // Step 6: Armor and return
  return armorSshSignature(envelope);
}

/**
 * General-purpose message signing.
 *
 * Thin wrapper around sign_raw_payload that returns raw signature components.
 * Use for webhook signatures, challenge-response auth, or custom protocols.
 *
 * @param client - TurnkeyApiClient (agent or admin)
 * @param params - Signing parameters
 * @returns Raw signature components { r, s, v } as hex strings
 */
export async function signMessage(
  client: { signRawPayload: Function; [key: string]: any },
  params: {
    organizationId: string;
    signingKey: string;
    message: string;
    encoding?: string;
    hashFunction?: string;
  },
): Promise<{ r: string; s: string; v: string }> {
  const result = await client.signRawPayload({
    organizationId: params.organizationId,
    signWith: params.signingKey,
    payload: params.message,
    encoding: params.encoding ?? "PAYLOAD_ENCODING_HEXADECIMAL",
    hashFunction: params.hashFunction ?? "HASH_FUNCTION_SHA256",
  });

  return {
    r: result.r as string,
    s: result.s as string,
    v: result.v as string,
  };
}

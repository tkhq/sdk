/**
 * SSH wire format encoding utilities for SSHSIG envelope construction.
 *
 * SSH wire format uses 4-byte big-endian length prefixes before all strings/data.
 * See: https://www.openssh.com/specs.html and PROTOCOL.sshsig
 */

/**
 * Concatenate multiple Uint8Arrays into a single array.
 */
function concat(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

/**
 * Encode data in SSH wire format: 4-byte big-endian length prefix + data.
 */
export function sshString(data: Uint8Array): Uint8Array {
  const len = new Uint8Array(4);
  new DataView(len.buffer).setUint32(0, data.length);
  return concat(len, data);
}

/**
 * Write a uint32 in big-endian format.
 */
export function sshUint32(value: number): Uint8Array {
  const buf = new Uint8Array(4);
  new DataView(buf.buffer).setUint32(0, value);
  return buf;
}

/**
 * Encode a UTF-8 string in SSH wire format.
 */
export function sshStringFromUtf8(str: string): Uint8Array {
  return sshString(new TextEncoder().encode(str));
}

/**
 * Encode an Ed25519 public key in SSH wire format.
 *
 * SSH public key blob format: sshString("ssh-ed25519") + sshString(32-byte-key)
 *
 * @param publicKey - 32-byte Ed25519 public key as hex string (64 chars) or base58 (Solana address)
 */
export function sshEd25519PublicKey(publicKey: string): Uint8Array {
  const keyBytes = decodePublicKey(publicKey);
  if (keyBytes.length !== 32) {
    throw new Error(
      `Expected 32-byte Ed25519 public key, got ${keyBytes.length} bytes`,
    );
  }
  return concat(sshStringFromUtf8("ssh-ed25519"), sshString(keyBytes));
}

/**
 * Build the SSHSIG "data to be signed" blob.
 *
 * This is the data that Ed25519 signs (distinct from the output envelope).
 * Format: sshString("SSHSIG") + sshString(namespace) + sshString(reserved) + sshString(hashAlgo) + sshString(hash)
 */
export function buildSshsigSignedData(params: {
  namespace: string;
  hashAlgorithm: string;
  messageHash: Uint8Array;
}): Uint8Array {
  return concat(
    sshStringFromUtf8("SSHSIG"),
    sshStringFromUtf8(params.namespace),
    sshStringFromUtf8(""), // reserved (empty)
    sshStringFromUtf8(params.hashAlgorithm),
    sshString(params.messageHash),
  );
}

/**
 * Build the SSHSIG output envelope (the binary blob that gets armored).
 *
 * Format:
 *   "SSHSIG" (6 bytes, no null terminator in magic)
 *   uint32 version = 1
 *   sshString(publicKeyBlob)
 *   sshString(namespace)
 *   sshString(reserved = "")
 *   sshString(hashAlgorithm)
 *   sshString(signatureBlob)
 *
 * Where publicKeyBlob = sshString("ssh-ed25519") + sshString(32-byte-key)
 * And signatureBlob = sshString("ssh-ed25519") + sshString(64-byte-sig)
 */
export function buildSshsigEnvelope(params: {
  publicKeyHex: string;
  namespace: string;
  hashAlgorithm: string;
  signature: Uint8Array;
}): Uint8Array {
  const magic = new TextEncoder().encode("SSHSIG");
  const version = sshUint32(1);
  const publicKeyBlob = sshEd25519PublicKey(params.publicKeyHex);
  const signatureBlob = concat(
    sshStringFromUtf8("ssh-ed25519"),
    sshString(params.signature),
  );

  return concat(
    magic,
    version,
    sshString(publicKeyBlob),
    sshStringFromUtf8(params.namespace),
    sshStringFromUtf8(""), // reserved
    sshStringFromUtf8(params.hashAlgorithm),
    sshString(signatureBlob),
  );
}

/**
 * Armor a binary SSHSIG envelope into PEM-like format.
 *
 * Output:
 *   -----BEGIN SSH SIGNATURE-----
 *   <base64, wrapped at 76 chars>
 *   -----END SSH SIGNATURE-----
 */
export function armorSshSignature(binary: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...binary));
  // Wrap at 76 characters per line (standard PEM)
  const wrapped = base64.match(/.{1,76}/g)?.join("\n") ?? base64;
  return `-----BEGIN SSH SIGNATURE-----\n${wrapped}\n-----END SSH SIGNATURE-----`;
}

/**
 * Convert a hex string to Uint8Array.
 */
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

const BASE58_ALPHABET =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/**
 * Decode a base58 string to Uint8Array.
 */
function base58ToBytes(str: string): Uint8Array {
  const bytes: number[] = [0];
  for (const char of str) {
    const idx = BASE58_ALPHABET.indexOf(char);
    if (idx === -1) throw new Error(`Invalid base58 character: ${char}`);
    let carry = idx;
    for (let j = 0; j < bytes.length; j++) {
      carry += bytes[j]! * 58;
      bytes[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  // Leading zeros
  for (const char of str) {
    if (char !== "1") break;
    bytes.push(0);
  }
  return new Uint8Array(bytes.reverse());
}

/**
 * Decode a public key that may be hex (64 chars) or base58 (Solana address format).
 * Returns raw 32-byte Uint8Array.
 */
export function decodePublicKey(key: string): Uint8Array {
  // If it's 64 hex chars, treat as raw hex
  if (key.length === 64 && /^[0-9a-fA-F]+$/.test(key)) {
    return hexToBytes(key);
  }
  // Otherwise try base58 (Solana address format)
  return base58ToBytes(key);
}

import { Crypto } from "@peculiar/webcrypto";

// Polyfill crypto for Node.js environments
if (typeof crypto === "undefined") {
  (global as any).crypto = new Crypto();
}

/**
 * Encrypts data using ECIES with a P-256 public key.
 * This is used for Path 2 to encrypt recovery bundles with Turnkey's public key.
 *
 * Note: This is a simplified example. In production, use a well-tested
 * ECIES library or Turnkey's crypto package for encryption.
 */
export async function encryptWithPublicKey(
  publicKeyHex: string,
  plaintext: string
): Promise<string> {
  // Convert hex public key to bytes
  const publicKeyBytes = hexToBytes(publicKeyHex);

  // Import the public key
  const publicKey = await crypto.subtle.importKey(
    "raw",
    publicKeyBytes,
    {
      name: "ECDH",
      namedCurve: "P-256",
    },
    false,
    []
  );

  // Generate an ephemeral key pair for ECDH
  const ephemeralKeyPair = await crypto.subtle.generateKey(
    {
      name: "ECDH",
      namedCurve: "P-256",
    },
    true,
    ["deriveBits"]
  );

  // Derive shared secret
  const sharedSecret = await crypto.subtle.deriveBits(
    {
      name: "ECDH",
      public: publicKey,
    },
    ephemeralKeyPair.privateKey,
    256
  );

  // Derive AES key from shared secret
  const aesKey = await crypto.subtle.importKey(
    "raw",
    sharedSecret,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );

  // Generate IV
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Encrypt the plaintext
  const plaintextBytes = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    plaintextBytes
  );

  // Export ephemeral public key
  const ephemeralPublicKey = await crypto.subtle.exportKey(
    "raw",
    ephemeralKeyPair.publicKey
  );

  // Combine: ephemeral public key (65 bytes) + IV (12 bytes) + ciphertext
  const result = new Uint8Array(
    65 + iv.length + ciphertext.byteLength
  );
  result.set(new Uint8Array(ephemeralPublicKey), 0);
  result.set(iv, 65);
  result.set(new Uint8Array(ciphertext), 65 + iv.length);

  return bytesToHex(result);
}

/**
 * Decrypts data using ECIES with a P-256 private key.
 * This is used for Path 2 to decrypt recovery bundles after exporting
 * the encryption key from Turnkey.
 */
export async function decryptWithPrivateKey(
  privateKeyHex: string,
  encryptedDataHex: string
): Promise<string> {
  const encryptedData = hexToBytes(encryptedDataHex);

  // Extract components
  const ephemeralPublicKeyBytes = encryptedData.slice(0, 65);
  const iv = encryptedData.slice(65, 77);
  const ciphertext = encryptedData.slice(77);

  // Import the private key
  // Note: Private key from Turnkey export is typically in a specific format
  // This example assumes raw 32-byte private key
  const privateKeyBytes = hexToBytes(privateKeyHex);

  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    createPkcs8FromRaw(privateKeyBytes),
    {
      name: "ECDH",
      namedCurve: "P-256",
    },
    false,
    ["deriveBits"]
  );

  // Import ephemeral public key
  const ephemeralPublicKey = await crypto.subtle.importKey(
    "raw",
    ephemeralPublicKeyBytes,
    {
      name: "ECDH",
      namedCurve: "P-256",
    },
    false,
    []
  );

  // Derive shared secret
  const sharedSecret = await crypto.subtle.deriveBits(
    {
      name: "ECDH",
      public: ephemeralPublicKey,
    },
    privateKey,
    256
  );

  // Derive AES key
  const aesKey = await crypto.subtle.importKey(
    "raw",
    sharedSecret,
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );

  // Decrypt
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    aesKey,
    ciphertext
  );

  return new TextDecoder().decode(plaintext);
}

/**
 * Converts a hex string to a Uint8Array.
 */
export function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Converts a Uint8Array to a hex string.
 */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Creates a PKCS8 wrapper for a raw P-256 private key.
 */
function createPkcs8FromRaw(rawKey: Uint8Array): Uint8Array {
  // PKCS8 header for P-256
  const header = new Uint8Array([
    0x30, 0x41, 0x02, 0x01, 0x00, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48,
    0xce, 0x3d, 0x02, 0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03,
    0x01, 0x07, 0x04, 0x27, 0x30, 0x25, 0x02, 0x01, 0x01, 0x04, 0x20,
  ]);

  const result = new Uint8Array(header.length + rawKey.length);
  result.set(header, 0);
  result.set(rawKey, header.length);
  return result;
}

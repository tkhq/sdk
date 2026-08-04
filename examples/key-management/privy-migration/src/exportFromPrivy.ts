/**
 * exportFromPrivy.ts
 *
 * Fetches a private key from Privy's export API using HPKE, or generates a
 * throwaway key locally in --mock mode.
 *
 * The Privy export API and Turnkey's import API use the *same* HPKE suite:
 *   KEM:  DHKEM(P-256, HKDF-SHA256)
 *   KDF:  HKDF-SHA256
 *   AEAD: ChaCha20-Poly1305
 * That is why a single migration flow can move a key from Privy to Turnkey
 * without ever writing plaintext to persistent storage. Plaintext still
 * lives transiently in this process's RAM between decrypt and re-encrypt;
 * see README ("Trust boundary") for the honest accounting.
 */

import { CipherSuite } from "@hpke/core";
import { DhkemP256HkdfSha256, HkdfSha256 } from "@hpke/core";
import { Chacha20Poly1305 } from "@hpke/chacha20poly1305";
import { secp256k1 } from "@noble/curves/secp256k1";
import { ed25519 } from "@noble/curves/ed25519";
import { randomBytes } from "@noble/hashes/utils";
import bs58 from "bs58";
import fetch from "cross-fetch";

export type Chain = "evm" | "solana";

export type PrivyExportResult = {
  /**
   * Private key material, in the exact string form that
   * `@turnkey/crypto`'s `encryptPrivateKeyToBundle` expects for the given
   * `keyFormat`:
   *   - HEXADECIMAL: raw hex with or without a leading "0x" (EVM)
   *   - SOLANA:      base58-encoded 64-byte ed25519 keypair (Solana)
   */
  privateKey: string;
  keyFormat: "HEXADECIMAL" | "SOLANA";
  /** Purely informational: source of the key. */
  source: "privy-live" | "mock";
};

/** Suite instance shared by encrypt (recipient side) and decrypt. */
function buildSuite(): CipherSuite {
  return new CipherSuite({
    kem: new DhkemP256HkdfSha256(),
    kdf: new HkdfSha256(),
    aead: new Chacha20Poly1305(),
  });
}

/**
 * Generate an ephemeral P-256 keypair for use as the recipient of the
 * Privy export. The private key never leaves this process and is discarded
 * as soon as the imported plaintext has been re-encrypted to Turnkey.
 */
async function generateEphemeralRecipient(): Promise<{
  publicKeySpkiBase64: string;
  privateKey: CryptoKey;
}> {
  const suite = buildSuite();
  const kp = await suite.kem.generateKeyPair();
  const spki = await crypto.subtle.exportKey("spki", kp.publicKey);
  const publicKeySpkiBase64 = Buffer.from(spki).toString("base64");
  return { publicKeySpkiBase64, privateKey: kp.privateKey };
}

/**
 * Decrypt an HPKE payload produced by Privy's export endpoint. Privy
 * returns `ciphertext` (base64url) and `encapsulated_key` (base64) using
 * the shared suite above, BASE mode.
 */
async function hpkeOpen(
  recipientPrivateKey: CryptoKey,
  encappedKeyB64: string,
  ciphertextB64url: string,
): Promise<Uint8Array> {
  const suite = buildSuite();
  const enc = Uint8Array.from(Buffer.from(encappedKeyB64, "base64"));
  const ct = Uint8Array.from(
    Buffer.from(
      ciphertextB64url.replace(/-/g, "+").replace(/_/g, "/"),
      "base64",
    ),
  );
  const recipient = await suite.createRecipientContext({
    recipientKey: recipientPrivateKey,
    enc,
  });
  const pt = await recipient.open(ct);
  return new Uint8Array(pt);
}

type PrivyExportEnvelope = {
  encryption_type: "HPKE";
  ciphertext: string;
  encapsulated_key: string;
};

async function callPrivyExport(args: {
  appId: string;
  appSecret: string;
  walletId: string;
  recipientPublicKeyB64: string;
}): Promise<PrivyExportEnvelope> {
  const url = `https://api.privy.io/v1/wallets/${encodeURIComponent(
    args.walletId,
  )}/export`;
  const basic = Buffer.from(`${args.appId}:${args.appSecret}`).toString(
    "base64",
  );
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Basic ${basic}`,
      "privy-app-id": args.appId,
    },
    body: JSON.stringify({
      encryption_type: "HPKE",
      recipient_public_key: args.recipientPublicKeyB64,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Privy export failed: HTTP ${res.status} ${res.statusText}: ${text}`,
    );
  }
  const json = (await res.json()) as PrivyExportEnvelope;
  if (json.encryption_type !== "HPKE") {
    throw new Error(
      `Unexpected Privy response encryption_type: ${json.encryption_type}`,
    );
  }
  return json;
}

/**
 * Format a decrypted Privy plaintext into the string shape
 * `encryptPrivateKeyToBundle` accepts for the given chain. Privy returns
 * EVM keys as ASCII hex ("0x...") and Solana keys as base58 of the 64-byte
 * secret-key form. If Privy ever returns raw 32-byte bytes instead, we
 * detect and convert.
 */
function formatPrivyPlaintext(
  chain: Chain,
  pt: Uint8Array,
): { privateKey: string; keyFormat: "HEXADECIMAL" | "SOLANA" } {
  if (chain === "evm") {
    // Try ASCII first (Privy's documented shape).
    const asAscii = new TextDecoder().decode(pt).trim();
    if (/^0x[0-9a-fA-F]{64}$/.test(asAscii) || /^[0-9a-fA-F]{64}$/.test(asAscii)) {
      return { privateKey: asAscii, keyFormat: "HEXADECIMAL" };
    }
    // Fallback: raw 32 bytes.
    if (pt.length === 32) {
      const hex = Buffer.from(pt).toString("hex");
      return { privateKey: `0x${hex}`, keyFormat: "HEXADECIMAL" };
    }
    throw new Error(
      `Unexpected EVM key plaintext length=${pt.length}; expected ASCII hex or 32 bytes`,
    );
  }
  // Solana
  const asAscii = new TextDecoder().decode(pt).trim();
  // Base58 alphabet only, reasonable length for 64 bytes (~87-88 chars).
  if (/^[1-9A-HJ-NP-Za-km-z]{80,90}$/.test(asAscii)) {
    return { privateKey: asAscii, keyFormat: "SOLANA" };
  }
  // Fallback: raw bytes (32 = seed, 64 = keypair)
  if (pt.length === 64) {
    return { privateKey: bs58.encode(pt), keyFormat: "SOLANA" };
  }
  if (pt.length === 32) {
    // Expand 32-byte seed into 64-byte secretKey (seed || pub).
    const pub = ed25519.getPublicKey(pt);
    const kp = new Uint8Array(64);
    kp.set(pt, 0);
    kp.set(pub, 32);
    return { privateKey: bs58.encode(kp), keyFormat: "SOLANA" };
  }
  throw new Error(
    `Unexpected Solana key plaintext length=${pt.length}; expected base58 ASCII, 32, or 64 bytes`,
  );
}

/**
 * Live Privy export path. Generates an ephemeral P-256 recipient, calls
 * Privy, decrypts the returned HPKE payload, and returns the plaintext in
 * the shape @turnkey/crypto expects.
 */
export async function exportFromPrivyLive(args: {
  chain: Chain;
  appId: string;
  appSecret: string;
  walletId: string;
}): Promise<PrivyExportResult> {
  const { publicKeySpkiBase64, privateKey } =
    await generateEphemeralRecipient();

  const envelope = await callPrivyExport({
    appId: args.appId,
    appSecret: args.appSecret,
    walletId: args.walletId,
    recipientPublicKeyB64: publicKeySpkiBase64,
  });

  const plaintext = await hpkeOpen(
    privateKey,
    envelope.encapsulated_key,
    envelope.ciphertext,
  );

  const formatted = formatPrivyPlaintext(args.chain, plaintext);
  // Best-effort: zero the byte buffer we control. (Strings decoded from it
  // still live in JS heap; see README trust boundary.)
  plaintext.fill(0);
  return { ...formatted, source: "privy-live" };
}

/**
 * Mock export: generate a throwaway private key locally so the Turnkey
 * import path can be exercised end-to-end without a Privy account. Useful
 * for reproducing the migration flow in dev/CI.
 */
export function exportFromPrivyMock(chain: Chain): PrivyExportResult {
  if (chain === "evm") {
    const sk = secp256k1.utils.randomPrivateKey();
    return {
      privateKey: `0x${Buffer.from(sk).toString("hex")}`,
      keyFormat: "HEXADECIMAL",
      source: "mock",
    };
  }
  // Solana: generate 32-byte seed, expand to 64-byte keypair, base58-encode.
  const seed = randomBytes(32);
  const pub = ed25519.getPublicKey(seed);
  const kp = new Uint8Array(64);
  kp.set(seed, 0);
  kp.set(pub, 32);
  return {
    privateKey: bs58.encode(kp),
    keyFormat: "SOLANA",
    source: "mock",
  };
}

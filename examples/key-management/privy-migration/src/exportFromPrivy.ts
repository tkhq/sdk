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
 *
 * Ownership modes (see README "Does this work for embedded wallet users?"):
 *   - "app":    wallet owned by the app / an app-controlled authorization
 *               key. Export is authorized by the app's authorization key
 *               alone (privy-authorization-signature header). Fully
 *               UNATTENDED, BULK, silent. Zero end-user interaction.
 *   - "user":   user-owned embedded wallet. Export requires the user's
 *               JWT in authorization_context.user_jwts. LOGIN-TRIGGERED
 *               per user.
 *   - "quorum": 2-of-2 user + app. Requires BOTH the user JWT AND the
 *               app authorization key signature.
 */

import { CipherSuite } from "@hpke/core";
import { DhkemP256HkdfSha256, HkdfSha256 } from "@hpke/core";
import { Chacha20Poly1305 } from "@hpke/chacha20poly1305";
import { p256 } from "@noble/curves/p256";
import { secp256k1 } from "@noble/curves/secp256k1";
import { ed25519 } from "@noble/curves/ed25519";
import { sha256 } from "@noble/hashes/sha256";
import { randomBytes } from "@noble/hashes/utils";
import bs58 from "bs58";
import fetch from "cross-fetch";

export type Chain = "evm" | "solana";
export type Ownership = "app" | "user" | "quorum";

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
  /** Informational: source of the key. */
  source: "privy-live" | "mock";
  /** Which ownership auth path was exercised. */
  ownership: Ownership;
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

/**
 * Parse a Privy authorization private key. Privy publishes keys either as
 * PEM (PKCS#8, P-256) or base64. We accept both:
 *   - "wallet-auth:<base64...>" prefix (Privy convention) -> strip prefix
 *   - PEM block                                            -> extract body
 *   - bare base64 / hex                                    -> decode as-is
 * The returned bytes are the 32-byte raw P-256 secret scalar.
 */
function parseAuthorizationPrivateKey(input: string): Uint8Array {
  let s = input.trim();
  if (s.startsWith("wallet-auth:")) s = s.slice("wallet-auth:".length);
  if (s.includes("-----BEGIN")) {
    s = s
      .replace(/-----BEGIN [^-]+-----/g, "")
      .replace(/-----END [^-]+-----/g, "")
      .replace(/\s+/g, "");
    const der = Buffer.from(s, "base64");
    // PKCS#8: for P-256 the 32-byte scalar sits at the tail of the encoded
    // ECPrivateKey inside the PKCS#8 wrapper. This pragmatic extraction is
    // sufficient for Privy's key format; a hardened impl would walk ASN.1.
    if (der.length >= 32) {
      return der.subarray(der.length - 32);
    }
    throw new Error("Malformed PEM authorization key");
  }
  if (/^[0-9a-fA-F]{64}$/.test(s)) return Buffer.from(s, "hex");
  const buf = Buffer.from(s, "base64");
  if (buf.length === 32) return buf;
  if (buf.length >= 32) return buf.subarray(buf.length - 32);
  throw new Error(
    `Unrecognized authorization key format (length=${buf.length})`,
  );
}

/**
 * Build Privy's `privy-authorization-signature` header value.
 *
 * Privy's canonical payload is JSON with a stable field order:
 *   { version, method, url, body, headers }
 * where `headers` is a subset (privy-app-id) as a lowercase-keyed object.
 * We SHA-256 the canonical JSON and P-256/ECDSA-sign the digest, returning
 * a base64 signature. See Privy docs "Authorization signatures".
 */
function buildAuthorizationSignature(args: {
  method: string;
  url: string;
  body: unknown;
  appId: string;
  authorizationPrivateKey: Uint8Array;
}): string {
  const payload = {
    version: 1,
    method: args.method.toUpperCase(),
    url: args.url,
    body: args.body,
    headers: {
      "privy-app-id": args.appId,
    },
  };
  const canonical = JSON.stringify(payload);
  const digest = sha256(new TextEncoder().encode(canonical));
  const sig = p256.sign(digest, args.authorizationPrivateKey);
  return Buffer.from(sig.toDERRawBytes()).toString("base64");
}

async function callPrivyExport(args: {
  appId: string;
  appSecret: string;
  walletId: string;
  recipientPublicKeyB64: string;
  ownership: Ownership;
  userJwt?: string;
  authorizationPrivateKey?: Uint8Array;
}): Promise<PrivyExportEnvelope> {
  const url = `https://api.privy.io/v1/wallets/${encodeURIComponent(
    args.walletId,
  )}/export`;

  const bodyObj: Record<string, unknown> = {
    encryption_type: "HPKE",
    recipient_public_key: args.recipientPublicKeyB64,
  };
  if (args.ownership === "user" || args.ownership === "quorum") {
    if (!args.userJwt) {
      throw new Error(
        `ownership="${args.ownership}" requires a user JWT (PRIVY_USER_JWT).`,
      );
    }
    bodyObj["authorization_context"] = { user_jwts: [args.userJwt] };
  }
  const body = JSON.stringify(bodyObj);

  const basic = Buffer.from(`${args.appId}:${args.appSecret}`).toString(
    "base64",
  );
  const headers: Record<string, string> = {
    "content-type": "application/json",
    authorization: `Basic ${basic}`,
    "privy-app-id": args.appId,
  };

  if (args.ownership === "app" || args.ownership === "quorum") {
    if (!args.authorizationPrivateKey) {
      throw new Error(
        `ownership="${args.ownership}" requires an app authorization private key (PRIVY_AUTHORIZATION_PRIVATE_KEY).`,
      );
    }
    headers["privy-authorization-signature"] = buildAuthorizationSignature({
      method: "POST",
      url,
      body: bodyObj,
      appId: args.appId,
      authorizationPrivateKey: args.authorizationPrivateKey,
    });
  }

  const res = await fetch(url, { method: "POST", headers, body });
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
 * secret-key form. If Privy ever returns raw bytes instead, we detect and
 * convert.
 */
function formatPrivyPlaintext(
  chain: Chain,
  pt: Uint8Array,
): { privateKey: string; keyFormat: "HEXADECIMAL" | "SOLANA" } {
  if (chain === "evm") {
    const asAscii = new TextDecoder().decode(pt).trim();
    if (
      /^0x[0-9a-fA-F]{64}$/.test(asAscii) ||
      /^[0-9a-fA-F]{64}$/.test(asAscii)
    ) {
      return { privateKey: asAscii, keyFormat: "HEXADECIMAL" };
    }
    if (pt.length === 32) {
      const hex = Buffer.from(pt).toString("hex");
      return { privateKey: `0x${hex}`, keyFormat: "HEXADECIMAL" };
    }
    throw new Error(
      `Unexpected EVM key plaintext length=${pt.length}; expected ASCII hex or 32 bytes`,
    );
  }
  const asAscii = new TextDecoder().decode(pt).trim();
  if (/^[1-9A-HJ-NP-Za-km-z]{80,90}$/.test(asAscii)) {
    return { privateKey: asAscii, keyFormat: "SOLANA" };
  }
  if (pt.length === 64) {
    return { privateKey: bs58.encode(pt), keyFormat: "SOLANA" };
  }
  if (pt.length === 32) {
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
 * Validate that the caller supplied the auth material required by the
 * chosen ownership mode. Throws a clear error if not.
 */
export function requireAuthForOwnership(args: {
  ownership: Ownership;
  authorizationPrivateKeyRaw?: string | undefined;
  userJwt?: string | undefined;
}): {
  authorizationPrivateKey?: Uint8Array;
  userJwt?: string;
} {
  const out: { authorizationPrivateKey?: Uint8Array; userJwt?: string } = {};
  if (args.ownership === "app" || args.ownership === "quorum") {
    if (!args.authorizationPrivateKeyRaw) {
      throw new Error(
        `ownership="${args.ownership}" requires PRIVY_AUTHORIZATION_PRIVATE_KEY (app authorization key).`,
      );
    }
    out.authorizationPrivateKey = parseAuthorizationPrivateKey(
      args.authorizationPrivateKeyRaw,
    );
  }
  if (args.ownership === "user" || args.ownership === "quorum") {
    if (!args.userJwt) {
      throw new Error(
        `ownership="${args.ownership}" requires PRIVY_USER_JWT (user session token).`,
      );
    }
    out.userJwt = args.userJwt;
  }
  return out;
}

/**
 * Live Privy export path. Generates an ephemeral P-256 recipient, calls
 * Privy with the auth material appropriate for the chosen ownership mode,
 * decrypts the returned HPKE payload, and returns the plaintext in the
 * shape @turnkey/crypto expects.
 */
export async function exportFromPrivyLive(args: {
  chain: Chain;
  ownership: Ownership;
  appId: string;
  appSecret: string;
  walletId: string;
  authorizationPrivateKeyRaw?: string;
  userJwt?: string;
}): Promise<PrivyExportResult> {
  const auth = requireAuthForOwnership({
    ownership: args.ownership,
    authorizationPrivateKeyRaw: args.authorizationPrivateKeyRaw,
    userJwt: args.userJwt,
  });

  const { publicKeySpkiBase64, privateKey } =
    await generateEphemeralRecipient();

  const envelope = await callPrivyExport({
    appId: args.appId,
    appSecret: args.appSecret,
    walletId: args.walletId,
    recipientPublicKeyB64: publicKeySpkiBase64,
    ownership: args.ownership,
    ...(auth.userJwt !== undefined ? { userJwt: auth.userJwt } : {}),
    ...(auth.authorizationPrivateKey !== undefined
      ? { authorizationPrivateKey: auth.authorizationPrivateKey }
      : {}),
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
  return { ...formatted, source: "privy-live", ownership: args.ownership };
}

/**
 * Mock export: generate a throwaway private key locally so the Turnkey
 * import path can be exercised end-to-end without a Privy account. The
 * caller is expected to log which ownership path would apply live via
 * `describeOwnershipAuth`.
 */
export function exportFromPrivyMock(args: {
  chain: Chain;
  ownership: Ownership;
}): PrivyExportResult {
  const base = { source: "mock" as const, ownership: args.ownership };
  if (args.chain === "evm") {
    const sk = secp256k1.utils.randomPrivateKey();
    return {
      ...base,
      privateKey: `0x${Buffer.from(sk).toString("hex")}`,
      keyFormat: "HEXADECIMAL",
    };
  }
  const seed = randomBytes(32);
  const pub = ed25519.getPublicKey(seed);
  const kp = new Uint8Array(64);
  kp.set(seed, 0);
  kp.set(pub, 32);
  return {
    ...base,
    privateKey: bs58.encode(kp),
    keyFormat: "SOLANA",
  };
}

/** Human-readable description of what auth a live call needs for this mode. */
export function describeOwnershipAuth(ownership: Ownership): string {
  switch (ownership) {
    case "app":
      return "app authorization key alone (PRIVY_AUTHORIZATION_PRIVATE_KEY). Unattended bulk migration.";
    case "user":
      return "user JWT (PRIVY_USER_JWT) in authorization_context.user_jwts. Login-triggered per user.";
    case "quorum":
      return "BOTH the app authorization key AND the user JWT. Login-triggered, app co-signs.";
  }
}

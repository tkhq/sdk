/**
 * exportFromPrivy.ts
 *
 * Extracts a private key from Privy using the OFFICIAL `@privy-io/node`
 * SDK, or generates a throwaway key locally in --mock mode.
 *
 * The Privy SDK internally uses the same HPKE cipher suite Turnkey uses
 * for import:
 *   KEM:  DHKEM(P-256, HKDF-SHA256)
 *   KDF:  HKDF-SHA256
 *   AEAD: ChaCha20-Poly1305
 * That match is why a single migration flow can move a key from Privy to
 * Turnkey without ever writing plaintext to persistent storage. The Privy
 * SDK's `exportPrivateKey` handles the HPKE handshake, decrypts inside
 * this process, and returns the plaintext private key as a string.
 *
 * Plaintext lives transiently in this process's RAM between the Privy
 * decrypt and the Turnkey re-encrypt. See README ("Trust boundary") for
 * the honest accounting.
 *
 * Ownership modes (see README "Does this work for embedded wallet users?"):
 *   - "app":    wallet owned by the app / an app-controlled authorization
 *               key. Export is authorized by the app's authorization key
 *               alone. Fully UNATTENDED, BULK, silent. Zero end-user
 *               interaction.
 *   - "user":   user-owned embedded wallet. Export requires the user's
 *               JWT in authorization_context.user_jwts. LOGIN-TRIGGERED
 *               per user.
 *   - "quorum": 2-of-2 user + app. Requires BOTH the user JWT AND the
 *               app authorization key.
 */

import { PrivyClient, type AuthorizationContext } from "@privy-io/node";
import { secp256k1 } from "@noble/curves/secp256k1";
import { ed25519 } from "@noble/curves/ed25519";
import { randomBytes } from "@noble/hashes/utils";
import bs58 from "bs58";

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

/**
 * Normalise the plaintext Privy returned into the exact string shape that
 * `@turnkey/crypto`'s `encryptPrivateKeyToBundle` accepts for the given
 * chain. Privy returns EVM keys as ASCII hex ("0x...") and Solana keys
 * as base58-encoded 64-byte keypairs (per privy-io/node source), so this
 * is normally a passthrough; we validate the shape.
 */
function normalisePrivyPlaintext(
  chain: Chain,
  plaintext: string,
): { privateKey: string; keyFormat: "HEXADECIMAL" | "SOLANA" } {
  const s = plaintext.trim();
  if (chain === "evm") {
    if (/^0x[0-9a-fA-F]{64}$/.test(s) || /^[0-9a-fA-F]{64}$/.test(s)) {
      return { privateKey: s, keyFormat: "HEXADECIMAL" };
    }
    throw new Error(
      `Unexpected EVM key format from Privy (length=${s.length}); expected 64-hex-char string`,
    );
  }
  if (/^[1-9A-HJ-NP-Za-km-z]{80,90}$/.test(s)) {
    return { privateKey: s, keyFormat: "SOLANA" };
  }
  throw new Error(
    `Unexpected Solana key format from Privy (length=${s.length}); expected base58 of a 64-byte keypair`,
  );
}

/**
 * Validate that the caller supplied the auth material required by the
 * chosen ownership mode, and build the Privy `AuthorizationContext` that
 * the SDK expects. Throws a clear error if inputs are missing.
 */
export function buildAuthorizationContext(args: {
  ownership: Ownership;
  /**
   * The raw string value of PRIVY_AUTHORIZATION_PRIVATE_KEY. Privy expects
   * base64-encoded PKCS#8, no PEM headers (see @privy-io/node
   * AuthorizationContext docs). Required for "app" and "quorum".
   */
  authorizationPrivateKeyRaw?: string | undefined;
  /**
   * A Privy user session JWT (from PRIVY_USER_JWT). Required for "user"
   * and "quorum".
   */
  userJwt?: string | undefined;
}): AuthorizationContext {
  const ctx: AuthorizationContext = {};
  if (args.ownership === "app" || args.ownership === "quorum") {
    if (!args.authorizationPrivateKeyRaw) {
      throw new Error(
        `ownership="${args.ownership}" requires PRIVY_AUTHORIZATION_PRIVATE_KEY (app authorization key, base64 PKCS#8, no PEM headers).`,
      );
    }
    // Privy accepts the key with or without a "wallet-auth:" prefix; strip it.
    const raw = args.authorizationPrivateKeyRaw
      .trim()
      .replace(/^wallet-auth:/, "");
    ctx.authorization_private_keys = [raw];
  }
  if (args.ownership === "user" || args.ownership === "quorum") {
    if (!args.userJwt) {
      throw new Error(
        `ownership="${args.ownership}" requires PRIVY_USER_JWT (user session token).`,
      );
    }
    ctx.user_jwts = [args.userJwt];
  }
  return ctx;
}

/**
 * Live Privy export path. Uses the official @privy-io/node SDK, which
 * handles the entire HPKE flow (ephemeral recipient key, decrypt) and
 * builds the `privy-authorization-signature` header from the
 * AuthorizationContext for us.
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
  const authorizationContext = buildAuthorizationContext({
    ownership: args.ownership,
    authorizationPrivateKeyRaw: args.authorizationPrivateKeyRaw,
    userJwt: args.userJwt,
  });

  const privy = new PrivyClient({
    appId: args.appId,
    appSecret: args.appSecret,
  });

  const { private_key } = await privy
    .wallets()
    .exportPrivateKey(args.walletId, {
      authorization_context: authorizationContext,
    });

  const normalised = normalisePrivyPlaintext(args.chain, private_key);
  return { ...normalised, source: "privy-live", ownership: args.ownership };
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
      return "app authorization key alone (PRIVY_AUTHORIZATION_PRIVATE_KEY, base64 PKCS#8). Unattended bulk migration.";
    case "user":
      return "user JWT (PRIVY_USER_JWT) in authorization_context.user_jwts. Login-triggered per user.";
    case "quorum":
      return "BOTH the app authorization key AND the user JWT. Login-triggered, app co-signs.";
  }
}

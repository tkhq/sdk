/**
 * Shared helpers and SDK-internal type shims for the turnkey* orchestration
 * modules.
 *
 * The turnkey{Transfer,Claim,Lightning,Swap,Withdraw} flows all reach into
 * SparkWallet's private surface (transferService, leafManager, signingService,
 * config, gRPC client). We declare the shapes once here and reuse them — the
 * coupling to the SDK's internals is real, so make it explicit. Pin
 * @buildonspark/spark-sdk and update this file when the SDK changes.
 */

import type { v1WalletAccount } from "@turnkey/core";
import { secp256k1 } from "@noble/curves/secp256k1";

const COMPRESSED_PUBLIC_KEY_REGEX = /^[0-9a-fA-F]{66}$/;

export const compressedPublicKeyHexFromAccount = (
  account: v1WalletAccount,
): string | undefined => {
  return compressedPublicKeyHexFromString(account.publicKey ?? account.address);
};

export const compressedPublicKeyHexFromString = (
  key: string,
): string | undefined => {
  return COMPRESSED_PUBLIC_KEY_REGEX.test(key) ? key : undefined;
};

export const areBytesEqual = (a: Uint8Array, b: Uint8Array): boolean =>
  a.length === b.length && a.every((byte, i) => byte === b[i]);

export const isAlreadyExistsError = (err: unknown): boolean => {
  if (err == null) return false;

  const candidate = err as { code?: unknown; message?: unknown };
  return (
    candidate.code === 6 ||
    candidate.code === "ALREADY_EXISTS" ||
    String(candidate.message ?? err).includes("already exists")
  );
};

export const isNotFoundError = (err: unknown): boolean => {
  if (err == null) return false;

  const candidate = err as { code?: unknown; message?: unknown };
  return (
    candidate.code === 5 ||
    candidate.code === "NOT_FOUND" ||
    String(candidate.message ?? err)
      .toLowerCase()
      .includes("not found")
  );
};

export const compactEcdsaSignature = (signature: Uint8Array): Uint8Array => {
  if (signature.length === 64) {
    return secp256k1.Signature.fromBytes(signature, "compact")
      .normalizeS()
      .toBytes("compact");
  }

  try {
    return secp256k1.Signature.fromBytes(signature, "der")
      .normalizeS()
      .toBytes("compact");
  } catch {
    throw new Error(
      `Expected compact or DER ECDSA sender signature, got ${signature.length} bytes`,
    );
  }
};

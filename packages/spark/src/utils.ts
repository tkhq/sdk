import type { v1WalletAccount } from "@turnkey/core";

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

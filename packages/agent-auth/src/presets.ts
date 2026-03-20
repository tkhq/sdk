import type { AgentAccountConfig } from "./types";

const DEFAULT_PATH_FORMAT = "PATH_FORMAT_BIP32";

/**
 * Ed25519 account for git commit signing and SSH key operations.
 */
export function gitSigning(
  opts?: Partial<Pick<AgentAccountConfig, "exportKey" | "path">>
): AgentAccountConfig {
  return {
    label: "git-signing",
    curve: "CURVE_ED25519",
    pathFormat: DEFAULT_PATH_FORMAT,
    path: opts?.path ?? "m/44'/501'/0'/0'",
    addressFormat: "ADDRESS_FORMAT_SOLANA",
    exportKey: opts?.exportKey ?? false,
  };
}

/**
 * P256 account for ES256 JWT signing and OIDC authentication.
 */
export function jwtSigning(
  opts?: Partial<Pick<AgentAccountConfig, "exportKey" | "path">>
): AgentAccountConfig {
  return {
    label: "jwt-signing",
    curve: "CURVE_P256",
    pathFormat: DEFAULT_PATH_FORMAT,
    path: opts?.path ?? "m/44'/1'/0'/0/0",
    addressFormat: "ADDRESS_FORMAT_COMPRESSED",
    exportKey: opts?.exportKey ?? false,
  };
}

/**
 * secp256k1 account for Ethereum transaction signing.
 */
export function ethSigning(
  opts?: Partial<Pick<AgentAccountConfig, "exportKey" | "path">>
): AgentAccountConfig {
  return {
    label: "eth-signing",
    curve: "CURVE_SECP256K1",
    pathFormat: DEFAULT_PATH_FORMAT,
    path: opts?.path ?? "m/44'/60'/0'/0/0",
    addressFormat: "ADDRESS_FORMAT_ETHEREUM",
    exportKey: opts?.exportKey ?? false,
  };
}

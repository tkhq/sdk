import { TurnkeyError, TurnkeyErrorCodes } from "@turnkey/sdk-types";
import { bs58 } from "@turnkey/encoding";
import { getAddress } from "viem";
import type { WalletProvider } from "../__types__";
import { isEthereumProvider, isSolanaProvider, isWeb } from "../utils";

export type WalletLoginChain = "Ethereum" | "Solana";

export type BuildWalletLoginMessageParams = {
  chain: WalletLoginChain;
  domain: string;
  uri: string;
  walletAddress: string;
  /** Compressed P-256 public key, 66 hex chars. Lowercased in the message. */
  sessionPublicKey: string;
  chainId: string;
  issuedAt?: Date | string;
  expirationTime?: Date | string;
};

const STATEMENT = "Authorize this key for wallet authentication.";
const MAX_MESSAGE_BYTES = 8192;
const ISSUED_AT_MAX_FUTURE_MS = 60_000;
const DEFAULT_EXPIRATION_MS = 3_600_000;
const ETHEREUM_ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const COMPRESSED_P256 = /^(02|03)[0-9a-f]{64}$/;
const WALLET_PROTOCOL_RESOURCE_PREFIX = "urn:turnkey:wallet-protocol:";
const SESSION_KEY_RESOURCE_PREFIX = "urn:turnkey:session-key:";

/**
 * Normalizes a SIWx domain to the host that gets signed.
 *
 * Host only, lowercased. Drops `:80` and `:443`. Keeps any other port.
 * Accepts a bare host or a URL (scheme / path / query / userinfo are stripped).
 */
export function normalizeSiwxDomain(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new TurnkeyError(
      "SIWx domain must be non-empty",
      TurnkeyErrorCodes.VALIDATION_ERROR,
    );
  }
  if (/[\r\n]/.test(trimmed)) {
    throw new TurnkeyError(
      "SIWx domain cannot contain CR or LF",
      TurnkeyErrorCodes.VALIDATION_ERROR,
    );
  }

  let host: string;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)) {
    let url: URL;
    try {
      url = new URL(trimmed);
    } catch {
      throw new TurnkeyError(
        `Invalid SIWx domain: ${input}`,
        TurnkeyErrorCodes.VALIDATION_ERROR,
      );
    }
    if (url.username || url.password) {
      throw new TurnkeyError(
        "SIWx domain must not include userinfo",
        TurnkeyErrorCodes.VALIDATION_ERROR,
      );
    }
    host = url.host;
  } else {
    if (/[/?#@]/.test(trimmed)) {
      throw new TurnkeyError(
        "SIWx domain must be a host only (no scheme, path, query, or userinfo)",
        TurnkeyErrorCodes.VALIDATION_ERROR,
      );
    }
    host = trimmed;
  }

  host = host.toLowerCase().replace(/:(80|443)$/, "");
  if (host.endsWith("/")) {
    host = host.slice(0, -1);
  }
  if (!host) {
    throw new TurnkeyError(
      "SIWx domain must be non-empty",
      TurnkeyErrorCodes.VALIDATION_ERROR,
    );
  }
  return host;
}

/**
 * Builds the 14-line Turnkey SIWE / SIWS login template.
 *
 * LF only, no CR, no trailing newline. Protocol is derived from `chain`
 * (`Ethereum` → `siwe`, `Solana` → `siws`), so mixed pairs cannot be constructed.
 */
export function buildWalletLoginMessage(
  params: BuildWalletLoginMessageParams,
): string {
  const chain = params.chain;
  if (chain !== "Ethereum" && chain !== "Solana") {
    throw new TurnkeyError(
      `Unsupported SIWx chain: ${String(chain)}`,
      TurnkeyErrorCodes.VALIDATION_ERROR,
    );
  }

  const domain = normalizeSiwxDomain(params.domain);
  const uri = assertAbsoluteUriMatchesDomain(params.uri, domain);
  const walletAddress = assertWalletAddress(params.walletAddress, chain);
  const sessionPublicKey = assertSessionPublicKey(params.sessionPublicKey);
  const chainId = assertChainId(params.chainId);

  const now = Date.now();
  const issuedAtDate = params.issuedAt
    ? parseUtcTimestamp(params.issuedAt, "Issued At")
    : new Date(now);
  if (issuedAtDate.getTime() - now > ISSUED_AT_MAX_FUTURE_MS) {
    throw new TurnkeyError(
      "Issued At cannot be more than 60 seconds in the future",
      TurnkeyErrorCodes.VALIDATION_ERROR,
    );
  }

  const expirationDate = params.expirationTime
    ? parseUtcTimestamp(params.expirationTime, "Expiration Time")
    : new Date(issuedAtDate.getTime() + DEFAULT_EXPIRATION_MS);
  if (expirationDate.getTime() <= now) {
    throw new TurnkeyError(
      "Expiration Time must be strictly after now",
      TurnkeyErrorCodes.VALIDATION_ERROR,
    );
  }

  const protocol = chain === "Ethereum" ? "siwe" : "siws";
  const issuedAt = formatRfc3339UtcSeconds(issuedAtDate);
  const expirationTime = formatRfc3339UtcSeconds(expirationDate);

  const message = [
    `${domain} wants you to sign in with your ${chain} account:`,
    walletAddress,
    "",
    STATEMENT,
    "",
    `URI: ${uri}`,
    "Version: 1",
    `Chain ID: ${chainId}`,
    `Nonce: ${sessionPublicKey}`,
    `Issued At: ${issuedAt}`,
    `Expiration Time: ${expirationTime}`,
    "Resources:",
    `- ${WALLET_PROTOCOL_RESOURCE_PREFIX}${protocol}`,
    `- ${SESSION_KEY_RESOURCE_PREFIX}${sessionPublicKey}`,
  ].join("\n");

  if (message.includes("\r")) {
    throw new TurnkeyError(
      "SIWx message cannot contain CR",
      TurnkeyErrorCodes.VALIDATION_ERROR,
    );
  }

  if (new TextEncoder().encode(message).length > MAX_MESSAGE_BYTES) {
    throw new TurnkeyError(
      `SIWx message exceeds ${MAX_MESSAGE_BYTES} bytes`,
      TurnkeyErrorCodes.VALIDATION_ERROR,
    );
  }

  return message;
}

/**
 * Strips an optional `0x` prefix and checks the signature is 65-byte hex
 * (Ethereum `personal_sign`) or 64-byte hex (Solana ed25519).
 */
export function normalizeWalletSignature(
  signature: string,
  chain: WalletLoginChain,
): string {
  const hex =
    signature.startsWith("0x") || signature.startsWith("0X")
      ? signature.slice(2)
      : signature;
  const expectedBytes = chain === "Ethereum" ? 65 : 64;
  if (!/^[0-9a-fA-F]+$/.test(hex) || hex.length !== expectedBytes * 2) {
    throw new TurnkeyError(
      `${chain} wallet signature must be ${expectedBytes}-byte hex`,
      TurnkeyErrorCodes.VALIDATION_ERROR,
    );
  }
  return hex.toLowerCase();
}

function assertAbsoluteUriMatchesDomain(uri: string, domain: string): string {
  const trimmed = uri.trim();
  if (!trimmed) {
    throw new TurnkeyError(
      "SIWx URI must be non-empty",
      TurnkeyErrorCodes.VALIDATION_ERROR,
    );
  }
  if (/[\r\n]/.test(trimmed)) {
    throw new TurnkeyError(
      "SIWx URI cannot contain CR or LF",
      TurnkeyErrorCodes.VALIDATION_ERROR,
    );
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new TurnkeyError(
      "SIWx URI must be an absolute URI",
      TurnkeyErrorCodes.VALIDATION_ERROR,
    );
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new TurnkeyError(
      "SIWx URI must be an absolute http(s) URI",
      TurnkeyErrorCodes.VALIDATION_ERROR,
    );
  }

  const uriHost = normalizeSiwxDomain(url.host);
  if (uriHost !== domain) {
    throw new TurnkeyError(
      `SIWx URI host (${uriHost}) must equal domain (${domain})`,
      TurnkeyErrorCodes.VALIDATION_ERROR,
    );
  }

  return trimmed;
}

function assertWalletAddress(address: string, chain: WalletLoginChain): string {
  if (/[\r\n]/.test(address)) {
    throw new TurnkeyError(
      "Wallet address cannot contain CR or LF",
      TurnkeyErrorCodes.VALIDATION_ERROR,
    );
  }

  if (chain === "Ethereum") {
    if (!ETHEREUM_ADDRESS.test(address)) {
      throw new TurnkeyError(
        "Ethereum address must be 0x followed by 40 hex characters",
        TurnkeyErrorCodes.VALIDATION_ERROR,
      );
    }
    return getAddress(address);
  }

  let decoded: Uint8Array;
  try {
    decoded = bs58.decode(address);
  } catch {
    throw new TurnkeyError(
      "Solana address must be canonical base58 of a 32-byte public key",
      TurnkeyErrorCodes.VALIDATION_ERROR,
    );
  }
  if (decoded.length !== 32 || bs58.encode(decoded) !== address) {
    throw new TurnkeyError(
      "Solana address must be canonical base58 of a 32-byte public key",
      TurnkeyErrorCodes.VALIDATION_ERROR,
    );
  }
  return address;
}

function assertSessionPublicKey(sessionPublicKey: string): string {
  const normalized = sessionPublicKey.trim().toLowerCase();
  if (!COMPRESSED_P256.test(normalized)) {
    throw new TurnkeyError(
      "Session public key must be a lowercase compressed P-256 key (66 hex chars)",
      TurnkeyErrorCodes.VALIDATION_ERROR,
    );
  }
  return normalized;
}

function assertChainId(chainId: string): string {
  const trimmed = chainId.trim();
  if (!trimmed) {
    throw new TurnkeyError(
      "Chain ID must be a non-empty display string",
      TurnkeyErrorCodes.VALIDATION_ERROR,
    );
  }
  if (/[\r\n]/.test(trimmed)) {
    throw new TurnkeyError(
      "Chain ID cannot contain CR or LF",
      TurnkeyErrorCodes.VALIDATION_ERROR,
    );
  }
  return trimmed;
}

function parseUtcTimestamp(value: Date | string, label: string): Date {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new TurnkeyError(
      `Invalid ${label} timestamp`,
      TurnkeyErrorCodes.VALIDATION_ERROR,
    );
  }
  return date;
}

function formatRfc3339UtcSeconds(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

export function walletLoginChainFromProvider(
  provider: WalletProvider,
): WalletLoginChain {
  if (isEthereumProvider(provider)) {
    return "Ethereum";
  }
  if (isSolanaProvider(provider)) {
    return "Solana";
  }
  throw new TurnkeyError(
    "Wallet authenticator verification supports Ethereum and Solana only",
    TurnkeyErrorCodes.VALIDATION_ERROR,
  );
}

export function defaultWalletLoginChainId(provider: WalletProvider): string {
  if (isEthereumProvider(provider)) {
    const id = provider.chainInfo.chainId;
    if (/^0x[0-9a-fA-F]+$/.test(id)) {
      return String(parseInt(id, 16));
    }
    return id || "1";
  }
  return "solana";
}

/**
 * Resolves the SIWx domain.
 *
 * Web: `window.location.host`.
 * Mobile / no location: host of WalletConnect `appMetadata.url`.
 */
export function defaultSiwxDomain(metadataUrl?: string): string | undefined {
  if (isWeb() && typeof window !== "undefined" && window.location) {
    const host = window.location.host || window.location.hostname;
    if (host) {
      return host;
    }
  }
  if (metadataUrl) {
    return normalizeSiwxDomain(metadataUrl);
  }
  return undefined;
}

/**
 * Resolves the SIWx URI.
 *
 * Web: origin + pathname.
 * Mobile / no location: WalletConnect `appMetadata.url`, or `https://<domain>`
 * if that metadata is only a host.
 */
export function defaultSiwxUri(metadataUrl?: string): string | undefined {
  if (isWeb() && typeof window !== "undefined" && window.location) {
    const { origin, pathname, href } = window.location;
    if (origin) {
      return `${origin}${pathname ?? ""}`;
    }
    if (href) {
      return href;
    }
  }
  if (!metadataUrl) {
    return undefined;
  }
  try {
    const url = new URL(metadataUrl);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return metadataUrl;
    }
  } catch {
    // treat as a bare host below
  }
  return `https://${normalizeSiwxDomain(metadataUrl)}`;
}

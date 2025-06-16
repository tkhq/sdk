import { Buffer } from "buffer";

type AddressFormatConfig = {
  encoding: "PAYLOAD_ENCODING_HEXADECIMAL" | "PAYLOAD_ENCODING_TEXT_UTF8";
  hashFunction: "HASH_FUNCTION_NOT_APPLICABLE" | "HASH_FUNCTION_NO_OP" | "HASH_FUNCTION_SHA256" | "HASH_FUNCTION_KECCAK256";
};

const addressFormatConfig: Record<AddressFormat, AddressFormatConfig> = {
  ADDRESS_FORMAT_UNCOMPRESSED: { encoding: "PAYLOAD_ENCODING_HEXADECIMAL", hashFunction: "HASH_FUNCTION_SHA256" },
  ADDRESS_FORMAT_COMPRESSED: { encoding: "PAYLOAD_ENCODING_HEXADECIMAL", hashFunction: "HASH_FUNCTION_SHA256" },
  ADDRESS_FORMAT_ETHEREUM: { encoding: "PAYLOAD_ENCODING_HEXADECIMAL", hashFunction: "HASH_FUNCTION_KECCAK256" },
  ADDRESS_FORMAT_SOLANA: { encoding: "PAYLOAD_ENCODING_HEXADECIMAL", hashFunction: "HASH_FUNCTION_NOT_APPLICABLE" },
  ADDRESS_FORMAT_COSMOS: { encoding: "PAYLOAD_ENCODING_TEXT_UTF8", hashFunction: "HASH_FUNCTION_SHA256" },
  ADDRESS_FORMAT_TRON: { encoding: "PAYLOAD_ENCODING_HEXADECIMAL", hashFunction: "HASH_FUNCTION_SHA256" },
  ADDRESS_FORMAT_SUI: { encoding: "PAYLOAD_ENCODING_HEXADECIMAL", hashFunction: "HASH_FUNCTION_SHA256" },
  ADDRESS_FORMAT_APTOS: { encoding: "PAYLOAD_ENCODING_HEXADECIMAL", hashFunction: "HASH_FUNCTION_NOT_APPLICABLE" },
  ADDRESS_FORMAT_BITCOIN_MAINNET_P2PKH: { encoding: "PAYLOAD_ENCODING_HEXADECIMAL", hashFunction: "HASH_FUNCTION_SHA256" },
  ADDRESS_FORMAT_BITCOIN_MAINNET_P2SH: { encoding: "PAYLOAD_ENCODING_HEXADECIMAL", hashFunction: "HASH_FUNCTION_SHA256" },
  ADDRESS_FORMAT_BITCOIN_MAINNET_P2WPKH: { encoding: "PAYLOAD_ENCODING_HEXADECIMAL", hashFunction: "HASH_FUNCTION_SHA256" },
  ADDRESS_FORMAT_BITCOIN_MAINNET_P2WSH: { encoding: "PAYLOAD_ENCODING_HEXADECIMAL", hashFunction: "HASH_FUNCTION_SHA256" },
  ADDRESS_FORMAT_BITCOIN_MAINNET_P2TR: { encoding: "PAYLOAD_ENCODING_HEXADECIMAL", hashFunction: "HASH_FUNCTION_SHA256" },
  ADDRESS_FORMAT_BITCOIN_TESTNET_P2PKH: { encoding: "PAYLOAD_ENCODING_HEXADECIMAL", hashFunction: "HASH_FUNCTION_SHA256" },
  ADDRESS_FORMAT_BITCOIN_TESTNET_P2SH: { encoding: "PAYLOAD_ENCODING_HEXADECIMAL", hashFunction: "HASH_FUNCTION_SHA256" },
  ADDRESS_FORMAT_BITCOIN_TESTNET_P2WPKH: { encoding: "PAYLOAD_ENCODING_HEXADECIMAL", hashFunction: "HASH_FUNCTION_SHA256" },
  ADDRESS_FORMAT_BITCOIN_TESTNET_P2WSH: { encoding: "PAYLOAD_ENCODING_HEXADECIMAL", hashFunction: "HASH_FUNCTION_SHA256" },
  ADDRESS_FORMAT_BITCOIN_TESTNET_P2TR: { encoding: "PAYLOAD_ENCODING_HEXADECIMAL", hashFunction: "HASH_FUNCTION_SHA256" },
  ADDRESS_FORMAT_BITCOIN_SIGNET_P2PKH: { encoding: "PAYLOAD_ENCODING_HEXADECIMAL", hashFunction: "HASH_FUNCTION_SHA256" },
  ADDRESS_FORMAT_BITCOIN_SIGNET_P2SH: { encoding: "PAYLOAD_ENCODING_HEXADECIMAL", hashFunction: "HASH_FUNCTION_SHA256" },
  ADDRESS_FORMAT_BITCOIN_SIGNET_P2WPKH: { encoding: "PAYLOAD_ENCODING_HEXADECIMAL", hashFunction: "HASH_FUNCTION_SHA256" },
  ADDRESS_FORMAT_BITCOIN_SIGNET_P2WSH: { encoding: "PAYLOAD_ENCODING_HEXADECIMAL", hashFunction: "HASH_FUNCTION_SHA256" },
  ADDRESS_FORMAT_BITCOIN_SIGNET_P2TR: { encoding: "PAYLOAD_ENCODING_HEXADECIMAL", hashFunction: "HASH_FUNCTION_SHA256" },
  ADDRESS_FORMAT_BITCOIN_REGTEST_P2PKH: { encoding: "PAYLOAD_ENCODING_HEXADECIMAL", hashFunction: "HASH_FUNCTION_SHA256" },
  ADDRESS_FORMAT_BITCOIN_REGTEST_P2SH: { encoding: "PAYLOAD_ENCODING_HEXADECIMAL", hashFunction: "HASH_FUNCTION_SHA256" },
  ADDRESS_FORMAT_BITCOIN_REGTEST_P2WPKH: { encoding: "PAYLOAD_ENCODING_HEXADECIMAL", hashFunction: "HASH_FUNCTION_SHA256" },
  ADDRESS_FORMAT_BITCOIN_REGTEST_P2WSH: { encoding: "PAYLOAD_ENCODING_HEXADECIMAL", hashFunction: "HASH_FUNCTION_SHA256" },
  ADDRESS_FORMAT_BITCOIN_REGTEST_P2TR: { encoding: "PAYLOAD_ENCODING_HEXADECIMAL", hashFunction: "HASH_FUNCTION_SHA256" },
  ADDRESS_FORMAT_SEI: { encoding: "PAYLOAD_ENCODING_TEXT_UTF8", hashFunction: "HASH_FUNCTION_SHA256" },
  ADDRESS_FORMAT_XLM: { encoding: "PAYLOAD_ENCODING_HEXADECIMAL", hashFunction: "HASH_FUNCTION_SHA256" },
  ADDRESS_FORMAT_DOGE_MAINNET: { encoding: "PAYLOAD_ENCODING_HEXADECIMAL", hashFunction: "HASH_FUNCTION_SHA256" },
  ADDRESS_FORMAT_DOGE_TESTNET: { encoding: "PAYLOAD_ENCODING_HEXADECIMAL", hashFunction: "HASH_FUNCTION_SHA256" },
  ADDRESS_FORMAT_TON_V3R2: { encoding: "PAYLOAD_ENCODING_HEXADECIMAL", hashFunction: "HASH_FUNCTION_SHA256" },
  ADDRESS_FORMAT_TON_V4R2: { encoding: "PAYLOAD_ENCODING_HEXADECIMAL", hashFunction: "HASH_FUNCTION_SHA256" },
  ADDRESS_FORMAT_TON_V5R1: { encoding: "PAYLOAD_ENCODING_HEXADECIMAL", hashFunction: "HASH_FUNCTION_SHA256" },
  ADDRESS_FORMAT_XRP: { encoding: "PAYLOAD_ENCODING_HEXADECIMAL", hashFunction: "HASH_FUNCTION_SHA256" },
};

import type { AddressFormat, HashFunction, PayloadEncoding, Session } from "@turnkey/sdk-types";

export const isReactNative = (): boolean => {
  return (
    typeof navigator !== "undefined" && navigator.product === "ReactNative"
  );
};

export const isWeb = (): boolean => {
  return typeof window !== "undefined" && typeof document !== "undefined";
};

export const generateRandomBuffer = (): ArrayBuffer => {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return arr.buffer;
};

export const base64UrlEncode = (challenge: ArrayBuffer): string => {
  return Buffer.from(challenge)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
};

const hexByByte = Array.from({ length: 256 }, (_, i) =>
  i.toString(16).padStart(2, "0"),
);

export const bytesToHex = (bytes: Uint8Array): string => {
  let hex = "0x";
  if (bytes === undefined || bytes.length === 0) return hex;
  for (const byte of bytes) {
    hex += hexByByte[byte];
  }
  return hex;
};

export function parseSession(token: string | Session): Session {
  if (typeof token !== "string") {
    return token;
  }
  const [, payload] = token.split(".");
  if (!payload) {
    throw new Error("Invalid JWT: Missing payload");
  }

  const decoded = JSON.parse(atob(payload));
  const {
    exp,
    public_key: publicKey,
    session_type: sessionType,
    user_id: userId,
    organization_id: organizationId,
  } = decoded;

  if (!exp || !publicKey || !sessionType || !userId || !organizationId) {
    throw new Error("JWT payload missing required fields");
  }

  return {
    sessionType,
    userId,
    organizationId,
    expiry: exp,
    token: publicKey, // TODO (Amir): Should token be the JWT then add another field for publicKey?
  };
}

export function getMessageHashAndEncodingType (addressFormat: AddressFormat): {
  hashFunction: HashFunction;
  payloadEncoding: PayloadEncoding;
} {
  const config = addressFormatConfig[addressFormat];
  if (!config) {
    throw new Error(`Unsupported address format: ${addressFormat}`);
  }
  return {
    hashFunction: config.hashFunction,
    payloadEncoding: config.encoding,
  };
}

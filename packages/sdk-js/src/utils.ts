import type {
  v1AddressFormat,
  v1HashFunction,
  v1PayloadEncoding,
  Session,
} from "@turnkey/sdk-types";
import { WalletAccount } from "@types";
// Import all defaultAccountAtIndex functions for each address format
import {
  DEFAULT_ETHEREUM_ACCOUNTS,
  DEFAULT_COSMOS_ACCOUNTS,
  DEFAULT_TRON_ACCOUNTS,
  DEFAULT_BITCOIN_MAINNET_P2PKH_ACCOUNTS,
  DEFAULT_BITCOIN_MAINNET_P2SH_ACCOUNTS,
  DEFAULT_BITCOIN_MAINNET_P2WPKH_ACCOUNTS,
  DEFAULT_BITCOIN_MAINNET_P2WSH_ACCOUNTS,
  DEFAULT_BITCOIN_MAINNET_P2TR_ACCOUNTS,
  DEFAULT_BITCOIN_TESTNET_P2PKH_ACCOUNTS,
  DEFAULT_BITCOIN_TESTNET_P2SH_ACCOUNTS,
  DEFAULT_BITCOIN_TESTNET_P2WPKH_ACCOUNTS,
  DEFAULT_BITCOIN_TESTNET_P2WSH_ACCOUNTS,
  DEFAULT_BITCOIN_TESTNET_P2TR_ACCOUNTS,
  DEFAULT_BITCOIN_SIGNET_P2PKH_ACCOUNTS,
  DEFAULT_BITCOIN_SIGNET_P2SH_ACCOUNTS,
  DEFAULT_BITCOIN_SIGNET_P2WPKH_ACCOUNTS,
  DEFAULT_BITCOIN_SIGNET_P2WSH_ACCOUNTS,
  DEFAULT_BITCOIN_SIGNET_P2TR_ACCOUNTS,
  DEFAULT_BITCOIN_REGTEST_P2PKH_ACCOUNTS,
  DEFAULT_BITCOIN_REGTEST_P2SH_ACCOUNTS,
  DEFAULT_BITCOIN_REGTEST_P2WPKH_ACCOUNTS,
  DEFAULT_BITCOIN_REGTEST_P2WSH_ACCOUNTS,
  DEFAULT_BITCOIN_REGTEST_P2TR_ACCOUNTS,
  DEFAULT_DOGE_MAINNET_ACCOUNTS,
  DEFAULT_DOGE_TESTNET_ACCOUNTS,
  DEFAULT_SEI_ACCOUNTS,
  DEFAULT_XRP_ACCOUNTS,
  DEFAULT_SOLANA_ACCOUNTS,
  DEFAULT_SUI_ACCOUNTS,
  DEFAULT_APTOS_ACCOUNTS,
  DEFAULT_XLM_ACCOUNTS,
  DEFAULT_TON_V3R2_ACCOUNTS,
  DEFAULT_TON_V4R2_ACCOUNTS,
} from "./turnkey-helpers";

type AddressFormatConfig = {
  encoding: v1PayloadEncoding;
  hashFunction: v1HashFunction;
  defaultAccounts: WalletAccount[] | null;
};

const addressFormatConfig: Record<v1AddressFormat, AddressFormatConfig> = {
  ADDRESS_FORMAT_UNCOMPRESSED: {
    encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
    hashFunction: "HASH_FUNCTION_SHA256",
    defaultAccounts: null,
  },
  ADDRESS_FORMAT_COMPRESSED: {
    encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
    hashFunction: "HASH_FUNCTION_SHA256",
    defaultAccounts: null,
  },
  ADDRESS_FORMAT_ETHEREUM: {
    encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
    hashFunction: "HASH_FUNCTION_KECCAK256",
    defaultAccounts: DEFAULT_ETHEREUM_ACCOUNTS,
  },
  ADDRESS_FORMAT_SOLANA: {
    encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
    hashFunction: "HASH_FUNCTION_NOT_APPLICABLE",
    defaultAccounts: DEFAULT_SOLANA_ACCOUNTS,
  },
  ADDRESS_FORMAT_COSMOS: {
    encoding: "PAYLOAD_ENCODING_TEXT_UTF8",
    hashFunction: "HASH_FUNCTION_SHA256",
    defaultAccounts: DEFAULT_COSMOS_ACCOUNTS,
  },
  ADDRESS_FORMAT_TRON: {
    encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
    hashFunction: "HASH_FUNCTION_SHA256",
    defaultAccounts: DEFAULT_TRON_ACCOUNTS,
  },
  ADDRESS_FORMAT_SUI: {
    encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
    hashFunction: "HASH_FUNCTION_NOT_APPLICABLE",
    defaultAccounts: DEFAULT_SUI_ACCOUNTS,
  },
  ADDRESS_FORMAT_APTOS: {
    encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
    hashFunction: "HASH_FUNCTION_NOT_APPLICABLE",
    defaultAccounts: DEFAULT_APTOS_ACCOUNTS,
  },
  ADDRESS_FORMAT_BITCOIN_MAINNET_P2PKH: {
    encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
    hashFunction: "HASH_FUNCTION_SHA256",
    defaultAccounts: DEFAULT_BITCOIN_MAINNET_P2PKH_ACCOUNTS,
  },
  ADDRESS_FORMAT_BITCOIN_MAINNET_P2SH: {
    encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
    hashFunction: "HASH_FUNCTION_SHA256",
    defaultAccounts: DEFAULT_BITCOIN_MAINNET_P2SH_ACCOUNTS,
  },
  ADDRESS_FORMAT_BITCOIN_MAINNET_P2WPKH: {
    encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
    hashFunction: "HASH_FUNCTION_SHA256",
    defaultAccounts: DEFAULT_BITCOIN_MAINNET_P2WPKH_ACCOUNTS,
  },
  ADDRESS_FORMAT_BITCOIN_MAINNET_P2WSH: {
    encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
    hashFunction: "HASH_FUNCTION_SHA256",
    defaultAccounts: DEFAULT_BITCOIN_MAINNET_P2WSH_ACCOUNTS,
  },
  ADDRESS_FORMAT_BITCOIN_MAINNET_P2TR: {
    encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
    hashFunction: "HASH_FUNCTION_SHA256",
    defaultAccounts: DEFAULT_BITCOIN_MAINNET_P2TR_ACCOUNTS,
  },
  ADDRESS_FORMAT_BITCOIN_TESTNET_P2PKH: {
    encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
    hashFunction: "HASH_FUNCTION_SHA256",
    defaultAccounts: DEFAULT_BITCOIN_TESTNET_P2PKH_ACCOUNTS,
  },
  ADDRESS_FORMAT_BITCOIN_TESTNET_P2SH: {
    encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
    hashFunction: "HASH_FUNCTION_SHA256",
    defaultAccounts: DEFAULT_BITCOIN_TESTNET_P2SH_ACCOUNTS,
  },
  ADDRESS_FORMAT_BITCOIN_TESTNET_P2WPKH: {
    encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
    hashFunction: "HASH_FUNCTION_SHA256",
    defaultAccounts: DEFAULT_BITCOIN_TESTNET_P2WPKH_ACCOUNTS,
  },
  ADDRESS_FORMAT_BITCOIN_TESTNET_P2WSH: {
    encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
    hashFunction: "HASH_FUNCTION_SHA256",
    defaultAccounts: DEFAULT_BITCOIN_TESTNET_P2WSH_ACCOUNTS,
  },
  ADDRESS_FORMAT_BITCOIN_TESTNET_P2TR: {
    encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
    hashFunction: "HASH_FUNCTION_SHA256",
    defaultAccounts: DEFAULT_BITCOIN_TESTNET_P2TR_ACCOUNTS,
  },
  ADDRESS_FORMAT_BITCOIN_SIGNET_P2PKH: {
    encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
    hashFunction: "HASH_FUNCTION_SHA256",
    defaultAccounts: DEFAULT_BITCOIN_SIGNET_P2PKH_ACCOUNTS,
  },
  ADDRESS_FORMAT_BITCOIN_SIGNET_P2SH: {
    encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
    hashFunction: "HASH_FUNCTION_SHA256",
    defaultAccounts: DEFAULT_BITCOIN_SIGNET_P2SH_ACCOUNTS,
  },
  ADDRESS_FORMAT_BITCOIN_SIGNET_P2WPKH: {
    encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
    hashFunction: "HASH_FUNCTION_SHA256",
    defaultAccounts: DEFAULT_BITCOIN_SIGNET_P2WPKH_ACCOUNTS,
  },
  ADDRESS_FORMAT_BITCOIN_SIGNET_P2WSH: {
    encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
    hashFunction: "HASH_FUNCTION_SHA256",
    defaultAccounts: DEFAULT_BITCOIN_SIGNET_P2WSH_ACCOUNTS,
  },
  ADDRESS_FORMAT_BITCOIN_SIGNET_P2TR: {
    encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
    hashFunction: "HASH_FUNCTION_SHA256",
    defaultAccounts: DEFAULT_BITCOIN_SIGNET_P2TR_ACCOUNTS,
  },
  ADDRESS_FORMAT_BITCOIN_REGTEST_P2PKH: {
    encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
    hashFunction: "HASH_FUNCTION_SHA256",
    defaultAccounts: DEFAULT_BITCOIN_REGTEST_P2PKH_ACCOUNTS,
  },
  ADDRESS_FORMAT_BITCOIN_REGTEST_P2SH: {
    encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
    hashFunction: "HASH_FUNCTION_SHA256",
    defaultAccounts: DEFAULT_BITCOIN_REGTEST_P2SH_ACCOUNTS,
  },
  ADDRESS_FORMAT_BITCOIN_REGTEST_P2WPKH: {
    encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
    hashFunction: "HASH_FUNCTION_SHA256",
    defaultAccounts: DEFAULT_BITCOIN_REGTEST_P2WPKH_ACCOUNTS,
  },
  ADDRESS_FORMAT_BITCOIN_REGTEST_P2WSH: {
    encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
    hashFunction: "HASH_FUNCTION_SHA256",
    defaultAccounts: DEFAULT_BITCOIN_REGTEST_P2WSH_ACCOUNTS,
  },
  ADDRESS_FORMAT_BITCOIN_REGTEST_P2TR: {
    encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
    hashFunction: "HASH_FUNCTION_SHA256",
    defaultAccounts: DEFAULT_BITCOIN_REGTEST_P2TR_ACCOUNTS,
  },
  ADDRESS_FORMAT_SEI: {
    encoding: "PAYLOAD_ENCODING_TEXT_UTF8",
    hashFunction: "HASH_FUNCTION_SHA256",
    defaultAccounts: DEFAULT_SEI_ACCOUNTS,
  },
  ADDRESS_FORMAT_XLM: {
    encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
    hashFunction: "HASH_FUNCTION_NOT_APPLICABLE",
    defaultAccounts: DEFAULT_XLM_ACCOUNTS,
  },
  ADDRESS_FORMAT_DOGE_MAINNET: {
    encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
    hashFunction: "HASH_FUNCTION_SHA256",
    defaultAccounts: DEFAULT_DOGE_MAINNET_ACCOUNTS,
  },
  ADDRESS_FORMAT_DOGE_TESTNET: {
    encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
    hashFunction: "HASH_FUNCTION_SHA256",
    defaultAccounts: DEFAULT_DOGE_TESTNET_ACCOUNTS,
  },
  ADDRESS_FORMAT_TON_V3R2: {
    encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
    hashFunction: "HASH_FUNCTION_NOT_APPLICABLE",
    defaultAccounts: DEFAULT_TON_V3R2_ACCOUNTS,
  },
  ADDRESS_FORMAT_TON_V4R2: {
    encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
    hashFunction: "HASH_FUNCTION_NOT_APPLICABLE",
    defaultAccounts: DEFAULT_TON_V4R2_ACCOUNTS,
  },
  ADDRESS_FORMAT_TON_V5R1: {
    encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
    hashFunction: "HASH_FUNCTION_NOT_APPLICABLE",
    defaultAccounts: null,
  },
  ADDRESS_FORMAT_XRP: {
    encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
    hashFunction: "HASH_FUNCTION_SHA256",
    defaultAccounts: DEFAULT_XRP_ACCOUNTS,
  },
};

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
    publicKey,
    token,
  };
}

export function getMessageHashAndEncodingType(
  addressFormat: v1AddressFormat,
  rawMessage: string,
): {
  hashFunction: v1HashFunction;
  payloadEncoding: v1PayloadEncoding;
  encodedMessage: string;
} {
  const config = addressFormatConfig[addressFormat];
  if (!config) {
    throw new Error(`Unsupported address format: ${addressFormat}`);
  }

  let encodedMessage: string;
  if (config.encoding === "PAYLOAD_ENCODING_HEXADECIMAL") {
    encodedMessage =
      "0x" +
      Array.from(new TextEncoder().encode(rawMessage))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
  } else {
    encodedMessage = rawMessage;
  }

  return {
    hashFunction: config.hashFunction,
    payloadEncoding: config.encoding,
    encodedMessage,
  };
}

// Type guard to check if accounts is WalletAccount[]
export function isWalletAccountArray(arr: any[]): arr is WalletAccount[] {
  return (
    arr.length === 0 ||
    (typeof arr[0] === "object" &&
      "address" in arr[0] &&
      "addressFormat" in arr[0])
  );
}

export function createWalletAccountFromAddressFormat(
  addressFormat: v1AddressFormat,
): WalletAccount {
  const walletAccount = addressFormatConfig[addressFormat].defaultAccounts;
  if (!walletAccount) {
    throw new Error(`Unsupported address format: ${addressFormat}`);
  }

  if (walletAccount[0]) {
    return walletAccount[0];
  }

  throw new Error(
    `No default accounts defined for address format: ${addressFormat}`,
  );
}

export function generateWalletAccountsFromAddressFormat(
  addresses: v1AddressFormat[],
) {
  let walletAccounts: WalletAccount[] = [];
  const pathMap = new Map<string, number>();
  walletAccounts = addresses.map((addressFormat) => {
    const account = createWalletAccountFromAddressFormat(addressFormat);
    const pathIndex = pathMap.get(account.path) ?? 0;
    // Replace the number after the first 3 slashes (the 4th segment)
    const pathWithIndex = account.path.replace(
      /^((?:[^\/]*\/){3})(\d+)/,
      (_, prefix, _oldIdx) => `${prefix}${pathIndex}`,
    );
    pathMap.set(account.path, pathIndex + 1);
    const newAccount: WalletAccount = {
      curve: account.curve,
      pathFormat: account.pathFormat,
      path: pathWithIndex,
      addressFormat: account.addressFormat,
    };
    return newAccount;
  });

  console.log(walletAccounts);
  return walletAccounts;
}

import {
  type v1AddressFormat,
  type v1HashFunction,
  type v1PayloadEncoding,
  type Session,
  type externaldatav1Timestamp,
  type ProxyTSignupBody,
  type v1ApiKeyParamsV2,
  type v1ApiKeyCurve,
  type v1AuthenticatorParamsV2,
  type v1WalletAccountParams,
  type v1WalletAccount,
  TurnkeyError,
  TurnkeyErrorCodes,
  v1SignRawPayloadResult,
} from "@turnkey/sdk-types";
import {
  WalletType,
  type CreateSubOrgParams,
  SignIntent,
  type WalletProvider,
} from "@types";
import { keccak256 } from "ethers";
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
import { fromDerSignature } from "@turnkey/crypto";
import {
  decodeBase64urlToString,
  uint8ArrayFromHexString,
  uint8ArrayToHexString,
} from "@turnkey/encoding";

type AddressFormatConfig = {
  encoding: v1PayloadEncoding;
  hashFunction: v1HashFunction;
  defaultAccounts: v1WalletAccountParams[] | null;
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

export const toExternalTimestamp = (
  date: Date = new Date(),
): externaldatav1Timestamp => {
  const millis = date.getTime();
  const seconds = Math.floor(millis / 1000);
  const nanos = (millis % 1000) * 1_000_000;

  return {
    seconds: seconds.toString(),
    nanos: nanos.toString(),
  };
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

  const expSeconds = Math.ceil((exp * 1000 - Date.now()) / 1000);

  return {
    sessionType,
    userId,
    organizationId,
    expiry: exp,
    expirationSeconds: expSeconds.toString(),
    publicKey,
    token,
  };
}

export function getHashFunction(addressFormat: v1AddressFormat) {
  const config = addressFormatConfig[addressFormat];
  if (!config) {
    throw new TurnkeyError(
      `Unsupported address format: ${addressFormat}`,
      TurnkeyErrorCodes.INVALID_REQUEST,
    );
  }
  return config.hashFunction;
}

export function getEncodingType(addressFormat: v1AddressFormat) {
  const config = addressFormatConfig[addressFormat];
  if (!config) {
    throw new TurnkeyError(
      `Unsupported address format: ${addressFormat}`,
      TurnkeyErrorCodes.INVALID_REQUEST,
    );
  }
  return config.encoding;
}

export function getEncodedMessage(
  addressFormat: v1AddressFormat,
  rawMessage: string,
): string {
  const config = addressFormatConfig[addressFormat];
  if (!config) {
    throw new TurnkeyError(
      `Unsupported address format: ${addressFormat}`,
      TurnkeyErrorCodes.INVALID_REQUEST,
    );
  }
  if (config.encoding === "PAYLOAD_ENCODING_HEXADECIMAL") {
    return ("0x" +
      Array.from(new TextEncoder().encode(rawMessage))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")) as string;
  }
  return rawMessage;
}

export const hashPayload = async (
  encodedMessage: string,
  hashFn: v1HashFunction,
): Promise<string> => {
  // when no hashing is required, we just return the string untouched
  if (
    hashFn === "HASH_FUNCTION_NOT_APPLICABLE" ||
    hashFn === "HASH_FUNCTION_NO_OP"
  ) {
    return encodedMessage;
  }

  const msgBytes = encodedMessage.startsWith("0x")
    ? uint8ArrayFromHexString(encodedMessage.slice(2))
    : new TextEncoder().encode(encodedMessage);

  if (hashFn === "HASH_FUNCTION_SHA256") {
    const digest = await crypto.subtle.digest("SHA-256", msgBytes);
    return "0x" + bytesToHex(new Uint8Array(digest));
  }

  if (hashFn === "HASH_FUNCTION_KECCAK256") {
    return keccak256(msgBytes);
  }

  throw new Error(`Unsupported hash function: ${hashFn}`);
};

export const getWalletAccountMethods = (
  sign: (
    message: string,
    provider: WalletProvider,
    intent: SignIntent,
  ) => Promise<string>,
  provider: WalletProvider,
) => {
  const signWithIntent = (intent: SignIntent) => {
    return async (input: string) => {
      return sign(input, provider, intent);
    };
  };

  switch (provider.type) {
    case WalletType.Ethereum:
    case WalletType.EthereumWalletConnect:
      return {
        signMessage: signWithIntent(SignIntent.SignMessage),
        signAndSendTransaction: signWithIntent(
          SignIntent.SignAndSendTransaction,
        ),
      };

    case WalletType.Solana:
    case WalletType.SolanaWalletConnect:
      return {
        signMessage: signWithIntent(SignIntent.SignMessage),
        signTransaction: signWithIntent(SignIntent.SignTransaction),
        signAndSendTransaction: signWithIntent(
          SignIntent.SignAndSendTransaction,
        ),
      };

    default:
      throw new Error(
        `Unsupported wallet type: ${provider.type}. Supported types are Ethereum and Solana.`,
      );
  }
};

export function splitSignature(
  signature: string,
  addressFormat: v1AddressFormat,
): v1SignRawPayloadResult {
  const hex = signature.replace(/^0x/, "");

  if (addressFormat === "ADDRESS_FORMAT_ETHEREUM") {
    // this is a ECDSA signature
    if (hex.length === 130) {
      const r = hex.slice(0, 64);
      const s = hex.slice(64, 128);
      const v = hex.slice(128, 130);
      return { r, s, v };
    }

    // this is a DER-encoded signatures (e.g., Ledger)
    const raw = fromDerSignature(hex);
    const r = uint8ArrayToHexString(raw.slice(0, 32));
    const s = uint8ArrayToHexString(raw.slice(32, 64));

    // DER signatures do not have a v component
    // so we return 00 to match what Turnkey does
    const v = "00";
    return { r, s, v };
  }

  if (addressFormat === "ADDRESS_FORMAT_SOLANA") {
    if (hex.length !== 128) {
      throw new Error(
        `Invalid Solana signature length: expected 64 bytes (128 hex), got ${hex.length}`,
      );
    }

    // this is a Ed25519 signature
    const r = hex.slice(0, 64);
    const s = hex.slice(64, 128);

    // solana signatures do not have a v component
    // so we return 00 to match what Turnkey does
    return { r, s, v: "00" };
  }

  throw new Error(
    `Unsupported address format or invalid signature length: ${hex.length}`,
  );
}

// Type guard to check if accounts is WalletAccount[]
export function isWalletAccountArray(
  arr: any[],
): arr is v1WalletAccountParams[] {
  return (
    arr.length === 0 ||
    (typeof arr[0] === "object" &&
      "address" in arr[0] &&
      "addressFormat" in arr[0])
  );
}

export function createWalletAccountFromAddressFormat(
  addressFormat: v1AddressFormat,
): v1WalletAccountParams {
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

export function generateWalletAccountsFromAddressFormat(params: {
  addresses: v1AddressFormat[];
  existingWalletAccounts?: v1WalletAccount[];
}): v1WalletAccountParams[] {
  const { addresses, existingWalletAccounts } = params;
  const pathMap = new Map<string, number>();

  // Build a lookup for max index per (addressFormat, basePath)
  const maxIndexMap = new Map<string, number>();
  if (existingWalletAccounts && existingWalletAccounts.length > 0) {
    for (const acc of existingWalletAccounts) {
      // Normalize base path (remove account index)
      const basePath = acc.path.replace(/^((?:[^\/]+\/){3})[^\/]+/, "$1");
      const key = `${acc.addressFormat}:${basePath}`;
      const idxSegment = acc.path.split("/")[3];
      const idx = idxSegment ? parseInt(idxSegment.replace(/'/, ""), 10) : -1;
      if (!isNaN(idx)) {
        maxIndexMap.set(key, Math.max(maxIndexMap.get(key) ?? -1, idx));
      }
    }
  }

  return addresses.map((addressFormat) => {
    const account = createWalletAccountFromAddressFormat(addressFormat);
    const basePath = account.path.replace(/^((?:[^\/]+\/){3})[^\/]+/, "$1");
    const key = `${addressFormat}:${basePath}`;
    let nextIndex = 0;

    if (maxIndexMap.has(key)) {
      nextIndex = maxIndexMap.get(key)! + 1;
    } else if (pathMap.has(account.path)) {
      nextIndex = pathMap.get(account.path)!;
    }

    const pathWithIndex = account.path.replace(
      /^((?:[^\/]*\/){3})(\d+)/,
      (_, prefix) => `${prefix}${nextIndex}`,
    );
    pathMap.set(account.path, nextIndex + 1);

    return {
      ...account,
      path: pathWithIndex,
    } as v1WalletAccountParams;
  });
}

export function buildSignUpBody(params: {
  createSubOrgParams: CreateSubOrgParams | undefined;
}): ProxyTSignupBody {
  const { createSubOrgParams } = params;
  const websiteName = window.location.hostname;

  let authenticators: v1AuthenticatorParamsV2[] = [];
  if (createSubOrgParams?.authenticators?.length) {
    authenticators =
      createSubOrgParams?.authenticators?.map((authenticator) => ({
        authenticatorName:
          authenticator.authenticatorName || `${websiteName}-${Date.now()}`,
        challenge: authenticator.challenge,
        attestation: authenticator.attestation,
      })) || [];
  }

  let apiKeys: v1ApiKeyParamsV2[] = [];
  if (createSubOrgParams?.apiKeys?.length) {
    apiKeys = createSubOrgParams.apiKeys
      .filter((apiKey) => apiKey.curveType !== undefined)
      .map((apiKey) => ({
        apiKeyName: apiKey.apiKeyName || `api-key-${Date.now()}`,
        publicKey: apiKey.publicKey,
        curveType: apiKey.curveType as v1ApiKeyCurve,
        ...(apiKey?.expirationSeconds && {
          expirationSeconds: apiKey.expirationSeconds,
        }),
      }));
  }

  return {
    userName:
      createSubOrgParams?.userName ||
      createSubOrgParams?.userEmail ||
      `user-${Date.now()}`,
    ...(createSubOrgParams?.userEmail && {
      userEmail: createSubOrgParams?.userEmail,
    }),
    ...(createSubOrgParams?.authenticators?.length
      ? {
          authenticators,
        }
      : { authenticators: [] }),
    ...(createSubOrgParams?.userPhoneNumber && {
      userPhoneNumber: createSubOrgParams.userPhoneNumber,
    }),
    ...(createSubOrgParams?.userTag && {
      userTag: createSubOrgParams?.userTag,
    }),
    subOrgName: createSubOrgParams?.subOrgName || `sub-org-${Date.now()}`,
    ...(createSubOrgParams?.verificationToken && {
      verificationToken: createSubOrgParams?.verificationToken,
    }),
    ...(createSubOrgParams?.apiKeys?.length
      ? {
          apiKeys,
        }
      : { apiKeys: [] }),
    ...(createSubOrgParams?.oauthProviders?.length
      ? {
          oauthProviders: createSubOrgParams.oauthProviders,
        }
      : { oauthProviders: [] }),
    ...(createSubOrgParams?.customWallet && {
      wallet: {
        walletName: createSubOrgParams.customWallet.walletName,
        accounts: createSubOrgParams.customWallet.walletAccounts,
      },
    }),
  };
}

/**
 * Extracts the public key from a Turnkey stamp header value.
 * @param stampHeaderValue - The base64url encoded stamp header value
 * @returns The public key as a hex string
 */
export function getPublicKeyFromStampHeader(stampHeaderValue: string): string {
  try {
    // we decode the base64url string to get the JSON stamp
    const stampJson = decodeBase64urlToString(stampHeaderValue);

    // we parse the JSON to get the stamp object
    const stamp = JSON.parse(stampJson) as {
      publicKey: string;
      scheme: string;
      signature: string;
    };

    return stamp.publicKey;
  } catch (error) {
    throw new Error(
      `Failed to extract public key from stamp header: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

export function isEthereumWallet(wallet: WalletProvider): boolean {
  const walletType = wallet.type;
  return (
    walletType === WalletType.Ethereum ||
    walletType === WalletType.EthereumWalletConnect
  );
}

export function isSolanaWallet(wallet: WalletProvider): boolean {
  const walletType = wallet.type;
  return (
    walletType === WalletType.Solana ||
    walletType === WalletType.SolanaWalletConnect
  );
}

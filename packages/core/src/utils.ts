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
  v1TransactionType,
  ProxyTGetWalletKitConfigResponse,
  v1User,
} from "@turnkey/sdk-types";
import {
  type CreateSubOrgParams,
  type WalletProvider,
  Chain,
  GrpcStatus,
  TurnkeyRequestError,
  EvmChainInfo,
  SolanaChainInfo,
  Curve,
} from "./__types__/base";
import bs58 from "bs58";

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
import { fromDerSignature, uncompressRawPublicKey } from "@turnkey/crypto";
import {
  decodeBase64urlToString,
  uint8ArrayFromHexString,
  uint8ArrayToHexString,
} from "@turnkey/encoding";
import { keccak256 } from "ethers";

type AddressFormatConfig = {
  encoding: v1PayloadEncoding;
  hashFunction: v1HashFunction;
  defaultAccounts: v1WalletAccountParams[] | null;
  displayName: string;
};

/**
 * Configuration for all supported address formats.
 *
 * Includes:
 * - encoding type
 * - hash function
 * - default accounts for the address format
 * - display name for the address format
 *
 * ```ts
 * // Example usage:
 * import { addressFormatConfig } from "@turnkey/sdk-core";
 *
 * const config = addressFormatConfig["ADDRESS_FORMAT_ETHEREUM"];
 * ```
 */
export const addressFormatConfig: Record<v1AddressFormat, AddressFormatConfig> =
  {
    ADDRESS_FORMAT_UNCOMPRESSED: {
      encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
      hashFunction: "HASH_FUNCTION_SHA256",
      defaultAccounts: null,
      displayName: "Uncompressed",
    },
    ADDRESS_FORMAT_COMPRESSED: {
      encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
      hashFunction: "HASH_FUNCTION_SHA256",
      defaultAccounts: null,
      displayName: "Compressed",
    },
    ADDRESS_FORMAT_ETHEREUM: {
      encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
      hashFunction: "HASH_FUNCTION_KECCAK256",
      defaultAccounts: DEFAULT_ETHEREUM_ACCOUNTS,
      displayName: "Ethereum",
    },
    ADDRESS_FORMAT_SOLANA: {
      encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
      hashFunction: "HASH_FUNCTION_NOT_APPLICABLE",
      defaultAccounts: DEFAULT_SOLANA_ACCOUNTS,
      displayName: "Solana",
    },
    ADDRESS_FORMAT_COSMOS: {
      encoding: "PAYLOAD_ENCODING_TEXT_UTF8",
      hashFunction: "HASH_FUNCTION_SHA256",
      defaultAccounts: DEFAULT_COSMOS_ACCOUNTS,
      displayName: "Cosmos",
    },
    ADDRESS_FORMAT_TRON: {
      encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
      hashFunction: "HASH_FUNCTION_SHA256",
      defaultAccounts: DEFAULT_TRON_ACCOUNTS,
      displayName: "Tron",
    },
    ADDRESS_FORMAT_SUI: {
      encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
      hashFunction: "HASH_FUNCTION_NOT_APPLICABLE",
      defaultAccounts: DEFAULT_SUI_ACCOUNTS,
      displayName: "Sui",
    },
    ADDRESS_FORMAT_APTOS: {
      encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
      hashFunction: "HASH_FUNCTION_NOT_APPLICABLE",
      defaultAccounts: DEFAULT_APTOS_ACCOUNTS,
      displayName: "Aptos",
    },
    ADDRESS_FORMAT_BITCOIN_MAINNET_P2PKH: {
      encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
      hashFunction: "HASH_FUNCTION_SHA256",
      defaultAccounts: DEFAULT_BITCOIN_MAINNET_P2PKH_ACCOUNTS,
      displayName: "Bitcoin Mainnet P2PKH",
    },
    ADDRESS_FORMAT_BITCOIN_MAINNET_P2SH: {
      encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
      hashFunction: "HASH_FUNCTION_SHA256",
      defaultAccounts: DEFAULT_BITCOIN_MAINNET_P2SH_ACCOUNTS,
      displayName: "Bitcoin Mainnet P2SH",
    },
    ADDRESS_FORMAT_BITCOIN_MAINNET_P2WPKH: {
      encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
      hashFunction: "HASH_FUNCTION_SHA256",
      defaultAccounts: DEFAULT_BITCOIN_MAINNET_P2WPKH_ACCOUNTS,
      displayName: "Bitcoin Mainnet P2WPKH",
    },
    ADDRESS_FORMAT_BITCOIN_MAINNET_P2WSH: {
      encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
      hashFunction: "HASH_FUNCTION_SHA256",
      defaultAccounts: DEFAULT_BITCOIN_MAINNET_P2WSH_ACCOUNTS,
      displayName: "Bitcoin Mainnet P2WSH",
    },
    ADDRESS_FORMAT_BITCOIN_MAINNET_P2TR: {
      encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
      hashFunction: "HASH_FUNCTION_SHA256",
      defaultAccounts: DEFAULT_BITCOIN_MAINNET_P2TR_ACCOUNTS,
      displayName: "Bitcoin Mainnet P2TR",
    },
    ADDRESS_FORMAT_BITCOIN_TESTNET_P2PKH: {
      encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
      hashFunction: "HASH_FUNCTION_SHA256",
      defaultAccounts: DEFAULT_BITCOIN_TESTNET_P2PKH_ACCOUNTS,
      displayName: "Bitcoin Testnet P2PKH",
    },
    ADDRESS_FORMAT_BITCOIN_TESTNET_P2SH: {
      encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
      hashFunction: "HASH_FUNCTION_SHA256",
      defaultAccounts: DEFAULT_BITCOIN_TESTNET_P2SH_ACCOUNTS,
      displayName: "Bitcoin Testnet P2SH",
    },
    ADDRESS_FORMAT_BITCOIN_TESTNET_P2WPKH: {
      encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
      hashFunction: "HASH_FUNCTION_SHA256",
      defaultAccounts: DEFAULT_BITCOIN_TESTNET_P2WPKH_ACCOUNTS,
      displayName: "Bitcoin Testnet P2WPKH",
    },
    ADDRESS_FORMAT_BITCOIN_TESTNET_P2WSH: {
      encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
      hashFunction: "HASH_FUNCTION_SHA256",
      defaultAccounts: DEFAULT_BITCOIN_TESTNET_P2WSH_ACCOUNTS,
      displayName: "Bitcoin Testnet P2WSH",
    },
    ADDRESS_FORMAT_BITCOIN_TESTNET_P2TR: {
      encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
      hashFunction: "HASH_FUNCTION_SHA256",
      defaultAccounts: DEFAULT_BITCOIN_TESTNET_P2TR_ACCOUNTS,
      displayName: "Bitcoin Testnet P2TR",
    },
    ADDRESS_FORMAT_BITCOIN_SIGNET_P2PKH: {
      encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
      hashFunction: "HASH_FUNCTION_SHA256",
      defaultAccounts: DEFAULT_BITCOIN_SIGNET_P2PKH_ACCOUNTS,
      displayName: "Bitcoin Signet P2PKH",
    },
    ADDRESS_FORMAT_BITCOIN_SIGNET_P2SH: {
      encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
      hashFunction: "HASH_FUNCTION_SHA256",
      defaultAccounts: DEFAULT_BITCOIN_SIGNET_P2SH_ACCOUNTS,
      displayName: "Bitcoin Signet P2SH",
    },
    ADDRESS_FORMAT_BITCOIN_SIGNET_P2WPKH: {
      encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
      hashFunction: "HASH_FUNCTION_SHA256",
      defaultAccounts: DEFAULT_BITCOIN_SIGNET_P2WPKH_ACCOUNTS,
      displayName: "Bitcoin Signet P2WPKH",
    },
    ADDRESS_FORMAT_BITCOIN_SIGNET_P2WSH: {
      encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
      hashFunction: "HASH_FUNCTION_SHA256",
      defaultAccounts: DEFAULT_BITCOIN_SIGNET_P2WSH_ACCOUNTS,
      displayName: "Bitcoin Signet P2WSH",
    },
    ADDRESS_FORMAT_BITCOIN_SIGNET_P2TR: {
      encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
      hashFunction: "HASH_FUNCTION_SHA256",
      defaultAccounts: DEFAULT_BITCOIN_SIGNET_P2TR_ACCOUNTS,
      displayName: "Bitcoin Signet P2TR",
    },
    ADDRESS_FORMAT_BITCOIN_REGTEST_P2PKH: {
      encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
      hashFunction: "HASH_FUNCTION_SHA256",
      defaultAccounts: DEFAULT_BITCOIN_REGTEST_P2PKH_ACCOUNTS,
      displayName: "Bitcoin Regtest P2PKH",
    },
    ADDRESS_FORMAT_BITCOIN_REGTEST_P2SH: {
      encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
      hashFunction: "HASH_FUNCTION_SHA256",
      defaultAccounts: DEFAULT_BITCOIN_REGTEST_P2SH_ACCOUNTS,
      displayName: "Bitcoin Regtest P2SH",
    },
    ADDRESS_FORMAT_BITCOIN_REGTEST_P2WPKH: {
      encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
      hashFunction: "HASH_FUNCTION_SHA256",
      defaultAccounts: DEFAULT_BITCOIN_REGTEST_P2WPKH_ACCOUNTS,
      displayName: "Bitcoin Regtest P2WPKH",
    },
    ADDRESS_FORMAT_BITCOIN_REGTEST_P2WSH: {
      encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
      hashFunction: "HASH_FUNCTION_SHA256",
      defaultAccounts: DEFAULT_BITCOIN_REGTEST_P2WSH_ACCOUNTS,
      displayName: "Bitcoin Regtest P2WSH",
    },
    ADDRESS_FORMAT_BITCOIN_REGTEST_P2TR: {
      encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
      hashFunction: "HASH_FUNCTION_SHA256",
      defaultAccounts: DEFAULT_BITCOIN_REGTEST_P2TR_ACCOUNTS,
      displayName: "Bitcoin Regtest P2TR",
    },
    ADDRESS_FORMAT_SEI: {
      encoding: "PAYLOAD_ENCODING_TEXT_UTF8",
      hashFunction: "HASH_FUNCTION_SHA256",
      defaultAccounts: DEFAULT_SEI_ACCOUNTS,
      displayName: "Sei",
    },
    ADDRESS_FORMAT_XLM: {
      encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
      hashFunction: "HASH_FUNCTION_NOT_APPLICABLE",
      defaultAccounts: DEFAULT_XLM_ACCOUNTS,
      displayName: "Xlm",
    },
    ADDRESS_FORMAT_DOGE_MAINNET: {
      encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
      hashFunction: "HASH_FUNCTION_SHA256",
      defaultAccounts: DEFAULT_DOGE_MAINNET_ACCOUNTS,
      displayName: "Doge Mainnet",
    },
    ADDRESS_FORMAT_DOGE_TESTNET: {
      encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
      hashFunction: "HASH_FUNCTION_SHA256",
      defaultAccounts: DEFAULT_DOGE_TESTNET_ACCOUNTS,
      displayName: "Doge Testnet",
    },
    ADDRESS_FORMAT_TON_V3R2: {
      encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
      hashFunction: "HASH_FUNCTION_NOT_APPLICABLE",
      defaultAccounts: DEFAULT_TON_V3R2_ACCOUNTS,
      displayName: "Ton V3R2",
    },
    ADDRESS_FORMAT_TON_V4R2: {
      encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
      hashFunction: "HASH_FUNCTION_NOT_APPLICABLE",
      defaultAccounts: DEFAULT_TON_V4R2_ACCOUNTS,
      displayName: "Ton V4R2",
    },
    ADDRESS_FORMAT_TON_V5R1: {
      encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
      hashFunction: "HASH_FUNCTION_NOT_APPLICABLE",
      defaultAccounts: null,
      displayName: "Ton V5R1",
    },
    ADDRESS_FORMAT_XRP: {
      encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
      hashFunction: "HASH_FUNCTION_SHA256",
      defaultAccounts: DEFAULT_XRP_ACCOUNTS,
      displayName: "XRP",
    },
  };

export const googleISS = "https://accounts.google.com";

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
  i.toString(16).padStart(2, "0")
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
  date: Date = new Date()
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
      TurnkeyErrorCodes.INVALID_REQUEST
    );
  }
  return config.hashFunction;
}

export function getEncodingType(addressFormat: v1AddressFormat) {
  const config = addressFormatConfig[addressFormat];
  if (!config) {
    throw new TurnkeyError(
      `Unsupported address format: ${addressFormat}`,
      TurnkeyErrorCodes.INVALID_REQUEST
    );
  }
  return config.encoding;
}

export function getEncodedMessage(
  addressFormat: v1AddressFormat,
  rawMessage: string
): string {
  const config = addressFormatConfig[addressFormat];
  if (!config) {
    throw new TurnkeyError(
      `Unsupported address format: ${addressFormat}`,
      TurnkeyErrorCodes.INVALID_REQUEST
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

export const broadcastTransaction = async (params: {
  signedTransaction: string;
  rpcUrl: string;
  transactionType: v1TransactionType;
}): Promise<string> => {
  const { signedTransaction, rpcUrl, transactionType } = params;

  switch (transactionType) {
    case "TRANSACTION_TYPE_SOLANA": {
      const response = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "sendTransaction",
          params: [signedTransaction],
        }),
      });

      const json = await response.json();

      if (json.error) {
        throw new TurnkeyError(
          `Solana RPC Error: ${json.error.message}`,
          TurnkeyErrorCodes.SIGN_AND_SEND_TRANSACTION_ERROR
        );
      }

      return json.result;
    }

    case "TRANSACTION_TYPE_ETHEREUM": {
      const response = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "eth_sendRawTransaction",
          params: [signedTransaction],
        }),
      });

      const json = await response.json();

      if (json.error) {
        throw new TurnkeyError(
          `Ethereum RPC Error: ${json.error.message}`,
          TurnkeyErrorCodes.SIGN_AND_SEND_TRANSACTION_ERROR
        );
      }

      return json.result;
    }

    case "TRANSACTION_TYPE_TRON": {
      const response = await fetch(`${rpcUrl}/wallet/broadcasthex`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transaction: signedTransaction }),
      });

      const json = await response.json();

      if (!json.result) {
        throw new TurnkeyError(
          `Tron RPC Error: ${json.message}`,
          TurnkeyErrorCodes.SIGN_AND_SEND_TRANSACTION_ERROR
        );
      }

      return json.txid;
    }

    default:
      throw new TurnkeyError(
        `Unsupported transaction type for broadcasting: ${transactionType}`,
        TurnkeyErrorCodes.SIGN_AND_SEND_TRANSACTION_ERROR
      );
  }
};

export function splitSignature(
  signature: string,
  addressFormat: v1AddressFormat
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
        `Invalid Solana signature length: expected 64 bytes (128 hex), got ${hex.length}`
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
    `Unsupported address format or invalid signature length: ${hex.length}`
  );
}

// Type guard to check if accounts is WalletAccount[]
export function isWalletAccountArray(
  arr: any[]
): arr is v1WalletAccountParams[] {
  return (
    arr.length === 0 ||
    (typeof arr[0] === "object" &&
      "addressFormat" in arr[0] &&
      "curve" in arr[0] &&
      "path" in arr[0] &&
      "pathFormat" in arr[0])
  );
}

export function createWalletAccountFromAddressFormat(
  addressFormat: v1AddressFormat
): v1WalletAccountParams {
  const walletAccount = addressFormatConfig[addressFormat]?.defaultAccounts;
  if (!walletAccount) {
    throw new Error(`Unsupported address format: ${addressFormat}`);
  }

  if (walletAccount[0]) {
    return walletAccount[0];
  }

  throw new Error(
    `No default accounts defined for address format: ${addressFormat}`
  );
}

/**@internal */
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
      maxIndexMap.set(key, nextIndex);
    } else if (pathMap.has(account.path)) {
      nextIndex = pathMap.get(account.path)!;
    }

    const pathWithIndex = account.path.replace(
      /^((?:[^\/]*\/){3})(\d+)/,
      (_, prefix) => `${prefix}${nextIndex}`
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
          authenticator?.authenticatorName || `${websiteName}-${Date.now()}`,
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
    organizationName: createSubOrgParams?.subOrgName || `sub-org-${Date.now()}`,
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
      }`
    );
  }
}
/**@internal */
export function isEthereumProvider(
  provider: WalletProvider
): provider is WalletProvider & { chainInfo: EvmChainInfo } {
  return provider.chainInfo.namespace === Chain.Ethereum;
}

/**@internal */
export function isSolanaProvider(
  provider: WalletProvider
): provider is WalletProvider & { chainInfo: SolanaChainInfo } {
  return provider.chainInfo.namespace === Chain.Solana;
}

/** @internal */
export function getCurveTypeFromProvider(
  provider: WalletProvider
): "API_KEY_CURVE_SECP256K1" | "API_KEY_CURVE_ED25519" {
  if (isEthereumProvider(provider)) {
    return "API_KEY_CURVE_SECP256K1";
  }

  if (isSolanaProvider(provider)) {
    return "API_KEY_CURVE_ED25519";
  }

  // we should never hit this case
  // if we do then it means we added support for a new chain but missed updating this function
  throw new Error(
    `Unsupported provider namespace: ${provider.chainInfo.namespace}. Expected Ethereum or Solana.`
  );
}

/** @internal */
export function getSignatureSchemeFromProvider(provider: WalletProvider) {
  if (isEthereumProvider(provider)) {
    return "SIGNATURE_SCHEME_TK_API_SECP256K1_EIP191";
  }

  if (isSolanaProvider(provider)) {
    return "SIGNATURE_SCHEME_TK_API_ED25519";
  }

  // we should never hit this case
  // if we do then it means we added support for a new chain but missed updating this function
  throw new Error(
    `Unsupported provider namespace: ${provider.chainInfo.namespace}. Expected Ethereum or Solana.`
  );
}

/** @internal */
export function findWalletProviderFromAddress(
  address: string,
  providers: WalletProvider[]
): WalletProvider | undefined {
  for (const provider of providers) {
    if (provider.connectedAddresses.includes(address)) {
      return provider;
    }
  }

  // no provider found for that address
  return undefined;
}

/**
 * Derives a wallet address from a given public key and chain.
 *
 * @param chain - "ethereum" or "solana"
 * @param publicKey - The raw public key string
 * @returns The derived wallet address
 */
export function addressFromPublicKey(chain: Chain, publicKey: string): string {
  if (chain === Chain.Ethereum) {
    const compressedBytes = uint8ArrayFromHexString(publicKey);

    const publicKeyUncompressed = uint8ArrayToHexString(
      uncompressRawPublicKey(compressedBytes, Curve.SECP256K1)
    );

    // drop 04 prefix
    const key = publicKeyUncompressed.startsWith("04")
      ? publicKeyUncompressed.slice(2)
      : publicKeyUncompressed;

    // hash with Keccak256 and take last 20 bytes
    const hash = keccak256(uint8ArrayFromHexString(key));
    return "0x" + hash.slice(-40);
  }

  if (chain === Chain.Solana) {
    return bs58.encode(uint8ArrayFromHexString(publicKey));
  }

  throw new Error(`Unsupported chain: ${chain}`);
}

/**@internal */
export function getAuthenticatorAddresses(user: v1User) {
  const ethereum: string[] = [];
  const solana: string[] = [];

  for (const key of user.apiKeys) {
    const { type, publicKey } = key.credential;
    switch (type) {
      case "CREDENTIAL_TYPE_API_KEY_SECP256K1":
        ethereum.push(addressFromPublicKey(Chain.Ethereum, publicKey));
        break;
      case "CREDENTIAL_TYPE_API_KEY_ED25519":
        solana.push(addressFromPublicKey(Chain.Solana, publicKey));
        break;
    }
  }

  return { ethereum, solana };
}

/**@internal */
export async function getAuthProxyConfig(
  authProxyConfigId: string,
  authProxyUrl?: string | undefined
): Promise<ProxyTGetWalletKitConfigResponse> {
  const fullUrl =
    (authProxyUrl ?? "https://authproxy.turnkey.com") + "/v1/wallet_kit_config";

  var headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Auth-Proxy-Config-ID": authProxyConfigId,
  };

  const response = await fetch(fullUrl, {
    method: "POST",
    headers: headers,
  });

  if (!response.ok) {
    let res: GrpcStatus;
    try {
      res = await response.json();
    } catch (_) {
      throw new Error(`${response.status} ${response.statusText}`);
    }

    throw new TurnkeyRequestError(res);
  }

  const data = await response.json();
  return data as ProxyTGetWalletKitConfigResponse;
}

/**
 * @internal
 * Executes an async function with error handling.
 *
 * @param fn The async function to execute with error handling
 * @param errorOptions Options for customizing error handling
 * @param errorOptions.catchFn Optional function to execute in the catch block
 * @param errorOptions.errorMessage The default error message to use if no custom message is found
 * @param errorOptions.errorCode The default error code to use if no custom message is found
 * @param errorOptions.customMessageByCodes Optional mapping of error codes to custom messages, if you're trying to target a specific error code and surface a custom message, use this
 * @param errorOptions.customMessageByMessages Optional mapping of error messages to custom messages, if you're trying to target a specific error message and surface a custom message, use this
 * @param finallyFn Optional function to execute in the finally block
 * @returns The result of the async function or throws an error
 */
export async function withTurnkeyErrorHandling<T>(
  fn: () => Promise<T>,
  catchOptions: {
    catchFn?: () => Promise<void>;
    errorMessage: string;
    errorCode: TurnkeyErrorCodes;
    customMessageByCodes?: Partial<
      Record<TurnkeyErrorCodes, { message: string; code: TurnkeyErrorCodes }>
    >;
    customMessageByMessages?: Record<
      string,
      { message: string; code: TurnkeyErrorCodes }
    >;
  },
  finallyOptions?: {
    finallyFn: () => Promise<void>;
  }
): Promise<T> {
  const {
    errorMessage,
    errorCode,
    customMessageByCodes,
    customMessageByMessages,
    catchFn,
  } = catchOptions;
  const finallyFn = finallyOptions?.finallyFn;
  try {
    return await fn();
  } catch (error) {
    await catchFn?.();
    if (error instanceof TurnkeyError) {
      const customCodeMessage = customMessageByCodes?.[error.code!];
      if (customCodeMessage) {
        throw new TurnkeyError(
          customCodeMessage.message,
          customCodeMessage.code,
          error
        );
      }
      throwMatchingMessage(error.message, customMessageByMessages, error);

      throw error;
    } else if (error instanceof TurnkeyRequestError) {
      throwMatchingMessage(error.message, customMessageByMessages, error);

      throw new TurnkeyError(errorMessage, errorCode, error);
    } else if (error instanceof Error) {
      throwMatchingMessage(error.message, customMessageByMessages, error);

      // Wrap other errors in a TurnkeyError
      throw new TurnkeyError(errorMessage, errorCode, error);
    } else {
      throwMatchingMessage(String(error), customMessageByMessages, error);
      // Handle non-Error exceptions
      throw new TurnkeyError(String(error), errorCode, error);
    }
  } finally {
    await finallyFn?.();
  }
}

/**
 * Throws a TurnkeyError with a custom message if the error message matches any key in customMessageByMessages.
 * If no match is found, it does nothing.
 *
 * @param errorMessage The error message to check against the custom messages.
 * @param customMessageByMessages An object mapping error messages to custom messages and codes.
 * @param error The original error that triggered this function.
 */
const throwMatchingMessage = (
  errorMessage: string,
  customMessageByMessages:
    | Record<string, { message: string; code: TurnkeyErrorCodes }>
    | undefined,
  error: any
) => {
  if (
    customMessageByMessages &&
    Object.keys(customMessageByMessages).length > 0
  ) {
    Object.keys(customMessageByMessages).forEach((key) => {
      if (errorMessage.includes(key)) {
        throw new TurnkeyError(
          customMessageByMessages[key]!.message,
          customMessageByMessages[key]!.code,
          error
        );
      }
    });
  }
};

/**
 * @internal
 *
 * Asserts that the provided key pair is a valid P-256 ECDSA key pair.
 * @param pair The key pair to validate.
 */
export async function assertValidP256ECDSAKeyPair(
  pair: CryptoKeyPair
): Promise<void> {
  const { privateKey, publicKey } = pair;

  // Check basic shape
  if (!(privateKey instanceof CryptoKey) || !(publicKey instanceof CryptoKey)) {
    throw new TurnkeyError(
      "Both keys must be CryptoKey instances.",
      TurnkeyErrorCodes.INVALID_REQUEST
    );
  }
  if (privateKey.type !== "private")
    throw new TurnkeyError(
      "privateKey.type must be 'private'.",
      TurnkeyErrorCodes.INVALID_REQUEST
    );
  if (publicKey.type !== "public")
    throw new TurnkeyError(
      "publicKey.type must be 'public'.",
      TurnkeyErrorCodes.INVALID_REQUEST
    );

  // Verify extractability and usages
  if (privateKey.extractable !== false) {
    throw new TurnkeyError(
      "Provided privateKey must be non-extractable.",
      TurnkeyErrorCodes.INVALID_REQUEST
    );
  }
  if (!privateKey.usages.includes("sign")) {
    throw new TurnkeyError(
      "privateKey must have 'sign' in keyUsages.",
      TurnkeyErrorCodes.INVALID_REQUEST
    );
  }
  if (!publicKey.usages.includes("verify")) {
    throw new TurnkeyError(
      "publicKey must have 'verify' in keyUsages.",
      TurnkeyErrorCodes.INVALID_REQUEST
    );
  }

  // Algorithm checks (must be ECDSA on P-256)
  const pAlg = privateKey.algorithm as EcKeyAlgorithm;
  const pubAlg = publicKey.algorithm as EcKeyAlgorithm;
  if (pAlg.name !== "ECDSA" || pubAlg.name !== "ECDSA") {
    throw new TurnkeyError(
      "Keys must be ECDSA keys.",
      TurnkeyErrorCodes.INVALID_REQUEST
    );
  }
  if (pAlg.namedCurve !== "P-256" || pubAlg.namedCurve !== "P-256") {
    throw new TurnkeyError(
      "Keys must be on the P-256 curve.",
      TurnkeyErrorCodes.INVALID_REQUEST
    );
  }

  // Public key export sanity (should be uncompressed 65 bytes starting with 0x04)
  const rawPub = new Uint8Array(
    await crypto.subtle.exportKey("raw", publicKey)
  );
  if (rawPub.length !== 65 || rawPub[0] !== 0x04) {
    throw new TurnkeyError(
      "Public key must be an uncompressed P-256 point (65 bytes, leading 0x04).",
      TurnkeyErrorCodes.INVALID_REQUEST
    );
  }

  // Prove the pair matches: sign→verify a test message
  const msg = crypto.getRandomValues(new Uint8Array(32));
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    msg
  );
  const ok = await crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    publicKey,
    sig,
    msg
  );
  if (!ok) {
    throw new TurnkeyError(
      "publicKey does not match privateKey (verify failed).",
      TurnkeyErrorCodes.INVALID_REQUEST
    );
  }
}

export function isValidPasskeyName(name: string): string {
  const nameRegex = isReactNative()
    ? /^[a-zA-Z0-9 _\-:\/\.]{1,64}$/
    : /^[a-zA-Z0-9 _\-:\/\.]+$/;
  if (!nameRegex.test(name)) {
    throw new TurnkeyError(
      "Passkey name must be 1-64 characters and only contain letters, numbers, spaces, dashes, underscores, colons, or slashes.",
      TurnkeyErrorCodes.INVALID_REQUEST
    );
  }
  return name;
}

// ----------------------------
// CURVE_SECP256K1 Accounts
// ----------------------------

import type {
  v1AddressFormat,
  v1HashFunction,
  v1PayloadEncoding,
  v1WalletAccount,
  v1WalletAccountParams,
} from "@turnkey/sdk-types";

// Ethereum
export const defaultEthereumAccountAtIndex = (
  pathIndex: number,
): v1WalletAccountParams => {
  return {
    curve: "CURVE_SECP256K1",
    pathFormat: "PATH_FORMAT_BIP32",
    path: `m/44'/60'/${pathIndex}'/0/0`,
    addressFormat: "ADDRESS_FORMAT_ETHEREUM",
  };
};

export const DEFAULT_ETHEREUM_ACCOUNTS: v1WalletAccountParams[] = [
  defaultEthereumAccountAtIndex(0),
];

// Cosmos
export const defaultCosmosAccountAtIndex = (
  pathIndex: number,
): v1WalletAccountParams => {
  return {
    curve: "CURVE_SECP256K1",
    pathFormat: "PATH_FORMAT_BIP32",
    path: `m/44'/118'/${pathIndex}'/0/0`,
    addressFormat: "ADDRESS_FORMAT_COSMOS",
  };
};

export const DEFAULT_COSMOS_ACCOUNTS: v1WalletAccountParams[] = [
  defaultCosmosAccountAtIndex(0),
];

// Tron
export const defaultTronAccountAtIndex = (
  pathIndex: number,
): v1WalletAccountParams => {
  return {
    curve: "CURVE_SECP256K1",
    pathFormat: "PATH_FORMAT_BIP32",
    path: `m/44'/195'/${pathIndex}'`,
    addressFormat: "ADDRESS_FORMAT_TRON",
  };
};

export const DEFAULT_TRON_ACCOUNTS: v1WalletAccountParams[] = [
  defaultTronAccountAtIndex(0),
];

// Bitcoin Mainnet P2PKH
export const defaultBitcoinMainnetP2PKHAccountAtIndex = (
  pathIndex: number,
): v1WalletAccountParams => {
  return {
    curve: "CURVE_SECP256K1",
    pathFormat: "PATH_FORMAT_BIP32",
    path: `m/44'/0'/${pathIndex}'/0/0`,
    addressFormat: "ADDRESS_FORMAT_BITCOIN_MAINNET_P2PKH",
  };
};

export const DEFAULT_BITCOIN_MAINNET_P2PKH_ACCOUNTS: v1WalletAccountParams[] = [
  defaultBitcoinMainnetP2PKHAccountAtIndex(0),
];

// Bitcoin Mainnet P2WPKH
export const defaultBitcoinMainnetP2WPKHAccountAtIndex = (
  pathIndex: number,
): v1WalletAccountParams => {
  return {
    curve: "CURVE_SECP256K1",
    pathFormat: "PATH_FORMAT_BIP32",
    path: `m/84'/0'/${pathIndex}'/0/0`,
    addressFormat: "ADDRESS_FORMAT_BITCOIN_MAINNET_P2WPKH",
  };
};

export const DEFAULT_BITCOIN_MAINNET_P2WPKH_ACCOUNTS: v1WalletAccountParams[] =
  [defaultBitcoinMainnetP2WPKHAccountAtIndex(0)];

// Bitcoin Mainnet P2WSH
export const defaultBitcoinMainnetP2WSHAccountAtIndex = (
  pathIndex: number,
): v1WalletAccountParams => {
  return {
    curve: "CURVE_SECP256K1",
    pathFormat: "PATH_FORMAT_BIP32",
    path: `m/48'/0'/${pathIndex}'/2'/0/0`,
    addressFormat: "ADDRESS_FORMAT_BITCOIN_MAINNET_P2WSH",
  };
};

export const DEFAULT_BITCOIN_MAINNET_P2WSH_ACCOUNTS: v1WalletAccountParams[] = [
  defaultBitcoinMainnetP2WSHAccountAtIndex(0),
];

// Bitcoin Mainnet P2TR
export const defaultBitcoinMainnetP2TRAccountAtIndex = (
  pathIndex: number,
): v1WalletAccountParams => {
  return {
    curve: "CURVE_SECP256K1",
    pathFormat: "PATH_FORMAT_BIP32",
    path: `m/86'/0'/${pathIndex}'/0/0`,
    addressFormat: "ADDRESS_FORMAT_BITCOIN_MAINNET_P2TR",
  };
};

export const DEFAULT_BITCOIN_MAINNET_P2TR_ACCOUNTS: v1WalletAccountParams[] = [
  defaultBitcoinMainnetP2TRAccountAtIndex(0),
];

// Bitcoin Mainnet P2SH
export const defaultBitcoinMainnetP2SHAccountAtIndex = (
  pathIndex: number,
): v1WalletAccountParams => {
  return {
    curve: "CURVE_SECP256K1",
    pathFormat: "PATH_FORMAT_BIP32",
    path: `m/44'/0'/${pathIndex}'/0/0`,
    addressFormat: "ADDRESS_FORMAT_BITCOIN_MAINNET_P2SH",
  };
};

export const DEFAULT_BITCOIN_MAINNET_P2SH_ACCOUNTS: v1WalletAccountParams[] = [
  defaultBitcoinMainnetP2SHAccountAtIndex(0),
];

// Bitcoin Testnet P2PKH
export const defaultBitcoinTestnetP2PKHAccountAtIndex = (
  pathIndex: number,
): v1WalletAccountParams => {
  return {
    curve: "CURVE_SECP256K1",
    pathFormat: "PATH_FORMAT_BIP32",
    path: `m/44'/1'/${pathIndex}'/0/0`,
    addressFormat: "ADDRESS_FORMAT_BITCOIN_TESTNET_P2PKH",
  };
};

export const DEFAULT_BITCOIN_TESTNET_P2PKH_ACCOUNTS: v1WalletAccountParams[] = [
  defaultBitcoinTestnetP2PKHAccountAtIndex(0),
];

// Bitcoin Testnet P2WPKH
export const defaultBitcoinTestnetP2WPKHAccountAtIndex = (
  pathIndex: number,
): v1WalletAccountParams => {
  return {
    curve: "CURVE_SECP256K1",
    pathFormat: "PATH_FORMAT_BIP32",
    path: `m/84'/1'/${pathIndex}'/0/0`,
    addressFormat: "ADDRESS_FORMAT_BITCOIN_TESTNET_P2WPKH",
  };
};

export const DEFAULT_BITCOIN_TESTNET_P2WPKH_ACCOUNTS: v1WalletAccountParams[] =
  [defaultBitcoinTestnetP2WPKHAccountAtIndex(0)];

// Bitcoin Testnet P2WSH
export const defaultBitcoinTestnetP2WSHAccountAtIndex = (
  pathIndex: number,
): v1WalletAccountParams => {
  return {
    curve: "CURVE_SECP256K1",
    pathFormat: "PATH_FORMAT_BIP32",
    path: `m/48'/1'/${pathIndex}'/2'/0/0`,
    addressFormat: "ADDRESS_FORMAT_BITCOIN_TESTNET_P2WSH",
  };
};

export const DEFAULT_BITCOIN_TESTNET_P2WSH_ACCOUNTS: v1WalletAccountParams[] = [
  defaultBitcoinTestnetP2WSHAccountAtIndex(0),
];

// Bitcoin Testnet P2TR
export const defaultBitcoinTestnetP2TRAccountAtIndex = (
  pathIndex: number,
): v1WalletAccountParams => {
  return {
    curve: "CURVE_SECP256K1",
    pathFormat: "PATH_FORMAT_BIP32",
    path: `m/86'/1'/${pathIndex}'/0/0`,
    addressFormat: "ADDRESS_FORMAT_BITCOIN_TESTNET_P2TR",
  };
};

export const DEFAULT_BITCOIN_TESTNET_P2TR_ACCOUNTS: v1WalletAccountParams[] = [
  defaultBitcoinTestnetP2TRAccountAtIndex(0),
];

// Bitcoin Testnet P2SH
export const defaultBitcoinTestnetP2SHAccountAtIndex = (
  pathIndex: number,
): v1WalletAccountParams => {
  return {
    curve: "CURVE_SECP256K1",
    pathFormat: "PATH_FORMAT_BIP32",
    path: `m/44'/1'/${pathIndex}'/0/0`,
    addressFormat: "ADDRESS_FORMAT_BITCOIN_TESTNET_P2SH",
  };
};

export const DEFAULT_BITCOIN_TESTNET_P2SH_ACCOUNTS: v1WalletAccountParams[] = [
  defaultBitcoinTestnetP2SHAccountAtIndex(0),
];

// Bitcoin Signet P2PKH
export const defaultBitcoinSignetP2PKHAccountAtIndex = (
  pathIndex: number,
): v1WalletAccountParams => {
  return {
    curve: "CURVE_SECP256K1",
    pathFormat: "PATH_FORMAT_BIP32",
    path: `m/44'/1'/${pathIndex}'/0/0`,
    addressFormat: "ADDRESS_FORMAT_BITCOIN_SIGNET_P2PKH",
  };
};

export const DEFAULT_BITCOIN_SIGNET_P2PKH_ACCOUNTS: v1WalletAccountParams[] = [
  defaultBitcoinSignetP2PKHAccountAtIndex(0),
];

// Bitcoin Signet P2WPKH
export const defaultBitcoinSignetP2WPKHAccountAtIndex = (
  pathIndex: number,
): v1WalletAccountParams => {
  return {
    curve: "CURVE_SECP256K1",
    pathFormat: "PATH_FORMAT_BIP32",
    path: `m/84'/1'/${pathIndex}'/0/0`,
    addressFormat: "ADDRESS_FORMAT_BITCOIN_SIGNET_P2WPKH",
  };
};

export const DEFAULT_BITCOIN_SIGNET_P2WPKH_ACCOUNTS: v1WalletAccountParams[] = [
  defaultBitcoinSignetP2WPKHAccountAtIndex(0),
];

// Bitcoin Signet P2WSH
export const defaultBitcoinSignetP2WSHAccountAtIndex = (
  pathIndex: number,
): v1WalletAccountParams => {
  return {
    curve: "CURVE_SECP256K1",
    pathFormat: "PATH_FORMAT_BIP32",
    path: `m/48'/1'/${pathIndex}'/2'/0/0`,
    addressFormat: "ADDRESS_FORMAT_BITCOIN_SIGNET_P2WSH",
  };
};

export const DEFAULT_BITCOIN_SIGNET_P2WSH_ACCOUNTS: v1WalletAccountParams[] = [
  defaultBitcoinSignetP2WSHAccountAtIndex(0),
];

// Bitcoin Signet P2TR
export const defaultBitcoinSignetP2TRAccountAtIndex = (
  pathIndex: number,
): v1WalletAccountParams => {
  return {
    curve: "CURVE_SECP256K1",
    pathFormat: "PATH_FORMAT_BIP32",
    path: `m/86'/1'/${pathIndex}'/0/0`,
    addressFormat: "ADDRESS_FORMAT_BITCOIN_SIGNET_P2TR",
  };
};

export const DEFAULT_BITCOIN_SIGNET_P2TR_ACCOUNTS: v1WalletAccountParams[] = [
  defaultBitcoinSignetP2TRAccountAtIndex(0),
];

// Bitcoin Signet P2SH
export const defaultBitcoinSignetP2SHAccountAtIndex = (
  pathIndex: number,
): v1WalletAccountParams => {
  return {
    curve: "CURVE_SECP256K1",
    pathFormat: "PATH_FORMAT_BIP32",
    path: `m/44'/1'/${pathIndex}'/0/0`,
    addressFormat: "ADDRESS_FORMAT_BITCOIN_SIGNET_P2SH",
  };
};

export const DEFAULT_BITCOIN_SIGNET_P2SH_ACCOUNTS: v1WalletAccountParams[] = [
  defaultBitcoinSignetP2SHAccountAtIndex(0),
];

// Bitcoin Regtest P2PKH
export const defaultBitcoinRegtestP2PKHAccountAtIndex = (
  pathIndex: number,
): v1WalletAccountParams => {
  return {
    curve: "CURVE_SECP256K1",
    pathFormat: "PATH_FORMAT_BIP32",
    path: `m/44'/1'/${pathIndex}'/0/0`,
    addressFormat: "ADDRESS_FORMAT_BITCOIN_REGTEST_P2PKH",
  };
};

export const DEFAULT_BITCOIN_REGTEST_P2PKH_ACCOUNTS: v1WalletAccountParams[] = [
  defaultBitcoinRegtestP2PKHAccountAtIndex(0),
];

// Bitcoin Regtest P2WPKH
export const defaultBitcoinRegtestP2WPKHAccountAtIndex = (
  pathIndex: number,
): v1WalletAccountParams => {
  return {
    curve: "CURVE_SECP256K1",
    pathFormat: "PATH_FORMAT_BIP32",
    path: `m/84'/1'/${pathIndex}'/0/0`,
    addressFormat: "ADDRESS_FORMAT_BITCOIN_REGTEST_P2WPKH",
  };
};

export const DEFAULT_BITCOIN_REGTEST_P2WPKH_ACCOUNTS: v1WalletAccountParams[] =
  [defaultBitcoinRegtestP2WPKHAccountAtIndex(0)];

// Bitcoin Regtest P2WSH
export const defaultBitcoinRegtestP2WSHAccountAtIndex = (
  pathIndex: number,
): v1WalletAccountParams => {
  return {
    curve: "CURVE_SECP256K1",
    pathFormat: "PATH_FORMAT_BIP32",
    path: `m/48'/1'/${pathIndex}'/2'/0/0`,
    addressFormat: "ADDRESS_FORMAT_BITCOIN_REGTEST_P2WSH",
  };
};

export const DEFAULT_BITCOIN_REGTEST_P2WSH_ACCOUNTS: v1WalletAccountParams[] = [
  defaultBitcoinRegtestP2WSHAccountAtIndex(0),
];

// Bitcoin Regtest P2TR
export const defaultBitcoinRegtestP2TRAccountAtIndex = (
  pathIndex: number,
): v1WalletAccountParams => {
  return {
    curve: "CURVE_SECP256K1",
    pathFormat: "PATH_FORMAT_BIP32",
    path: `m/86'/1'/${pathIndex}'/0/0`,
    addressFormat: "ADDRESS_FORMAT_BITCOIN_REGTEST_P2TR",
  };
};

export const DEFAULT_BITCOIN_REGTEST_P2TR_ACCOUNTS: v1WalletAccountParams[] = [
  defaultBitcoinRegtestP2TRAccountAtIndex(0),
];

// Bitcoin Regtest P2SH
export const defaultBitcoinRegtestP2SHAccountAtIndex = (
  pathIndex: number,
): v1WalletAccountParams => {
  return {
    curve: "CURVE_SECP256K1",
    pathFormat: "PATH_FORMAT_BIP32",
    path: `m/44'/1'/${pathIndex}'/0/0`,
    addressFormat: "ADDRESS_FORMAT_BITCOIN_REGTEST_P2SH",
  };
};

export const DEFAULT_BITCOIN_REGTEST_P2SH_ACCOUNTS: v1WalletAccountParams[] = [
  defaultBitcoinRegtestP2SHAccountAtIndex(0),
];

// Dogecoin Mainnet
export const defaultDogeMainnetAccountAtIndex = (
  pathIndex: number,
): v1WalletAccountParams => {
  return {
    curve: "CURVE_SECP256K1",
    pathFormat: "PATH_FORMAT_BIP32",
    path: `m/44'/3'/${pathIndex}'/0/0`,
    addressFormat: "ADDRESS_FORMAT_DOGE_MAINNET",
  };
};

export const DEFAULT_DOGE_MAINNET_ACCOUNTS: v1WalletAccountParams[] = [
  defaultDogeMainnetAccountAtIndex(0),
];

// Dogecoin Testnet
export const defaultDogeTestnetAccountAtIndex = (
  pathIndex: number,
): v1WalletAccountParams => {
  return {
    curve: "CURVE_SECP256K1",
    pathFormat: "PATH_FORMAT_BIP32",
    path: `m/44'/3'/${pathIndex}'/0/0`,
    addressFormat: "ADDRESS_FORMAT_DOGE_TESTNET",
  };
};

export const DEFAULT_DOGE_TESTNET_ACCOUNTS: v1WalletAccountParams[] = [
  defaultDogeTestnetAccountAtIndex(0),
];

// Sei
export const defaultSeiAccountAtIndex = (
  pathIndex: number,
): v1WalletAccountParams => {
  return {
    curve: "CURVE_SECP256K1",
    pathFormat: "PATH_FORMAT_BIP32",
    path: `m/44'/118'/${pathIndex}'/0'/0'`,
    addressFormat: "ADDRESS_FORMAT_SEI",
  };
};

export const DEFAULT_SEI_ACCOUNTS: v1WalletAccountParams[] = [
  defaultSeiAccountAtIndex(0),
];

// Xrp
export const defaultXrpAccountAtIndex = (
  pathIndex: number,
): v1WalletAccountParams => {
  return {
    curve: "CURVE_SECP256K1",
    pathFormat: "PATH_FORMAT_BIP32",
    path: `m/44'/144'/${pathIndex}'/0'/0'`,
    addressFormat: "ADDRESS_FORMAT_XRP",
  };
};

export const DEFAULT_XRP_ACCOUNTS: v1WalletAccountParams[] = [
  defaultXrpAccountAtIndex(0),
];

// ----------------------------
// CURVE_ED25519 Accounts
// ----------------------------

// Solana
export const defaultSolanaAccountAtIndex = (
  pathIndex: number,
): v1WalletAccountParams => {
  return {
    curve: "CURVE_ED25519",
    pathFormat: "PATH_FORMAT_BIP32",
    path: `m/44'/501'/${pathIndex}'/0'`,
    addressFormat: "ADDRESS_FORMAT_SOLANA",
  };
};

export const DEFAULT_SOLANA_ACCOUNTS: v1WalletAccountParams[] = [
  defaultSolanaAccountAtIndex(0),
];

// SUI
export const defaultSuiAccountAtIndex = (
  pathIndex: number,
): v1WalletAccountParams => {
  return {
    curve: "CURVE_ED25519",
    pathFormat: "PATH_FORMAT_BIP32",
    path: `m/44'/784'/${pathIndex}'/0'/0'`,
    addressFormat: "ADDRESS_FORMAT_SUI",
  };
};

export const DEFAULT_SUI_ACCOUNTS: v1WalletAccountParams[] = [
  defaultSuiAccountAtIndex(0),
];

// Aptos
export const defaultAptosAccountAtIndex = (
  pathIndex: number,
): v1WalletAccountParams => {
  return {
    curve: "CURVE_ED25519",
    pathFormat: "PATH_FORMAT_BIP32",
    path: `m/44'/637'/${pathIndex}'/0'/0'`,
    addressFormat: "ADDRESS_FORMAT_APTOS",
  };
};

export const DEFAULT_APTOS_ACCOUNTS: v1WalletAccountParams[] = [
  defaultAptosAccountAtIndex(0),
];

// Stellar (XLM)
export const defaultXlmAccountAtIndex = (
  pathIndex: number,
): v1WalletAccountParams => {
  return {
    curve: "CURVE_ED25519",
    pathFormat: "PATH_FORMAT_BIP32",
    path: `m/44'/148'/${pathIndex}'`,
    addressFormat: "ADDRESS_FORMAT_XLM",
  };
};

export const DEFAULT_XLM_ACCOUNTS: v1WalletAccountParams[] = [
  defaultXlmAccountAtIndex(0),
];

// TON V3R2
export const defaultTonV3r2AccountAtIndex = (
  pathIndex: number,
): v1WalletAccountParams => {
  return {
    curve: "CURVE_ED25519",
    pathFormat: "PATH_FORMAT_BIP32",
    path: `m/44'/607'/${pathIndex}'/0'/0'`,
    addressFormat: "ADDRESS_FORMAT_TON_V3R2",
  };
};

export const DEFAULT_TON_V3R2_ACCOUNTS: v1WalletAccountParams[] = [
  defaultTonV3r2AccountAtIndex(0),
];

// TON V4R2
export const defaultTonV4r2AccountAtIndex = (
  pathIndex: number,
): v1WalletAccountParams => {
  return {
    curve: "CURVE_ED25519",
    pathFormat: "PATH_FORMAT_BIP32",
    path: `m/44'/607'/${pathIndex}'/0'/0'`,
    addressFormat: "ADDRESS_FORMAT_TON_V4R2",
  };
};

export const DEFAULT_TON_V4R2_ACCOUNTS: v1WalletAccountParams[] = [
  defaultTonV4r2AccountAtIndex(0),
];

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
      (_, prefix) => `${prefix}${nextIndex}`,
    );
    pathMap.set(account.path, nextIndex + 1);

    return {
      ...account,
      path: pathWithIndex,
    } as v1WalletAccountParams;
  });
}

export function createWalletAccountFromAddressFormat(
  addressFormat: v1AddressFormat,
): v1WalletAccountParams {
  const config = addressFormatConfig[addressFormat];
  if (!config) {
    throw new Error(`Unsupported address format: ${addressFormat}`);
  }

  const defaultAccounts = config.defaultAccounts;
  if (!defaultAccounts || defaultAccounts.length === 0 || !defaultAccounts[0]) {
    throw new Error(
      `No default accounts defined for address format: ${addressFormat}`,
    );
  }

  return defaultAccounts[0];
}

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
 * import { addressFormatConfig } from "@turnkey/sdk-server";
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

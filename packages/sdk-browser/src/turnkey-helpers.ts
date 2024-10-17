interface WalletAccount {
  curve: "CURVE_SECP256K1" | "CURVE_ED25519";
  pathFormat: "PATH_FORMAT_BIP32";
  path: string;
  addressFormat:
    | "ADDRESS_FORMAT_ETHEREUM"
    | "ADDRESS_FORMAT_UNCOMPRESSED"
    | "ADDRESS_FORMAT_COMPRESSED"
    | "ADDRESS_FORMAT_SOLANA"
    | "ADDRESS_FORMAT_COSMOS"
    | "ADDRESS_FORMAT_TRON"
    | "ADDRESS_FORMAT_SEI"
    | "ADDRESS_FORMAT_XLM"
    | "ADDRESS_FORMAT_BITCOIN_MAINNET_P2PKH"
    | "ADDRESS_FORMAT_BITCOIN_MAINNET_P2WPKH"
    | "ADDRESS_FORMAT_BITCOIN_MAINNET_P2WSH"
    | "ADDRESS_FORMAT_BITCOIN_MAINNET_P2TR"
    | "ADDRESS_FORMAT_BITCOIN_MAINNET_P2SH"
    | "ADDRESS_FORMAT_BITCOIN_TESTNET_P2PKH"
    | "ADDRESS_FORMAT_BITCOIN_TESTNET_P2WPKH"
    | "ADDRESS_FORMAT_BITCOIN_TESTNET_P2WSH"
    | "ADDRESS_FORMAT_BITCOIN_TESTNET_P2TR"
    | "ADDRESS_FORMAT_BITCOIN_TESTNET_P2SH"
    | "ADDRESS_FORMAT_BITCOIN_SIGNET_P2PKH"
    | "ADDRESS_FORMAT_BITCOIN_SIGNET_P2WPKH"
    | "ADDRESS_FORMAT_BITCOIN_SIGNET_P2WSH"
    | "ADDRESS_FORMAT_BITCOIN_SIGNET_P2TR"
    | "ADDRESS_FORMAT_BITCOIN_SIGNET_P2SH"
    | "ADDRESS_FORMAT_BITCOIN_REGTEST_P2PKH"
    | "ADDRESS_FORMAT_BITCOIN_REGTEST_P2WPKH"
    | "ADDRESS_FORMAT_BITCOIN_REGTEST_P2WSH"
    | "ADDRESS_FORMAT_BITCOIN_REGTEST_P2TR"
    | "ADDRESS_FORMAT_BITCOIN_REGTEST_P2SH"
    | "ADDRESS_FORMAT_DOGE_MAINNET"
    | "ADDRESS_FORMAT_DOGE_TESTNET"
    | "ADDRESS_FORMAT_SUI"
    | "ADDRESS_FORMAT_APTOS"
    | "ADDRESS_FORMAT_TON_V3R2"
    | "ADDRESS_FORMAT_TON_V4R2";
}

// ----------------------------
// CURVE_SECP256K1 Accounts
// ----------------------------

// Ethereum
export const defaultEthereumAccountAtIndex = (
  pathIndex: number
): WalletAccount => {
  return {
    curve: "CURVE_SECP256K1",
    pathFormat: "PATH_FORMAT_BIP32",
    path: `m/44'/60'/${pathIndex}'/0/0`,
    addressFormat: "ADDRESS_FORMAT_ETHEREUM",
  };
};

export const DEFAULT_ETHEREUM_ACCOUNTS: WalletAccount[] = [
  defaultEthereumAccountAtIndex(0),
];

// Cosmos
export const defaultCosmosAccountAtIndex = (
  pathIndex: number
): WalletAccount => {
  return {
    curve: "CURVE_SECP256K1",
    pathFormat: "PATH_FORMAT_BIP32",
    path: `m/44'/118'/${pathIndex}'/0/0`,
    addressFormat: "ADDRESS_FORMAT_COSMOS",
  };
};

export const DEFAULT_COSMOS_ACCOUNTS: WalletAccount[] = [
  defaultCosmosAccountAtIndex(0),
];

// Tron
export const defaultTronAccountAtIndex = (pathIndex: number): WalletAccount => {
  return {
    curve: "CURVE_SECP256K1",
    pathFormat: "PATH_FORMAT_BIP32",
    path: `m/44'/195'/${pathIndex}'`,
    addressFormat: "ADDRESS_FORMAT_TRON",
  };
};

export const DEFAULT_TRON_ACCOUNTS: WalletAccount[] = [
  defaultTronAccountAtIndex(0),
];

// Bitcoin Mainnet P2PKH
export const defaultBitcoinMainnetP2PKHAccountAtIndex = (
  pathIndex: number
): WalletAccount => {
  return {
    curve: "CURVE_SECP256K1",
    pathFormat: "PATH_FORMAT_BIP32",
    path: `m/44'/0'/${pathIndex}'/0/0`,
    addressFormat: "ADDRESS_FORMAT_BITCOIN_MAINNET_P2PKH",
  };
};

export const DEFAULT_BITCOIN_MAINNET_P2PKH_ACCOUNTS: WalletAccount[] = [
  defaultBitcoinMainnetP2PKHAccountAtIndex(0),
];

// Bitcoin Mainnet P2WPKH
export const defaultBitcoinMainnetP2WPKHAccountAtIndex = (
  pathIndex: number
): WalletAccount => {
  return {
    curve: "CURVE_SECP256K1",
    pathFormat: "PATH_FORMAT_BIP32",
    path: `m/84'/0'/${pathIndex}'/0/0`,
    addressFormat: "ADDRESS_FORMAT_BITCOIN_MAINNET_P2WPKH",
  };
};

export const DEFAULT_BITCOIN_MAINNET_P2WPKH_ACCOUNTS: WalletAccount[] = [
  defaultBitcoinMainnetP2WPKHAccountAtIndex(0),
];

// Bitcoin Mainnet P2WSH
export const defaultBitcoinMainnetP2WSHAccountAtIndex = (
  pathIndex: number
): WalletAccount => {
  return {
    curve: "CURVE_SECP256K1",
    pathFormat: "PATH_FORMAT_BIP32",
    path: `m/48'/0'/${pathIndex}'/2'/0/0`,
    addressFormat: "ADDRESS_FORMAT_BITCOIN_MAINNET_P2WSH",
  };
};

export const DEFAULT_BITCOIN_MAINNET_P2WSH_ACCOUNTS: WalletAccount[] = [
  defaultBitcoinMainnetP2WSHAccountAtIndex(0),
];

// Bitcoin Mainnet P2TR
export const defaultBitcoinMainnetP2TRAccountAtIndex = (
  pathIndex: number
): WalletAccount => {
  return {
    curve: "CURVE_SECP256K1",
    pathFormat: "PATH_FORMAT_BIP32",
    path: `m/86'/0'/${pathIndex}'/0/0`,
    addressFormat: "ADDRESS_FORMAT_BITCOIN_MAINNET_P2TR",
  };
};

export const DEFAULT_BITCOIN_MAINNET_P2TR_ACCOUNTS: WalletAccount[] = [
  defaultBitcoinMainnetP2TRAccountAtIndex(0),
];

// Bitcoin Mainnet P2SH
export const defaultBitcoinMainnetP2SHAccountAtIndex = (
  pathIndex: number
): WalletAccount => {
  return {
    curve: "CURVE_SECP256K1",
    pathFormat: "PATH_FORMAT_BIP32",
    path: `m/44'/0'/${pathIndex}'/0/0`,
    addressFormat: "ADDRESS_FORMAT_BITCOIN_MAINNET_P2SH",
  };
};

export const DEFAULT_BITCOIN_MAINNET_P2SH_ACCOUNTS: WalletAccount[] = [
  defaultBitcoinMainnetP2SHAccountAtIndex(0),
];

// Bitcoin Testnet P2PKH
export const defaultBitcoinTestnetP2PKHAccountAtIndex = (
  pathIndex: number
): WalletAccount => {
  return {
    curve: "CURVE_SECP256K1",
    pathFormat: "PATH_FORMAT_BIP32",
    path: `m/44'/1'/${pathIndex}'/0/0`,
    addressFormat: "ADDRESS_FORMAT_BITCOIN_TESTNET_P2PKH",
  };
};

export const DEFAULT_BITCOIN_TESTNET_P2PKH_ACCOUNTS: WalletAccount[] = [
  defaultBitcoinTestnetP2PKHAccountAtIndex(0),
];

// Bitcoin Testnet P2WPKH
export const defaultBitcoinTestnetP2WPKHAccountAtIndex = (
  pathIndex: number
): WalletAccount => {
  return {
    curve: "CURVE_SECP256K1",
    pathFormat: "PATH_FORMAT_BIP32",
    path: `m/84'/1'/${pathIndex}'/0/0`,
    addressFormat: "ADDRESS_FORMAT_BITCOIN_TESTNET_P2WPKH",
  };
};

export const DEFAULT_BITCOIN_TESTNET_P2WPKH_ACCOUNTS: WalletAccount[] = [
  defaultBitcoinTestnetP2WPKHAccountAtIndex(0),
];

// Bitcoin Testnet P2WSH
export const defaultBitcoinTestnetP2WSHAccountAtIndex = (
  pathIndex: number
): WalletAccount => {
  return {
    curve: "CURVE_SECP256K1",
    pathFormat: "PATH_FORMAT_BIP32",
    path: `m/48'/1'/${pathIndex}'/2'/0/0`,
    addressFormat: "ADDRESS_FORMAT_BITCOIN_TESTNET_P2WSH",
  };
};

export const DEFAULT_BITCOIN_TESTNET_P2WSH_ACCOUNTS: WalletAccount[] = [
  defaultBitcoinTestnetP2WSHAccountAtIndex(0),
];

// Bitcoin Testnet P2TR
export const defaultBitcoinTestnetP2TRAccountAtIndex = (
  pathIndex: number
): WalletAccount => {
  return {
    curve: "CURVE_SECP256K1",
    pathFormat: "PATH_FORMAT_BIP32",
    path: `m/86'/1'/${pathIndex}'/0/0`,
    addressFormat: "ADDRESS_FORMAT_BITCOIN_TESTNET_P2TR",
  };
};

export const DEFAULT_BITCOIN_TESTNET_P2TR_ACCOUNTS: WalletAccount[] = [
  defaultBitcoinTestnetP2TRAccountAtIndex(0),
];

// Bitcoin Testnet P2SH
export const defaultBitcoinTestnetP2SHAccountAtIndex = (
  pathIndex: number
): WalletAccount => {
  return {
    curve: "CURVE_SECP256K1",
    pathFormat: "PATH_FORMAT_BIP32",
    path: `m/44'/1'/${pathIndex}'/0/0`,
    addressFormat: "ADDRESS_FORMAT_BITCOIN_TESTNET_P2SH",
  };
};

export const DEFAULT_BITCOIN_TESTNET_P2SH_ACCOUNTS: WalletAccount[] = [
  defaultBitcoinTestnetP2SHAccountAtIndex(0),
];

// Bitcoin Signet P2PKH
export const defaultBitcoinSignetP2PKHAccountAtIndex = (
  pathIndex: number
): WalletAccount => {
  return {
    curve: "CURVE_SECP256K1",
    pathFormat: "PATH_FORMAT_BIP32",
    path: `m/44'/1'/${pathIndex}'/0/0`,
    addressFormat: "ADDRESS_FORMAT_BITCOIN_SIGNET_P2PKH",
  };
};

export const DEFAULT_BITCOIN_SIGNET_P2PKH_ACCOUNTS: WalletAccount[] = [
  defaultBitcoinSignetP2PKHAccountAtIndex(0),
];

// Bitcoin Signet P2WPKH
export const defaultBitcoinSignetP2WPKHAccountAtIndex = (
  pathIndex: number
): WalletAccount => {
  return {
    curve: "CURVE_SECP256K1",
    pathFormat: "PATH_FORMAT_BIP32",
    path: `m/84'/1'/${pathIndex}'/0/0`,
    addressFormat: "ADDRESS_FORMAT_BITCOIN_SIGNET_P2WPKH",
  };
};

export const DEFAULT_BITCOIN_SIGNET_P2WPKH_ACCOUNTS: WalletAccount[] = [
  defaultBitcoinSignetP2WPKHAccountAtIndex(0),
];

// Bitcoin Signet P2WSH
export const defaultBitcoinSignetP2WSHAccountAtIndex = (
  pathIndex: number
): WalletAccount => {
  return {
    curve: "CURVE_SECP256K1",
    pathFormat: "PATH_FORMAT_BIP32",
    path: `m/48'/1'/${pathIndex}'/2'/0/0`,
    addressFormat: "ADDRESS_FORMAT_BITCOIN_SIGNET_P2WSH",
  };
};

export const DEFAULT_BITCOIN_SIGNET_P2WSH_ACCOUNTS: WalletAccount[] = [
  defaultBitcoinSignetP2WSHAccountAtIndex(0),
];

// Bitcoin Signet P2TR
export const defaultBitcoinSignetP2TRAccountAtIndex = (
  pathIndex: number
): WalletAccount => {
  return {
    curve: "CURVE_SECP256K1",
    pathFormat: "PATH_FORMAT_BIP32",
    path: `m/86'/1'/${pathIndex}'/0/0`,
    addressFormat: "ADDRESS_FORMAT_BITCOIN_SIGNET_P2TR",
  };
};

export const DEFAULT_BITCOIN_SIGNET_P2TR_ACCOUNTS: WalletAccount[] = [
  defaultBitcoinSignetP2TRAccountAtIndex(0),
];

// Bitcoin Signet P2SH
export const defaultBitcoinSignetP2SHAccountAtIndex = (
  pathIndex: number
): WalletAccount => {
  return {
    curve: "CURVE_SECP256K1",
    pathFormat: "PATH_FORMAT_BIP32",
    path: `m/44'/1'/${pathIndex}'/0/0`,
    addressFormat: "ADDRESS_FORMAT_BITCOIN_SIGNET_P2SH",
  };
};

export const DEFAULT_BITCOIN_SIGNET_P2SH_ACCOUNTS: WalletAccount[] = [
  defaultBitcoinSignetP2SHAccountAtIndex(0),
];

// Bitcoin Regtest P2PKH
export const defaultBitcoinRegtestP2PKHAccountAtIndex = (
  pathIndex: number
): WalletAccount => {
  return {
    curve: "CURVE_SECP256K1",
    pathFormat: "PATH_FORMAT_BIP32",
    path: `m/44'/1'/${pathIndex}'/0/0`,
    addressFormat: "ADDRESS_FORMAT_BITCOIN_REGTEST_P2PKH",
  };
};

export const DEFAULT_BITCOIN_REGTEST_P2PKH_ACCOUNTS: WalletAccount[] = [
  defaultBitcoinRegtestP2PKHAccountAtIndex(0),
];

// Bitcoin Regtest P2WPKH
export const defaultBitcoinRegtestP2WPKHAccountAtIndex = (
  pathIndex: number
): WalletAccount => {
  return {
    curve: "CURVE_SECP256K1",
    pathFormat: "PATH_FORMAT_BIP32",
    path: `m/84'/1'/${pathIndex}'/0/0`,
    addressFormat: "ADDRESS_FORMAT_BITCOIN_REGTEST_P2WPKH",
  };
};

export const DEFAULT_BITCOIN_REGTEST_P2WPKH_ACCOUNTS: WalletAccount[] = [
  defaultBitcoinRegtestP2WPKHAccountAtIndex(0),
];

// Bitcoin Regtest P2WSH
export const defaultBitcoinRegtestP2WSHAccountAtIndex = (
  pathIndex: number
): WalletAccount => {
  return {
    curve: "CURVE_SECP256K1",
    pathFormat: "PATH_FORMAT_BIP32",
    path: `m/48'/1'/${pathIndex}'/2'/0/0`,
    addressFormat: "ADDRESS_FORMAT_BITCOIN_REGTEST_P2WSH",
  };
};

export const DEFAULT_BITCOIN_REGTEST_P2WSH_ACCOUNTS: WalletAccount[] = [
  defaultBitcoinRegtestP2WSHAccountAtIndex(0),
];

// Bitcoin Regtest P2TR
export const defaultBitcoinRegtestP2TRAccountAtIndex = (
  pathIndex: number
): WalletAccount => {
  return {
    curve: "CURVE_SECP256K1",
    pathFormat: "PATH_FORMAT_BIP32",
    path: `m/86'/1'/${pathIndex}'/0/0`,
    addressFormat: "ADDRESS_FORMAT_BITCOIN_REGTEST_P2TR",
  };
};

export const DEFAULT_BITCOIN_REGTEST_P2TR_ACCOUNTS: WalletAccount[] = [
  defaultBitcoinRegtestP2TRAccountAtIndex(0),
];

// Bitcoin Regtest P2SH
export const defaultBitcoinRegtestP2SHAccountAtIndex = (
  pathIndex: number
): WalletAccount => {
  return {
    curve: "CURVE_SECP256K1",
    pathFormat: "PATH_FORMAT_BIP32",
    path: `m/44'/1'/${pathIndex}'/0/0`,
    addressFormat: "ADDRESS_FORMAT_BITCOIN_REGTEST_P2SH",
  };
};

export const DEFAULT_BITCOIN_REGTEST_P2SH_ACCOUNTS: WalletAccount[] = [
  defaultBitcoinRegtestP2SHAccountAtIndex(0),
];

// Dogecoin Mainnet
export const defaultDogeMainnetAccountAtIndex = (
  pathIndex: number
): WalletAccount => {
  return {
    curve: "CURVE_SECP256K1",
    pathFormat: "PATH_FORMAT_BIP32",
    path: `m/44'/3'/${pathIndex}'/0/0`,
    addressFormat: "ADDRESS_FORMAT_DOGE_MAINNET",
  };
};

export const DEFAULT_DOGE_MAINNET_ACCOUNTS: WalletAccount[] = [
  defaultDogeMainnetAccountAtIndex(0),
];

// Dogecoin Testnet
export const defaultDogeTestnetAccountAtIndex = (
  pathIndex: number
): WalletAccount => {
  return {
    curve: "CURVE_SECP256K1",
    pathFormat: "PATH_FORMAT_BIP32",
    path: `m/44'/3'/${pathIndex}'/0/0`,
    addressFormat: "ADDRESS_FORMAT_DOGE_TESTNET",
  };
};

export const DEFAULT_DOGE_TESTNET_ACCOUNTS: WalletAccount[] = [
  defaultDogeTestnetAccountAtIndex(0),
];

// Sei
export const defaultSeiAccountAtIndex = (pathIndex: number): WalletAccount => {
  return {
    curve: "CURVE_SECP256K1",
    pathFormat: "PATH_FORMAT_BIP32",
    path: `m/44'/118'/${pathIndex}'/0'/0'`,
    addressFormat: "ADDRESS_FORMAT_SEI",
  };
};

export const DEFAULT_SEI_ACCOUNTS: WalletAccount[] = [
  defaultSeiAccountAtIndex(0),
];

// ----------------------------
// CURVE_ED25519 Accounts
// ----------------------------

// Solana
export const defaultSolanaAccountAtIndex = (
  pathIndex: number
): WalletAccount => {
  return {
    curve: "CURVE_ED25519",
    pathFormat: "PATH_FORMAT_BIP32",
    path: `m/44'/501'/${pathIndex}'/0'`,
    addressFormat: "ADDRESS_FORMAT_SOLANA",
  };
};

export const DEFAULT_SOLANA_ACCOUNTS: WalletAccount[] = [
  defaultSolanaAccountAtIndex(0),
];

// SUI
export const defaultSuiAccountAtIndex = (pathIndex: number): WalletAccount => {
  return {
    curve: "CURVE_ED25519",
    pathFormat: "PATH_FORMAT_BIP32",
    path: `m/44'/784'/${pathIndex}'/0'/0'`,
    addressFormat: "ADDRESS_FORMAT_SUI",
  };
};

export const DEFAULT_SUI_ACCOUNTS: WalletAccount[] = [
  defaultSuiAccountAtIndex(0),
];

// Aptos
export const defaultAptosAccountAtIndex = (
  pathIndex: number
): WalletAccount => {
  return {
    curve: "CURVE_ED25519",
    pathFormat: "PATH_FORMAT_BIP32",
    path: `m/44'/637'/${pathIndex}'/0'/0'`,
    addressFormat: "ADDRESS_FORMAT_APTOS",
  };
};

export const DEFAULT_APTOS_ACCOUNTS: WalletAccount[] = [
  defaultAptosAccountAtIndex(0),
];

// Stellar (XLM)
export const defaultXlmAccountAtIndex = (pathIndex: number): WalletAccount => {
  return {
    curve: "CURVE_ED25519",
    pathFormat: "PATH_FORMAT_BIP32",
    path: `m/44'/148'/${pathIndex}'`,
    addressFormat: "ADDRESS_FORMAT_XLM",
  };
};

export const DEFAULT_XLM_ACCOUNTS: WalletAccount[] = [
  defaultXlmAccountAtIndex(0),
];

// TON V3R2
export const defaultTonV3r2AccountAtIndex = (
  pathIndex: number
): WalletAccount => {
  return {
    curve: "CURVE_ED25519",
    pathFormat: "PATH_FORMAT_BIP32",
    path: `m/44'/607'/${pathIndex}'/0'/0'`,
    addressFormat: "ADDRESS_FORMAT_TON_V3R2",
  };
};

export const DEFAULT_TON_V3R2_ACCOUNTS: WalletAccount[] = [
  defaultTonV3r2AccountAtIndex(0),
];

// TON V4R2
export const defaultTonV4r2AccountAtIndex = (
  pathIndex: number
): WalletAccount => {
  return {
    curve: "CURVE_ED25519",
    pathFormat: "PATH_FORMAT_BIP32",
    path: `m/44'/607'/${pathIndex}'/0'/0'`,
    addressFormat: "ADDRESS_FORMAT_TON_V4R2",
  };
};

export const DEFAULT_TON_V4R2_ACCOUNTS: WalletAccount[] = [
  defaultTonV4r2AccountAtIndex(0),
];

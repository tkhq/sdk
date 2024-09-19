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
    | "ADDRESS_FORMAT_TRON";
}

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

export const defaultSolanaAccountAtIndex = (
  pathIndex: number
): WalletAccount => {
  return {
    pathFormat: "PATH_FORMAT_BIP32",
    path: `m/44'/501'/${pathIndex}'/0'`,
    curve: "CURVE_ED25519",
    addressFormat: "ADDRESS_FORMAT_SOLANA",
  };
};

export const DEFAULT_SOLANA_ACCOUNTS: WalletAccount[] = [
  defaultSolanaAccountAtIndex(0),
];

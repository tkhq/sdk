import type { TurnkeyApiTypes } from "@turnkey/http";

export const DEFAULT_ETHEREUM_WALLET_ACCOUNT: TurnkeyApiTypes["v1WalletAccountParams"] =
  {
    curve: "CURVE_SECP256K1",
    pathFormat: "PATH_FORMAT_BIP32",
    path: "m/44'/60'/0'/0/0",
    addressFormat: "ADDRESS_FORMAT_ETHEREUM",
  };

export const DEFAULT_SOLANA_WALLET_ACCOUNT: TurnkeyApiTypes["v1WalletAccountParams"] =
  {
    pathFormat: "PATH_FORMAT_BIP32",
    path: "m/44'/501'/0'/0'",
    curve: "CURVE_ED25519",
    addressFormat: "ADDRESS_FORMAT_SOLANA",
  };

import type { TurnkeyApiTypes } from "@turnkey/http";
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

export const TERMINAL_ACTIVITY_STATUSES: TurnkeyApiTypes["v1ActivityStatus"][] =
  [
    "ACTIVITY_STATUS_COMPLETED",
    "ACTIVITY_STATUS_FAILED",
    "ACTIVITY_STATUS_REJECTED",
  ];

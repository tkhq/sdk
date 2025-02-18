import { TurnkeyApiTypes } from "@turnkey/http";

export type Session = {
  publicKey: string;
  privateKey: string;
  expiry: number;
};

export type User = {
  id: string;
  userName: string;
  email: string | undefined;
  phoneNumber: string | undefined;
  organizationId: string;
  wallets: Wallet[];
};

export type Wallet = {
  id: string;
  name: string;
  accounts: WalletAccount[];
};

export type WalletAccount = {
  id: string;
  curve: Curve;
  pathFormat: PathFormat;
  path: string;
  addressFormat: AddressFormat;
  address: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type Curve = TurnkeyApiTypes["v1Curve"];
export type PathFormat = TurnkeyApiTypes["v1PathFormat"];
export type AddressFormat = TurnkeyApiTypes["v1AddressFormat"];
export type Timestamp = TurnkeyApiTypes["externaldatav1Timestamp"];

import type { TurnkeyApiTypes } from "@turnkey/http";

export type Session = {
  publicKey: string;
  privateKey: string;
  expiry: number;
  user?: User;
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

export type Activity = TurnkeyApiTypes["v1Activity"];
export type AddressFormat = TurnkeyApiTypes["v1AddressFormat"];
export type Curve = TurnkeyApiTypes["v1Curve"];
export type HashFunction = TurnkeyApiTypes["v1HashFunction"];
export type PathFormat = TurnkeyApiTypes["v1PathFormat"];
export type PayloadEncoding = TurnkeyApiTypes["v1PayloadEncoding"];
export type SignRawPayloadResult = TurnkeyApiTypes["v1SignRawPayloadResult"];
export type Timestamp = TurnkeyApiTypes["externaldatav1Timestamp"];
export type WalletAccountParams = TurnkeyApiTypes["v1WalletAccountParams"];

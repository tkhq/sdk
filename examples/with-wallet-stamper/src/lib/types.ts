import { type TurnkeyClient } from "@turnkey/http";

export type Attestation = Parameters<
  TurnkeyClient["createSubOrganization"]
>[0]["parameters"]["rootUsers"][0]["authenticators"][0]["attestation"];

export interface PasskeyRegistrationResult {
  challenge: string;
  attestation: Attestation;
}

export enum ChainType {
  EVM = "evm",
  SOLANA = "solana",
}

export type User = {
  organizationId: string;
  organizationName: string;
  userId: string;
  username: string;
};

export interface Wallet {
  /** @description Unique identifier for a given Wallet. */
  walletId: string;
  /** @description Human-readable name for a Wallet. */
  walletName: string;
  createdAt: string;
  updatedAt: string;
  /** @description True when a given Wallet is exported, false otherwise. */
  exported: boolean;
  /** @description True when a given Wallet is imported, false otherwise. */
  imported: boolean;
}

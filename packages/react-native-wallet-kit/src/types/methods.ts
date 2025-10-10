import type { StamperType } from "@turnkey/core";
import type {
  v1WalletAccountParams,
  v1AddressFormat,
  v1Curve,
} from "@turnkey/sdk-types";

export type RefreshUserParams = {
  stampWith?: StamperType | undefined;
  organizationId?: string;
  userId?: string;
};

export type RefreshWalletsParams = {
  stampWith?: StamperType | undefined;
  organizationId?: string;
  userId?: string;
};

export type HandleDiscordOauthParams = {
  clientId?: string;
  additionalState?: Record<string, string>;
  onOauthSuccess?: (params: {
    oidcToken: string;
    providerName: string;
    publicKey?: string;
    sessionKey?: string;
  }) => any;
};

export type HandleXOauthParams = {
  clientId?: string;
  additionalState?: Record<string, string>;
  onOauthSuccess?: (params: {
    oidcToken: string;
    providerName: string;
    publicKey?: string;
    sessionKey?: string;
  }) => any;
};

export type HandleGoogleOauthParams = {
  clientId?: string;
  additionalState?: Record<string, string>;
  onOauthSuccess?: (params: {
    oidcToken: string;
    providerName: string;
    publicKey?: string;
    sessionKey?: string;
  }) => any;
};

export type HandleAppleOauthParams = {
  clientId?: string;
  additionalState?: Record<string, string>;
  onOauthSuccess?: (params: {
    oidcToken: string;
    providerName: string;
    publicKey?: string;
    sessionKey?: string;
  }) => any;
};

export type HandleFacebookOauthParams = {
  clientId?: string;
  additionalState?: Record<string, string>;
  onOauthSuccess?: (params: {
    oidcToken: string;
    providerName: string;
    publicKey?: string;
    sessionKey?: string;
  }) => any;
};

// Export helpers
export type ExportWalletParams = {
  walletId: string;
  targetPublicKey?: string;
  organizationId?: string;
  stampWith?: StamperType | undefined;
  decrypt?: boolean;
};

export type ExportPrivateKeyParams = {
  privateKeyId: string;
  targetPublicKey?: string;
  organizationId?: string;
  stampWith?: StamperType | undefined;
  decrypt?: boolean;
};

export type ExportWalletAccountParams = {
  address: string;
  targetPublicKey?: string;
  organizationId?: string;
  stampWith?: StamperType | undefined;
  decrypt?: boolean;
};

// Import helpers
export type ImportWalletParams = {
  mnemonic: string;
  walletName: string;
  accounts?: v1WalletAccountParams[];
  organizationId?: string;
  userId?: string;
  stampWith?: StamperType | undefined;
};

export type ImportPrivateKeyParams = {
  privateKey: string;
  privateKeyName: string;
  addressFormats: v1AddressFormat[];
  curve?: v1Curve;
  keyFormat?: "HEXADECIMAL" | "SOLANA";
  organizationId?: string;
  userId?: string;
  stampWith?: StamperType | undefined;
};

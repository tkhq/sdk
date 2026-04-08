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
  primaryClientId?: string;
  secondaryClientIds?: string[];
  additionalState?: Record<string, string>;
  onOauthSuccess?: (params: {
    oidcToken: string;
    providerName: string;
    publicKey?: string;
    sessionKey?: string;
  }) => void;
};

export type HandleXOauthParams = {
  primaryClientId?: string;
  secondaryClientIds?: string[];
  additionalState?: Record<string, string>;
  onOauthSuccess?: (params: {
    oidcToken: string;
    providerName: string;
    publicKey?: string;
    sessionKey?: string;
  }) => void;
};

export type HandleGoogleOauthParams = {
  primaryClientId?: string;
  secondaryClientIds?: string[];
  additionalState?: Record<string, string>;
  onOauthSuccess?: (params: {
    oidcToken: string;
    providerName: string;
    publicKey?: string;
    sessionKey?: string;
  }) => void;
};

export type HandleAppleOauthParams = {
  primaryClientId?: {
    /** The Apple app bundle ID (used as the audience for native iOS Sign-In). */
    iosBundleId?: string;
    /** The Apple Services ID (used as the client ID for web-based Android flow). */
    serviceId?: string;
  };
  secondaryClientIds?: string[];
  additionalState?: Record<string, string>;
  onOauthSuccess?: (params: {
    oidcToken: string;
    providerName: string;
    publicKey?: string;
    sessionKey?: string;
  }) => void;
};

export type HandleFacebookOauthParams = {
  primaryClientId?: string;
  secondaryClientIds?: string[];
  additionalState?: Record<string, string>;
  onOauthSuccess?: (params: {
    oidcToken: string;
    providerName: string;
    publicKey?: string;
    sessionKey?: string;
  }) => void;
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

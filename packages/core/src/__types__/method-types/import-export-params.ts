// These types are separated from `method-types.ts` to avoid export conflicts.
//
// On mobile there's no XSS risk, so react-native-wallet-kit can perform import/export
// directly without UI, reusing the same param names. It redefines these types with
// additional fields, so it skips re-exporting this file and uses its own definitions
//
// On web, import/export must use iframes for security (to prevent XSS attacks). This means
// the methods are UI-driven and have a "Handle"  prefix (our convention for UI methods). So
// react-wallet-kit doesn't have this conflict and re-exports this file normally

import type {
  v1AddressFormat,
  v1Curve,
  v1WalletAccountParams,
} from "@turnkey/sdk-types";
import type { StamperType } from "../enums";

export type ExportWalletParams = {
  walletId: string;
  targetPublicKey: string;
  organizationId?: string;
  stampWith?: StamperType | undefined;
};

export type ExportPrivateKeyParams = {
  privateKeyId: string;
  targetPublicKey: string;
  organizationId?: string;
  stampWith?: StamperType | undefined;
};

export type ExportWalletAccountParams = {
  address: string;
  targetPublicKey: string;
  organizationId?: string;
  stampWith?: StamperType | undefined;
};

export type ImportWalletParams = {
  encryptedBundle: string;
  walletName: string;
  accounts?: v1WalletAccountParams[];
  organizationId?: string;
  userId?: string;
  stampWith?: StamperType | undefined;
};

export type ImportPrivateKeyParams = {
  encryptedBundle: string;
  privateKeyName: string;
  curve: v1Curve;
  addressFormats: v1AddressFormat[];
  organizationId?: string;
  userId?: string;
  stampWith?: StamperType | undefined;
};

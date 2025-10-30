import type {
  OAuthProviders,
  StamperType,
  v1AddressFormat,
  v1AppProof,
  v1Curve,
  v1FiatOnRampBlockchainNetwork,
  v1FiatOnRampCryptoCurrency,
  v1FiatOnRampProvider,
  v1HashFunction,
  v1PayloadEncoding,
  v1WalletAccountParams,
  WalletAccount,
} from "@turnkey/core";
import type { KeyFormat } from "./base";

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

export type HandleLoginParams = {
  sessionKey?: string;
  logoLight?: string;
  logoDark?: string;
  logoClassName?: string;
  title?: string;
};

export type HandleDiscordOauthParams = {
  clientId?: string;
  additionalState?: Record<string, string>;
  openInPage?: boolean;
  onOauthSuccess?: (params: {
    publicKey: string;
    oidcToken: string;
    providerName: string;
  }) => any;
};

export type HandleXOauthParams = {
  clientId?: string;
  additionalState?: Record<string, string>;
  openInPage?: boolean;
  onOauthSuccess?: (params: {
    publicKey: string;
    oidcToken: string;
    providerName: string;
  }) => any;
};

export type HandleGoogleOauthParams = {
  clientId?: string;
  additionalState?: Record<string, string>;
  openInPage?: boolean;
  onOauthSuccess?: (params: {
    publicKey: string;
    oidcToken: string;
    providerName: string;
  }) => any;
};

export type HandleAppleOauthParams = {
  clientId?: string;
  additionalState?: Record<string, string>;
  openInPage?: boolean;
  onOauthSuccess?: (params: {
    publicKey: string;
    oidcToken: string;
    providerName: string;
  }) => any;
};

export type HandleFacebookOauthParams = {
  clientId?: string;
  additionalState?: Record<string, string>;
  openInPage?: boolean;
  onOauthSuccess?: (params: {
    publicKey: string;
    oidcToken: string;
    providerName: string;
  }) => any;
};

export type HandleExportWalletParams = {
  walletId: string;
  targetPublicKey?: string;
  stampWith?: StamperType | undefined;
  organizationId?: string;
  userId?: string;
};

export type HandleExportPrivateKeyParams = {
  privateKeyId: string;
  targetPublicKey?: string;
  keyFormat?: KeyFormat;
  stampWith?: StamperType | undefined;
  organizationId?: string;
  userId?: string;
};

export type HandleExportWalletAccountParams = {
  address: string;
  targetPublicKey?: string;
  keyFormat?: KeyFormat;
  stampWith?: StamperType | undefined;
  organizationId?: string;
  userId?: string;
};

export type HandleImportWalletParams = {
  defaultWalletAccounts?: v1AddressFormat[] | v1WalletAccountParams[];
  successPageDuration?: number | undefined; // Duration in milliseconds for the success page to show. If 0, it will not show the success page.
  stampWith?: StamperType | undefined;
  walletName?: string;
  organizationId?: string;
  userId?: string;
};

export type HandleImportPrivateKeyParams = {
  curve: v1Curve;
  addressFormats: v1AddressFormat[];
  successPageDuration?: number | undefined; // Duration in milliseconds for the success page to show. If 0, it will not show the success page.
  stampWith?: StamperType | undefined;
  keyName?: string;
  organizationId?: string;
  userId?: string;
};

export type HandleUpdateUserEmailParams = {
  email?: string;
  title?: string;
  subTitle?: string;
  successPageDuration?: number | undefined; // Duration in milliseconds for the success page to show. If 0, it will not show the success page.
  stampWith?: StamperType | undefined;
  organizationId?: string;
  userId?: string;
};

export type HandleUpdateUserPhoneNumberParams = {
  phoneNumber?: string;
  formattedPhone?: string;
  title?: string;
  subTitle?: string;
  successPageDuration?: number | undefined; // Duration in milliseconds for the success page to show. If 0, it will not show the success page.
  organizationId?: string;
  userId?: string;
  stampWith?: StamperType | undefined;
};

export type HandleUpdateUserNameParams = {
  userName?: string;
  title?: string;
  subTitle?: string;
  successPageDuration?: number | undefined; // Duration in milliseconds for the success page to show. If 0, it will not show the success page.
  stampWith?: StamperType | undefined;
  organizationId?: string;
  userId?: string;
};

export type HandleAddEmailParams = {
  email?: string;
  title?: string;
  subTitle?: string;
  successPageDuration?: number | undefined; // Duration in milliseconds for the success page to show. If 0, it will not show the success page.
  organizationId?: string;
  userId?: string;
  stampWith?: StamperType | undefined;
};

export type HandleAddPhoneNumberParams = {
  phoneNumber?: string;
  formattedPhone?: string;
  title?: string;
  subTitle?: string;
  successPageDuration?: number | undefined; // Duration in milliseconds for the success page to show. If 0, it will not show the success page.
  organizationId?: string;
  userId?: string;
  stampWith?: StamperType | undefined;
};

export type HandleAddOauthProviderParams = {
  providerName: OAuthProviders;
  stampWith?: StamperType | undefined;
  organizationId?: string;
  successPageDuration?: number | undefined; // Duration in milliseconds for the success page to show. If 0, it will not show the success page.
  userId?: string;
};

export type HandleRemoveOauthProviderParams = {
  providerId: string;
  title?: string;
  subTitle?: string;
  successPageDuration?: number | undefined; // Duration in milliseconds for the success page to show. If 0, it will not show the success page.
  stampWith?: StamperType | undefined;
  organizationId?: string;
};

export type HandleAddPasskeyParams = {
  name?: string;
  displayName?: string;
  userId?: string;
  successPageDuration?: number | undefined; // Duration in milliseconds for the success page to show. If 0, it will not show the success page.
  stampWith?: StamperType | undefined;
  organizationId?: string;
};

export type HandleRemovePasskeyParams = {
  authenticatorId: string;
  userId?: string;
  title?: string;
  subTitle?: string;
  successPageDuration?: number | undefined; // Duration in milliseconds for the success page to show. If 0, it will not show the success page.
  stampWith?: StamperType | undefined;
  organizationId?: string;
};

export type HandleSignMessageParams = {
  message: string;
  walletAccount: WalletAccount;
  encoding?: v1PayloadEncoding;
  hashFunction?: v1HashFunction;
  addEthereumPrefix?: boolean;
  subText?: string;
  successPageDuration?: number | undefined; // Duration in milliseconds for the success page to show. If 0, it will not show the success page.
  stampWith?: StamperType | undefined;
  organizationId?: string;
};

export type HandleConnectExternalWalletParams = {
  successPageDuration?: number | undefined;
};

export type HandleRemoveUserEmailParams = {
  userId?: string;
  successPageDuration?: number | undefined;
  stampWith?: StamperType | undefined;
  organizationId?: string;
};

export type HandleRemoveUserPhoneNumberParams = {
  userId?: string;
  successPageDuration?: number | undefined;
  stampWith?: StamperType | undefined;
  organizationId?: string;
};

export type HandleVerifyAppProofsParams = {
  appProofs: v1AppProof[];
  organizationId?: string;
  stampWith?: StamperType | undefined;
  successPageDuration?: number | undefined; // Duration in milliseconds for the success page to show. If 0, it will not show the success page.
};

export type HandleOnRampParams = {
  walletAddress: string;
  network: v1FiatOnRampBlockchainNetwork;
  cryptoCurrencyCode: v1FiatOnRampCryptoCurrency;
  fiatCurrencyAmount: string;
  onrampProvider?: v1FiatOnRampProvider;
  sandboxMode?: boolean;
  organizationId?: string;
  userId?: string;
  stampWith?: StamperType | undefined;
  successPageDuration?: number | undefined; // Duration in milliseconds for the success page to show. If 0, it will not show the success page.
};
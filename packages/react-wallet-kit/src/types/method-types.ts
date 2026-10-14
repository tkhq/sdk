import type {
  Erc20Transfer,
  EthTransaction,
  OAuthProviders,
  SolanaTransaction,
  StamperType,
  v1AddressFormat,
  v1AppProof,
  OnRampCaip19,
  OnRampCaip2,
  v1Curve,
  v1FiatOnRampCurrency,
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
  primaryClientId?: string;
  secondaryClientIds?: string[];
  additionalState?: Record<string, string>;
  openInPage?: boolean;
  captchaToken?: string;
  onOauthSuccess?: (params: {
    publicKey: string;
    oidcToken: string;
    providerName: string;
  }) => any;
};

export type HandleXOauthParams = {
  primaryClientId?: string;
  secondaryClientIds?: string[];
  additionalState?: Record<string, string>;
  openInPage?: boolean;
  captchaToken?: string;
  onOauthSuccess?: (params: {
    publicKey: string;
    oidcToken: string;
    providerName: string;
  }) => any;
};

export type HandleGoogleOauthParams = {
  primaryClientId?: string;
  secondaryClientIds?: string[];
  additionalState?: Record<string, string>;
  openInPage?: boolean;
  captchaToken?: string;
  onOauthSuccess?: (params: {
    publicKey: string;
    oidcToken: string;
    providerName: string;
  }) => any;
};

export type HandleAppleOauthParams = {
  primaryClientId?: string;
  secondaryClientIds?: string[];
  additionalState?: Record<string, string>;
  openInPage?: boolean;
  captchaToken?: string;
  onOauthSuccess?: (params: {
    publicKey: string;
    oidcToken: string;
    providerName: string;
  }) => any;
};

export type HandleFacebookOauthParams = {
  primaryClientId?: string;
  secondaryClientIds?: string[];
  additionalState?: Record<string, string>;
  openInPage?: boolean;
  captchaToken?: string;
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
  clearClipboardOnPaste?: boolean | undefined; // If true, the clipboard will be cleared when pasting into the import iframe. Defaults to true.
  organizationId?: string;
  userId?: string;
};

export type HandleImportPrivateKeyParams = {
  curve: v1Curve;
  addressFormats: v1AddressFormat[];
  successPageDuration?: number | undefined; // Duration in milliseconds for the success page to show. If 0, it will not show the success page.
  keyFormat?: KeyFormat | undefined;
  stampWith?: StamperType | undefined;
  keyName?: string;
  clearClipboardOnPaste?: boolean | undefined; // If true, the clipboard will be cleared when pasting into the import iframe. Defaults to true.
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
  primaryClientId?: string;
  secondaryClientIds?: string[];
  stampWith?: StamperType | undefined;
  organizationId?: string;
  successPageDuration?: number | undefined; // Duration in milliseconds for the success page to show. If 0, it will not show the success page.
  userId?: string;
  openInPage?: boolean;
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
  walletAccount?: WalletAccount;
  lockedCaip2?: OnRampCaip2;
  lockedCaip19?: OnRampCaip19;
  fiatCurrencyCode?: v1FiatOnRampCurrency;
  defaultFiatCurrencyAmount?: string;
  countryCode?: string;
  countrySubdivisionCode?: string;
  sandboxMode?: boolean;
  organizationId?: string;
  userId?: string;
  stampWith?: StamperType;
  successPageDuration?: number;
  openInNewTab?: boolean;
};

export type HandleSendTransactionParams = {
  // Required Turnkey context
  organizationId?: string;

  // EVM or Solana transaction
  transaction: EthTransaction | SolanaTransaction;

  // UI behavior
  successPageDuration?: number;
  icon?: React.ReactNode;
  stampWith?: StamperType;
};

export type HandleSendErc20TransferParams = {
  organizationId?: string;
  transfer: Erc20Transfer;
  successPageDuration?: number;
  icon?: React.ReactNode;
  stampWith?: StamperType;
};

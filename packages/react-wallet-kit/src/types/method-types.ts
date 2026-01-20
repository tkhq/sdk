import type {
  EthTransaction,
  OAuthProviders,
  StamperType,
  v1AddressFormat,
  v1AppProof,
  v1Curve,
  v1FiatOnRampBlockchainNetwork,
  v1FiatOnRampCryptoCurrency,
  v1FiatOnRampCurrency,
  v1FiatOnRampPaymentMethod,
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
  clearClipboardOnPaste?: boolean | undefined; // If true, the clipboard will be cleared when pasting into the import iframe. Defaults to true.
  organizationId?: string;
  userId?: string;
};

export type HandleImportPrivateKeyParams = {
  curve: v1Curve;
  addressFormats: v1AddressFormat[];
  successPageDuration?: number | undefined; // Duration in milliseconds for the success page to show. If 0, it will not show the success page.
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
  walletAccount: WalletAccount; // Destination wallet account for the buy transaction
  network?: v1FiatOnRampBlockchainNetwork; // Blockchain network to be used for the transaction
  cryptoCurrencyCode?: v1FiatOnRampCryptoCurrency; // Cryptocurrency to be purchased, e.g FIAT_ON_RAMP_CRYPTO_CURRENCY_BTC
  fiatCurrencyCode?: v1FiatOnRampCurrency; // Fiat currency to be used, e.g., FIAT_ON_RAMP_CURRENCY_USD
  fiatCurrencyAmount?: string; // Preset fiat amount, e.g., '100'
  onrampProvider?: v1FiatOnRampProvider; // On-ramp provider, e.g., MoonPay or Coinbase
  paymentMethod?: v1FiatOnRampPaymentMethod; // Payment method, e.g., FIAT_ON_RAMP_PAYMENT_METHOD_CREDIT_DEBIT_CARD
  countryCode?: string; // ISO 3166-1 country code
  countrySubdivisionCode?: string; // ISO 3166-2 subdivision code, e.g., NY
  sandboxMode?: boolean; // Whether to use sandbox (test) mode
  urlForSignature?: string; // MoonPay Widget URL to sign
  organizationId?: string; // Organization context (Turnkey suborg)
  userId?: string; // Optional end user ID
  stampWith?: StamperType; // Stamper type (passkey, api key, wallet, etc.)
  successPageDuration?: number; // Duration for success page in ms (0 disables it)
  openInNewTab?: boolean; // Whether to open the onramp URL in a new browser tab or popup
};

export type HandleSendTransactionParams = {
  // Required Turnkey context
  organizationId?: string;

  // ETH transaction
  transaction: EthTransaction;

  // UI behavior
  successPageDuration?: number;
  icon?: React.ReactNode;
  stampWith?: StamperType;
};

export enum SessionType {
  READ_ONLY = "SESSION_TYPE_READ_ONLY",
  READ_WRITE = "SESSION_TYPE_READ_WRITE",
}

export type Session = {
  sessionType: SessionType;
  userId: string;
  organizationId: string;
  expiry: number;
  token: string;
};

export type SessionResponse = {
  session: Session;
  user: {
    id: string;
    name: string;
    email: string;
    organizationId: string;
    organizationName: string;
  };
};

export enum TurnkeyErrorCodes {
  UNKNOWN = "UNKNOWN",
  NETWORK_ERROR = "NETWORK_ERROR",
  AUTH_ERROR = "AUTH_ERROR",
  VALIDATION_ERROR = "VALIDATION_ERROR",
  SESSION_EXPIRED = "SESSION_EXPIRED",
  NOT_FOUND = "NOT_FOUND",
  INTERNAL_ERROR = "INTERNAL_ERROR",
  UNAUTHORIZED = "UNAUTHORIZED",
  FORBIDDEN = "FORBIDDEN",
  BAD_REQUEST = "BAD_REQUEST",
  CONFLICT = "CONFLICT",
  TIMEOUT = "TIMEOUT",
  SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",
  GATEWAY_TIMEOUT = "GATEWAY_TIMEOUT",
  INVALID_INPUT = "INVALID_INPUT",
}

export class TurnkeyError extends Error {
  constructor(
    message: string,
    public code?: string,
    public cause?: unknown,
  ) {
    super(message);
    this.name = "TurnkeyError";
  }
}

export class TurnkeyNetworkError extends TurnkeyError {
  constructor(
    message: string,
    public statusCode?: number,
    code?: string,
    cause?: unknown,
  ) {
    super(message, code, cause);
    this.name = "TurnkeyNetworkError";
  }
}

export enum FiatOnRampProvider {
  COINBASE = "FIAT_ON_RAMP_PROVIDER_COINBASE",
  MOONPAY = "FIAT_ON_RAMP_PROVIDER_MOONPAY",
}

export enum FiatOnRampCryptoCurrency {
  BITCOIN = "FIAT_ON_RAMP_CRYPTO_CURRENCY_BTC",
  ETHEREUM = "FIAT_ON_RAMP_CRYPTO_CURRENCY_ETH",
  SOLANA = "FIAT_ON_RAMP_CRYPTO_CURRENCY_SOL",
  USDC = "FIAT_ON_RAMP_CRYPTO_CURRENCY_USDC",
}

export enum FiatOnRampCurrency {
  AUD = "FIAT_ON_RAMP_CURRENCY_AUD", // Australian Dollar
  BGN = "FIAT_ON_RAMP_CURRENCY_BGN", // Bulgarian Lev
  BRL = "FIAT_ON_RAMP_CURRENCY_BRL", // Brazilian Real
  CAD = "FIAT_ON_RAMP_CURRENCY_CAD", // Canadian Dollar
  CHF = "FIAT_ON_RAMP_CURRENCY_CHF", // Swiss Franc
  COP = "FIAT_ON_RAMP_CURRENCY_COP", // Colombian Peso
  CZK = "FIAT_ON_RAMP_CURRENCY_CZK", // Czech Koruna
  DKK = "FIAT_ON_RAMP_CURRENCY_DKK", // Danish Krone
  DOP = "FIAT_ON_RAMP_CURRENCY_DOP", // Dominican Peso
  EGP = "FIAT_ON_RAMP_CURRENCY_EGP", // Egyptian Pound
  EUR = "FIAT_ON_RAMP_CURRENCY_EUR", // Euro
  GBP = "FIAT_ON_RAMP_CURRENCY_GBP", // Pound Sterling
  HKD = "FIAT_ON_RAMP_CURRENCY_HKD", // Hong Kong Dollar
  IDR = "FIAT_ON_RAMP_CURRENCY_IDR", // Indonesian Rupiah
  ILS = "FIAT_ON_RAMP_CURRENCY_ILS", // Israeli New Shekel
  JOD = "FIAT_ON_RAMP_CURRENCY_JOD", // Jordanian Dinar
  KES = "FIAT_ON_RAMP_CURRENCY_KES", // Kenyan Shilling
  KWD = "FIAT_ON_RAMP_CURRENCY_KWD", // Kuwaiti Dinar
  LKR = "FIAT_ON_RAMP_CURRENCY_LKR", // Sri Lankan Rupee
  MXN = "FIAT_ON_RAMP_CURRENCY_MXN", // Mexican Peso
  NGN = "FIAT_ON_RAMP_CURRENCY_NGN", // Nigerian Naira
  NOK = "FIAT_ON_RAMP_CURRENCY_NOK", // Norwegian Krone
  NZD = "FIAT_ON_RAMP_CURRENCY_NZD", // New Zealand Dollar
  OMR = "FIAT_ON_RAMP_CURRENCY_OMR", // Omani Rial
  PEN = "FIAT_ON_RAMP_CURRENCY_PEN", // Peruvian Sol
  PLN = "FIAT_ON_RAMP_CURRENCY_PLN", // Polish Złoty
  RON = "FIAT_ON_RAMP_CURRENCY_RON", // Romanian Leu
  SEK = "FIAT_ON_RAMP_CURRENCY_SEK", // Swedish Krona
  THB = "FIAT_ON_RAMP_CURRENCY_THB", // Thai Baht
  TRY = "FIAT_ON_RAMP_CURRENCY_TRY", // Turkish Lira
  TWD = "FIAT_ON_RAMP_CURRENCY_TWD", // Taiwan Dollar
  USD = "FIAT_ON_RAMP_CURRENCY_USD", // US Dollar
  VND = "FIAT_ON_RAMP_CURRENCY_VND", // Vietnamese Dong
  ZAR = "FIAT_ON_RAMP_CURRENCY_ZAR", // South African Rand
}

export enum FiatOnRampBlockchainNetwork {
  BITCOIN = "FIAT_ON_RAMP_BLOCKCHAIN_NETWORK_BITCOIN", // bitcoin
  ETHEREUM = "FIAT_ON_RAMP_BLOCKCHAIN_NETWORK_ETHEREUM", // ethereum
  SOLANA = "FIAT_ON_RAMP_BLOCKCHAIN_NETWORK_SOLANA", // solana
  BASE = "FIAT_ON_RAMP_BLOCKCHAIN_NETWORK_BASE", // base
}

export enum FiatOnRampPaymentMethod {
  // Shared methods (supported by both MoonPay and Coinbase)
  CREDIT_DEBIT_CARD = "FIAT_ON_RAMP_PAYMENT_METHOD_CREDIT_DEBIT_CARD", // MoonPay: CREDIT_DEBIT_CARD, Coinbase: CARD
  APPLE_PAY = "FIAT_ON_RAMP_PAYMENT_METHOD_APPLE_PAY", // MoonPay: APPLE_PAY, Coinbase: APPLE_PAY
  // MoonPay-specific methods
  GBP_BANK_TRANSFER = "FIAT_ON_RAMP_PAYMENT_METHOD_GBP_BANK_TRANSFER", // MoonPay: GBP_BANK_TRANSFER
  GBP_OPEN_BANKING_PAYMENT = "FIAT_ON_RAMP_PAYMENT_METHOD_GBP_OPEN_BANKING_PAYMENT", // MoonPay: GBP_OPEN_BANKING_PAYMENT
  GOOGLE_PAY = "FIAT_ON_RAMP_PAYMENT_METHOD_GOOGLE_PAY", // MoonPay: GOOGLE_PAY
  SEPA_BANK_TRANSFER = "FIAT_ON_RAMP_PAYMENT_METHOD_SEPA_BANK_TRANSFER", // MoonPay: SEPA_BANK_TRANSFER
  PIX_INSTANT_PAYMENT = "FIAT_ON_RAMP_PAYMENT_METHOD_PIX_INSTANT_PAYMENT", // MoonPay: PIX_INSTANT_PAYMENT
  PAYPAL = "FIAT_ON_RAMP_PAYMENT_METHOD_PAYPAL", // MoonPay: PAYPAL
  VENMO = "FIAT_ON_RAMP_PAYMENT_METHOD_VENMO", // MoonPay: VENMO
  MOONPAY_BALANCE = "FIAT_ON_RAMP_PAYMENT_METHOD_MOONPAY_BALANCE", // MoonPay: MOONPAY_BALANCE
  // Coinbase-specific methods
  CRYPTO_ACCOUNT = "FIAT_ON_RAMP_PAYMENT_METHOD_CRYPTO_ACCOUNT", // Coinbase: CRYPTO_ACCOUNT
  FIAT_WALLET = "FIAT_ON_RAMP_PAYMENT_METHOD_FIAT_WALLET", // Coinbase: FIAT_WALLET
  ACH_BANK_ACCOUNT = "FIAT_ON_RAMP_PAYMENT_METHOD_ACH_BANK_ACCOUNT", // Coinbase: ACH_BANK_ACCOUNT
}
export * from "./__generated__/types";

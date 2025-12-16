/**
 * StamperType defines the type of stamper to use when stamping a request.
 */
export enum StamperType {
  ApiKey = "api-key",
  Passkey = "passkey",
  Wallet = "wallet",
}

/** @internal */
export enum SessionKey {
  DefaultSessionkey = "@turnkey/session/v3",
}

/**
 * OtpType defines the type of OTP to use.
 */
export enum OtpType {
  Email = "OTP_TYPE_EMAIL",
  Sms = "OTP_TYPE_SMS",
}

/** @internal */
export enum FilterType {
  Email = "EMAIL",
  Sms = "PHONE_NUMBER",
  OidcToken = "OIDC_TOKEN",
  PublicKey = "PUBLIC_KEY",
}

/** @internal */
export const OtpTypeToFilterTypeMap = {
  [OtpType.Email]: FilterType.Email,
  [OtpType.Sms]: FilterType.Sms,
};

/** @internal */
export enum Chain {
  Ethereum = "ethereum",
  Solana = "solana",
}

/**@internal */
export enum Curve {
  SECP256K1 = "CURVE_SECP256K1",
  ED25519 = "CURVE_ED25519",
}

/** @internal */
export enum WalletInterfaceType {
  Solana = "solana",
  Ethereum = "ethereum",
  WalletConnect = "wallet_connect",
}

/** @internal */
export enum WalletSource {
  Embedded = "embedded",
  Connected = "connected",
}

/** @internal */
export enum SignIntent {
  SignMessage = "sign_message",
  SignTransaction = "sign_transaction",
  SignAndSendRawTransaction = "sign_and_send_raw_transaction",
}

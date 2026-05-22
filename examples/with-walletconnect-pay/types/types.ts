export enum OtpType {
  Email = "OTP_TYPE_EMAIL",
  Sms = "OTP_TYPE_SMS",
}

// WC Pay related types (re-exported for convenience)
export interface PaymentDisplayInfo {
  merchantName: string;
  merchantIcon?: string;
  amount: string;
  symbol: string;
  networkName?: string;
  expiresAt?: number;
}

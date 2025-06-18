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

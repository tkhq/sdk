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

export * from "./__generated__/types";

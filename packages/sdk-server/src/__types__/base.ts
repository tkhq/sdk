import type {
  TActivityId,
  TActivityStatus,
  TurnkeyApiTypes,
} from "@turnkey/http";
import type { WalletType } from "@turnkey/wallet-stamper";

export type GrpcStatus = {
  message: string;
  code: number;
  details: unknown[] | null;
};

export enum MethodType {
  Get,
  List,
  Command,
}

export type TStamp = {
  stampHeaderName: string;
  stampHeaderValue: string;
};

export interface TStamper {
  stamp: (input: string) => Promise<TStamp>;
}

export type THttpConfig = {
  baseUrl: string;
};

export class TurnkeyRequestError extends Error {
  details: any[] | null;
  code: number;

  constructor(input: GrpcStatus) {
    let turnkeyErrorMessage = `Turnkey error ${input.code}: ${input.message}`;

    if (input.details != null) {
      turnkeyErrorMessage += ` (Details: ${JSON.stringify(input.details)})`;
    }

    super(turnkeyErrorMessage);

    this.name = "TurnkeyRequestError";
    this.details = input.details ?? null;
    this.code = input.code;
  }
}

export interface ActivityResponse {
  activity: {
    id: TActivityId;
    status: TActivityStatus;
    result: Record<string, any>;
  };
}

export interface ActivityMetadata {
  activity: {
    id: TActivityId;
    status: TActivityStatus;
  };
}

export type queryOverrideParams = {
  organizationId?: string;
};

export type commandOverrideParams = {
  organizationId?: string;
  timestampMs?: string;
};

export type TActivityPollerConfig = {
  intervalMs: number;
  numRetries: number;
};

export interface TurnkeySDKClientConfig {
  stamper: TStamper;
  apiBaseUrl: string;
  organizationId: string;
  activityPoller?: TActivityPollerConfig | undefined;
}

export interface TurnkeySDKServerConfig {
  apiBaseUrl: string;
  apiPrivateKey: string;
  apiPublicKey: string;
  defaultOrganizationId: string;
  activityPoller?: TActivityPollerConfig | undefined;
}

export interface TurnkeyProxyHandlerConfig {
  allowedMethods?: string[];
}

export interface NextApiRequest {
  body: any;
  query: { [key: string]: string };
}

export interface NextApiResponse<T = any> {
  status: (statusCode: number) => NextApiResponse<T>;
  json: (data: T) => void;
  send: (data: any) => void;
}

export type NextApiHandler = (
  req: NextApiRequest,
  res: NextApiResponse,
) => void | Promise<void>;

export interface ApiCredentials {
  apiPublicKey: string;
  apiPrivateKey: string;
}

export type GetOrCreateSuborgRequest = {
  filterType: FilterType;
  filterValue: string;
  additionalData?: {
    email?: string;
    phoneNumber?: string;
    passkey?: Passkey;
    oauthProviders?: Provider[];
    customAccounts?: WalletAccount[];
    wallet?: {
      publicKey: string;
      type: WalletType;
    };
  };
};

export enum FilterType {
  Email = "EMAIL",
  PhoneNumber = "PHONE_NUMBER",
  OidcToken = "OIDC_TOKEN",
  PublicKey = "PUBLIC_KEY",
}

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

export type VerifyOtpRequest = {
  suborgID: string;
  otpId: string;
  otpCode: string;
  targetPublicKey: string;
  sessionLengthSeconds?: number | undefined;
};

export type OauthRequest = {
  suborgID: string;
  oidcToken: string;
  targetPublicKey: string;
  sessionLengthSeconds?: number | undefined;
};

export type SendOtpRequest = {
  suborgID: string;
  otpType: string;
  contact: string;
  emailCustomization?: EmailCustomization | undefined;
  sendFromEmailAddress?: string | undefined;
  customSmsMessage?: string | undefined;
  userIdentifier?: string | undefined;
  otpLength?: number | undefined;
  alphaNumeric?: boolean | undefined;
};

export type SendOtpResponse = {
  otpId: string;
};

export type InitEmailAuthRequest = {
  suborgID: string;
  email: string;
  targetPublicKey: string;
  apiKeyName?: string | undefined;
  userIdentifier?: string | undefined;
  sessionLengthSeconds?: number | undefined;
  invalidateExisting?: boolean | undefined;
  emailCustomization?: EmailCustomization | undefined;
  sendFromEmailAddress?: string | undefined;
};

export type GetSuborgsRequest = {
  filterValue: string;
  filterType: string;
};

export type GetSuborgsResponse = {
  organizationIds: string[];
};

export interface WalletAccount {
  curve: "CURVE_SECP256K1" | "CURVE_ED25519";
  pathFormat: "PATH_FORMAT_BIP32";
  path: string;
  addressFormat:
    | "ADDRESS_FORMAT_ETHEREUM"
    | "ADDRESS_FORMAT_UNCOMPRESSED"
    | "ADDRESS_FORMAT_COMPRESSED"
    | "ADDRESS_FORMAT_SOLANA"
    | "ADDRESS_FORMAT_COSMOS"
    | "ADDRESS_FORMAT_TRON"
    | "ADDRESS_FORMAT_SEI"
    | "ADDRESS_FORMAT_XLM"
    | "ADDRESS_FORMAT_BITCOIN_MAINNET_P2PKH"
    | "ADDRESS_FORMAT_BITCOIN_MAINNET_P2WPKH"
    | "ADDRESS_FORMAT_BITCOIN_MAINNET_P2WSH"
    | "ADDRESS_FORMAT_BITCOIN_MAINNET_P2TR"
    | "ADDRESS_FORMAT_BITCOIN_MAINNET_P2SH"
    | "ADDRESS_FORMAT_BITCOIN_TESTNET_P2PKH"
    | "ADDRESS_FORMAT_BITCOIN_TESTNET_P2WPKH"
    | "ADDRESS_FORMAT_BITCOIN_TESTNET_P2WSH"
    | "ADDRESS_FORMAT_BITCOIN_TESTNET_P2TR"
    | "ADDRESS_FORMAT_BITCOIN_TESTNET_P2SH"
    | "ADDRESS_FORMAT_BITCOIN_SIGNET_P2PKH"
    | "ADDRESS_FORMAT_BITCOIN_SIGNET_P2WPKH"
    | "ADDRESS_FORMAT_BITCOIN_SIGNET_P2WSH"
    | "ADDRESS_FORMAT_BITCOIN_SIGNET_P2TR"
    | "ADDRESS_FORMAT_BITCOIN_SIGNET_P2SH"
    | "ADDRESS_FORMAT_BITCOIN_REGTEST_P2PKH"
    | "ADDRESS_FORMAT_BITCOIN_REGTEST_P2WPKH"
    | "ADDRESS_FORMAT_BITCOIN_REGTEST_P2WSH"
    | "ADDRESS_FORMAT_BITCOIN_REGTEST_P2TR"
    | "ADDRESS_FORMAT_BITCOIN_REGTEST_P2SH"
    | "ADDRESS_FORMAT_DOGE_MAINNET"
    | "ADDRESS_FORMAT_DOGE_TESTNET"
    | "ADDRESS_FORMAT_SUI"
    | "ADDRESS_FORMAT_APTOS"
    | "ADDRESS_FORMAT_XRP"
    | "ADDRESS_FORMAT_TON_V3R2"
    | "ADDRESS_FORMAT_TON_V4R2";
}

export type CreateSuborgRequest = {
  oauthProviders?: Provider[] | undefined;
  email?: string | undefined;
  phoneNumber?: string | undefined;
  passkey?: Passkey | undefined;
  customAccounts?: WalletAccount[] | undefined;
  wallet?: {
    publicKey: string;
    type: WalletType;
  };
};

export type Passkey = {
  authenticatorName: string;
  challenge: any;
  attestation: any;
};

export type Provider = {
  providerName: string;
  oidcToken: string;
};

export type CreateSuborgResponse = {
  subOrganizationId: string;
};

export type GetOrCreateSuborgResponse = {
  subOrganizationIds: string[];
};

export type EmailCustomization = TurnkeyApiTypes["v1EmailCustomizationParams"];

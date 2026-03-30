import type { Runtime } from "@turnkey/api-key-stamper";
import type { WalletType } from "@turnkey/wallet-stamper";
import type {
  TStamper,
  v1CreateOauthProvidersResult,
  v1EmailCustomizationParams,
  v1User,
  v1WalletAccountParams,
} from "@turnkey/sdk-types";

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
  runtimeOverride?: Runtime | undefined;
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
  includeUnverified?: boolean;
  additionalData?: {
    email?: string;
    phoneNumber?: string;
    passkey?: Passkey;
    oauthProviders?: Provider[];
    customAccounts?: v1WalletAccountParams[];
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

export type OtpLoginRequest = {
  suborgID: string;
  verificationToken: string;
  publicKey: string;
  sessionLengthSeconds?: number | undefined;
};

export type OauthLoginRequest = {
  suborgID: string;
  oidcToken: string;
  publicKey: string;
  sessionLengthSeconds?: number | undefined;
};

export type VerifyOtpRequest = {
  otpId: string;
  otpCode: string;
  sessionLengthSeconds?: number | undefined;
};

export type CreateOauthProvidersRequest = {
  organizationId: string;
  userId: string;
  oauthProviders: Provider[];
};

export type CreateOauthProvidersResponse = v1CreateOauthProvidersResult;

export type SendOtpRequest = {
  otpType: string;
  contact: string;
  appName: string;
  emailCustomization?: v1EmailCustomizationParams | undefined;
  sendFromEmailAddress?: string | undefined;
  sendFromEmailSenderName?: string | undefined;
  customSmsMessage?: string | undefined;
  userIdentifier?: string | undefined;
  otpLength?: number | undefined;
  alphanumeric?: boolean | undefined;
};

export type SendOtpResponse = {
  otpId: string;
};

export type VerifyOtpResponse = {
  verificationToken: string;
};

export type OtpLoginResponse = {
  session: string;
};

export type OauthLoginResponse = {
  session: string;
};

export type InitEmailAuthRequest = {
  suborgID: string;
  email: string;
  targetPublicKey: string;
  apiKeyName?: string | undefined;
  userIdentifier?: string | undefined;
  sessionLengthSeconds?: number | undefined;
  invalidateExisting?: boolean | undefined;
  emailCustomization?: v1EmailCustomizationParams | undefined;
  sendFromEmailAddress?: string | undefined;
};

export type GetUsersRequest = {
  organizationId: string;
};

export type GetUsersResponse = {
  users: v1User[];
};

export type GetSuborgsRequest = {
  filterValue: string;
  filterType: string;
};

export type GetSuborgsResponse = {
  organizationIds: string[];
};

export type CreateSuborgRequest = {
  oauthProviders?: Provider[] | undefined;
  email?: string | undefined;
  phoneNumber?: string | undefined;
  passkey?: Passkey | undefined;
  customAccounts?: v1WalletAccountParams[] | undefined;
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

import type { TActivityId, TActivityStatus } from "@turnkey/http";
import type { WalletInterface, WalletStamper } from "@turnkey/wallet-stamper";
import type { WebauthnStamper } from "@turnkey/webauthn-stamper";
import type { IframeStamper } from "@turnkey/iframe-stamper";
import type { IndexedDbStamper } from "@turnkey/indexed-db-stamper";

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

export enum SessionType {
  READ_ONLY = "SESSION_TYPE_READ_ONLY",
  READ_WRITE = "SESSION_TYPE_READ_WRITE",
}

export type Session = {
  sessionType: SessionType;
  userId: string;
  organizationId: string;
  expiry: number; // Unix timestamp representing the expiry of the session set by the server
  token: string; // publicKey used to verify stamped requests (lives in indexedDb) also can (temporarily) be read bearer tokens
};

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

export type TActivityPollerConfig = {
  intervalMs: number;
  numRetries: number;
};

interface BaseSDKClientConfig {
  apiBaseUrl: string;
  organizationId: string;
  activityPoller?: TActivityPollerConfig | undefined;
}

interface SDKClientConfigWithStamper extends BaseSDKClientConfig {
  stamper: TStamper;
  readOnlySession?: never;
}

interface SDKClientConfigWithReadOnlySession extends BaseSDKClientConfig {
  stamper?: never;
  readOnlySession: string;
}

export type TurnkeySDKClientConfig =
  | SDKClientConfigWithStamper
  | SDKClientConfigWithReadOnlySession;

export interface TurnkeySDKBrowserConfig {
  apiBaseUrl: string;
  defaultOrganizationId: string;
  rpId?: string;
  serverSignUrl?: string;
  iframeUrl?: string;
  dangerouslyOverrideIframeKeyTtl?: number;
}

export type Stamper =
  | WebauthnStamper
  | IframeStamper
  | WalletStamper
  | IndexedDbStamper;

export type queryOverrideParams = {
  organizationId?: string;
};

export type commandOverrideParams = {
  organizationId?: string;
  timestampMs?: string;
};

export interface IframeClientParams {
  iframeContainer: HTMLElement | null | undefined;
  iframeUrl: string;
  iframeElementId?: string;
  dangerouslyOverrideIframeKeyTtl?: number;
}

export interface PasskeyClientParams {
  rpId?: string;
  timeout?: number;
  userVerification?: UserVerificationRequirement;
  allowCredentials?: PublicKeyCredentialDescriptor[];
}

export interface RefreshSessionParams {
  sessionType: SessionType;
  expirationSeconds?: string | undefined;
  publicKey?: string;
}

export interface LoginWithBundleParams {
  bundle: string;
  expirationSeconds?: string;
}

export interface LoginWithPasskeyParams {
  sessionType: SessionType;
  expirationSeconds?: string | undefined;
  publicKey?: string;
}

export interface LoginWithWalletParams {
  sessionType: SessionType;
  expirationSeconds?: string | undefined;
  publicKey?: string;
}

export interface TurnkeyWalletClientConfig extends SDKClientConfigWithStamper {
  wallet: WalletInterface;
}

/**
 * The Client used to authenticate the user.
 */
export enum AuthClient {
  Passkey = "passkey",
  Wallet = "wallet",
  Iframe = "iframe",
  IndexedDb = "indexed-db",
}

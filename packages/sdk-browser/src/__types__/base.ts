import type { TActivityId, TActivityStatus } from "@turnkey/http";
import type { WalletInterface } from "@turnkey/wallet-stamper";
import type * as SdkApiTypes from "../__generated__/sdk_api_types";

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
}

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
}

export type TSessionResponse = Omit<
  SdkApiTypes.TCreateReadOnlySessionResponse,
  "activity" | "session" | "sessionExpiry"
> & {
  credentialBundle?: string;
  session?: string;
  sessionExpiry: string | number;
};

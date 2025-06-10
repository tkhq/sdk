import type { TActivityId, TActivityStatus } from "@turnkey/http";
import type { WalletStamper } from "@turnkey/wallet-stamper";
import type { WebauthnStamper } from "@turnkey/webauthn-stamper";
import type { IndexedDbStamper } from "@turnkey/indexed-db-stamper";
import type { SessionType } from "@turnkey/sdk-types";
import { StorageBase } from "../__storage__/base";

// TODO (Amir): Get all this outta here and move to sdk-types. Or not, we could just have everything in this package

export const DEFAULT_SESSION_EXPIRATION_IN_SECONDS = "900"; // 15 minutes

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

export interface SubOrganization {
  organizationId: string;
  organizationName: string;
}

export type EmbeddedAPIKey = {
  authBundle: string;
  publicKey: string;
};

export type Passkey = {
  encodedChallenge: string;
  attestation: {
    credentialId: string;
    clientDataJson: string;
    attestationObject: string;
    transports: (
      | "AUTHENTICATOR_TRANSPORT_BLE"
      | "AUTHENTICATOR_TRANSPORT_INTERNAL"
      | "AUTHENTICATOR_TRANSPORT_NFC"
      | "AUTHENTICATOR_TRANSPORT_USB"
      | "AUTHENTICATOR_TRANSPORT_HYBRID"
    )[];
  };
};

export interface TurnkeySDKClientConfig {
  apiBaseUrl: string;
  organizationId: string;

  // TODO (Amir): Remove this in a user-facing config and add passkey and wallet configs
  activityPoller?: TActivityPollerConfig | undefined;
  stamper?: never;
  passkeyStamper?: TStamper;
  storageManager?: StorageBase;
  readOnlySession?: string;
}

export interface TurnkeySDKBrowserConfig {
  apiBaseUrl: string;
  defaultOrganizationId: string;
  rpId?: string;
  serverSignUrl?: string;
  iframeUrl?: string;
  dangerouslyOverrideIframeKeyTtl?: number;
}

export type Stamper = WebauthnStamper | WalletStamper | IndexedDbStamper;

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
  sessionType?: SessionType;
  expirationSeconds?: string | undefined;
  publicKey?: string;
  sessionKey?: string | undefined;
}

export interface LoginWithWalletParams {
  sessionType: SessionType;
  expirationSeconds?: string | undefined;
  publicKey?: string;
}

// export interface TurnkeyWalletClientConfig extends SDKClientConfigWithStamper {
//   wallet: WalletInterface;
// }

/**
 * The Client used to authenticate the user.
 */
export enum AuthClient {
  Passkey = "passkey",
  Wallet = "wallet",
  IndexedDb = "indexed-db",
}

export enum StamperType {
  IndexedDB = "indexed-db",
  Passkey = "passkey",
}

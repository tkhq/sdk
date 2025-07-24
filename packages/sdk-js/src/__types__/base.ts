import type { TActivityId, TActivityStatus } from "@turnkey/http";
import type {
  SignMode,
  WalletStamper,
  WalletType,
} from "@turnkey/wallet-stamper";
import type { WebauthnStamper } from "@turnkey/webauthn-stamper";
import type { IndexedDbStamper } from "@turnkey/indexed-db-stamper";
import type {
  SessionType,
  v1ApiKeyCurve,
  v1Attestation,
  v1OauthProviderParams,
  v1User,
  v1Wallet,
  v1WalletAccount,
  v1WalletAccountParams,
  Session,
} from "@turnkey/sdk-types";
import type { TWalletManagerConfig } from "../__stampers__/wallet/base";

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

export interface TurnkeyHttpClientConfig {
  apiBaseUrl: string;
  organizationId: string;
  authProxyUrl?: string | undefined;
  authProxyId?: string | undefined;

  activityPoller?: TActivityPollerConfig | undefined;
  apiKeyStamper?: TStamper | undefined;
  passkeyStamper?: TStamper | undefined;
  walletStamper?: TStamper | undefined;
  storageManager?: StorageBase | undefined;
  readOnlySession?: string | undefined; // TODO (Amir): Shouldn't this be getten from the storage manager?. TODO (Amir) from the future: I thought we were getting rid of readOnlySessions all together. So..... delete this????
}

export interface TurnkeySDKClientConfig {
  apiBaseUrl?: string | undefined;
  authProxyUrl?: string | undefined;
  authProxyId?: string | undefined; // Auth proxy won't be used
  organizationId: string;

  passkeyConfig?: TPasskeyStamperConfig;
  walletConfig?: TWalletManagerConfig;
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

export interface LoginWithWalletParams {
  sessionType: SessionType;
  expirationSeconds?: string | undefined;
  publicKey?: string;
}

export type User = v1User; // TODO (Amir): I dunno if we need this. We may want to add more stuff to the user type in the future, so let's keep it for now since

export type ExportBundle = string;

export enum Curve {
  SECP256K1 = "CURVE_SECP256K1",
  ED25519 = "CURVE_ED25519",
}

export enum WalletSource {
  Embedded = "embedded",
  Connected = "connected",
}

export interface WalletAccount extends v1WalletAccount {
  signMessage?: (message: string, mode: SignMode) => Promise<string>;
}

export interface EmbeddedWallet extends v1Wallet {
  source: WalletSource.Embedded;
  accounts: WalletAccount[];
}

export interface ConnectedWallet extends v1Wallet {
  source: WalletSource.Connected;
  accounts: WalletAccount[];
}

export type Wallet = EmbeddedWallet | ConnectedWallet;

export type WalletAccountParams = v1WalletAccountParams;

export type Provider = {
  providerName: string;
  oidcToken: string;
};

export type CreateSuborgResponse = {
  subOrganizationId: string;
};

export type CreateSubOrgParams = {
  userName?: string | undefined;
  subOrgName?: string | undefined;
  userEmail?: string | undefined;
  userTag?: string | undefined;
  authenticators?: {
    authenticatorName: string;
    challenge: string;
    attestation: v1Attestation;
  }[];
  userPhoneNumber?: string | undefined;
  verificationToken?: string | undefined;
  apiKeys?: {
    apiKeyName?: string | undefined;
    publicKey: string;
    expirationSeconds?: string | undefined;
    curveType?: v1ApiKeyCurve | undefined;
  }[];
  customWallet?:
    | {
        walletName: string;
        walletAccounts: v1WalletAccountParams[];
      }
    | undefined;
  oauthProviders?: Provider[] | undefined;
};

export type SignUpBody = {
  userName: string;
  subOrgName: string;
  userEmail?: string | undefined;
  userTag?: string | undefined;
  authenticators?: {
    authenticatorName: string;
    challenge: string;
    attestation: v1Attestation;
  }[];
  userPhoneNumber?: string | undefined;
  verificationToken?: string | undefined;
  apiKeys?: {
    apiKeyName: string;
    publicKey: string;
    expirationSeconds: string;
    curveType?: v1ApiKeyCurve | undefined;
  }[];
  customWallet?:
    | {
        walletName: string;
        walletAccounts: WalletAccountParams[];
      }
    | undefined;
  oauthProviders?: v1OauthProviderParams[] | undefined;
};

/**
 * The Client used to authenticate the user.
 */
export enum AuthClient {
  Passkey = "passkey",
  Wallet = "wallet",
  IndexedDb = "indexed-db",
}

export enum StamperType {
  ApiKey = "api-key",
  Passkey = "passkey",
  Wallet = "wallet",
}

export enum OtpType {
  Email = "OTP_TYPE_EMAIL",
  Sms = "OTP_TYPE_SMS",
}

export enum FilterType {
  Email = "EMAIL",
  Sms = "SMS",
  PublicKey = "PUBLIC_KEY",
}

export type Chain = WalletType;

export const OtpTypeToFilterTypeMap = {
  [OtpType.Email]: FilterType.Email,
  [OtpType.Sms]: FilterType.Sms,
};

export enum SessionKey {
  DefaultSessionkey = "@turnkey/session/v3",
}

export interface StorageBase {
  getStorageValue(sessionKey: string): Promise<any>;
  setStorageValue(sessionKey: string, storageValue: any): Promise<void>;
  setActiveSessionKey(sessionKey: string): Promise<void>;
  removeStorageValue(sessionKey: string): Promise<void>;
  storeSession(session: string, sessionKey?: string): Promise<void>;
  getSession(sessionKey?: string): Promise<Session | undefined>;
  getActiveSessionKey(): Promise<string | undefined>;
  getActiveSession(): Promise<Session | undefined>;
  listSessionKeys(): Promise<string[]>;
  clearSession(sessionKey: string): Promise<void>;
  clearAllSessions(): Promise<void>;
}

// TODO (Amir) This would be nice in sdk-types
export type TPasskeyStamperConfig = {
  // The RPID ("Relying Party ID") for your app. This is automatically determined in web environments based on the current hostname.
  // See https://github.com/f-23/react-native-passkey?tab=readme-ov-file#configuration to set this up for react-native.
  rpId: string;

  // Optional timeout value in milliseconds. Defaults to 5 minutes.
  timeout?: number;

  // Optional override for UV flag. Defaults to "preferred".
  userVerification?: UserVerificationRequirement;

  // Optional list of credentials to pass. Defaults to empty.
  allowCredentials?: PublicKeyCredentialDescriptor[];

  // The below options do not exist in the WebauthnStamper:

  // Optional name for the Relying Party (RP). This is used in the passkey creation flow on mobile.
  rpName?: string;

  // Option to force security passkeys on native platforms
  withSecurityKey?: boolean;

  // Option to force platform passkeys on native platforms
  withPlatformKey?: boolean;

  // Optional extensions. Defaults to empty.
  extensions?: Record<string, unknown>;
};

export interface ApiKeyStamperBase {
  listKeyPairs(): Promise<string[]>;
  createKeyPair(
    externalKeyPair?: CryptoKeyPair | { publicKey: string; privateKey: string },
  ): Promise<string>;
  deleteKeyPair(publicKeyHex: string): Promise<void>;
  clearKeyPairs(): Promise<void>;
  stamp(payload: string, publicKeyHex: string): Promise<TStamp>;
}

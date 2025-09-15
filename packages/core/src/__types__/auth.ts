import type {
  v1ApiKeyCurve,
  v1Attestation,
  v1OauthProviderParams,
  v1WalletAccountParams,
} from "@turnkey/sdk-types";

/** @internal */
export const DEFAULT_SESSION_EXPIRATION_IN_SECONDS = "900"; // 15 minutes

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
export enum SessionKey {
  DefaultSessionkey = "@turnkey/session/v3",
}

/** @internal */
export type TStamp = {
  stampHeaderName: string;
  stampHeaderValue: string;
};

/** @internal */
export interface TStamper {
  stamp: (input: string) => Promise<TStamp>;
}

/**
 * StamperType defines the type of stamper to use when stamping a request.
 */
export enum StamperType {
  ApiKey = "api-key",
  Passkey = "passkey",
  Wallet = "wallet",
}

/** @internal */
export interface ApiKeyStamperBase {
  listKeyPairs(): Promise<string[]>;
  createKeyPair(
    externalKeyPair?: CryptoKeyPair | { publicKey: string; privateKey: string },
  ): Promise<string>;
  deleteKeyPair(publicKeyHex: string): Promise<void>;
  clearKeyPairs(): Promise<void>;
  stamp(payload: string, publicKeyHex: string): Promise<TStamp>;
}

/** @internal */
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

/** @internal */
export interface PasskeyClientParams {
  rpId?: string;
  timeout?: number;
  userVerification?: UserVerificationRequirement;
  allowCredentials?: PublicKeyCredentialDescriptor[];
}

/** @internal */
export type CreateSuborgResponse = {
  subOrganizationId: string;
};

/**
 * CreateSubOrgParams defines the parameters to pass on sub-organization creation.
 */
export type CreateSubOrgParams = {
  userName?: string | undefined;
  subOrgName?: string | undefined;
  userEmail?: string | undefined;
  userTag?: string | undefined;
  authenticators?: {
    authenticatorName?: string;
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

/** @internal */
export type Provider = {
  providerName: string;
  oidcToken: string;
};

/** @internal */
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
        walletAccounts: v1WalletAccountParams[];
      }
    | undefined;
  oauthProviders?: v1OauthProviderParams[] | undefined;
};

import type {
  v1ApiKeyCurve,
  v1Attestation,
  v1OauthProviderParams,
  v1WalletAccountParams,
} from "@turnkey/sdk-types";

/** @internal */
export const DEFAULT_SESSION_EXPIRATION_IN_SECONDS = "900"; // 15 minutes

/** @internal */
export type TStamp = {
  stampHeaderName: string;
  stampHeaderValue: string;
};

/** @internal */
export interface TStamper {
  stamp: (input: string) => Promise<TStamp>;
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
  /** name of the user */
  userName?: string | undefined;
  /** name of the sub-organization */
  subOrgName?: string | undefined;
  /** email of the user */
  userEmail?: string | undefined;
  /** tag of the user */
  userTag?: string | undefined;
  /** list of authenticators */
  authenticators?: {
    /** name of the authenticator */
    authenticatorName?: string;
    /** challenge string to use for passkey registration */
    challenge: string;
    /** attestation object returned from the passkey creation process */
    attestation: v1Attestation;
  }[];
  /** phone number of the user */
  userPhoneNumber?: string | undefined;
  /** verification token if email or phone number is provided */
  verificationToken?: string | undefined;
  /** list of api keys */
  apiKeys?: {
    /* name of the api key */
    apiKeyName?: string | undefined;
    /* public key in hex format */
    publicKey: string;
    /* expiration in seconds */
    expirationSeconds?: string | undefined;
    /* curve type */
    curveType?: v1ApiKeyCurve | undefined;
  }[];
  /** custom wallets to create during sub-org creation time */
  customWallet?: CustomWallet | undefined;
  /** list of oauth providers */
  oauthProviders?: Provider[] | undefined;
};

/** @expand */
export type CustomWallet = {
  /** name of the wallet created */
  walletName: string;
  /** list of wallet accounts to create */
  walletAccounts: v1WalletAccountParams[];
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

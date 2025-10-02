import type {
  v1AddressFormat,
  v1Attestation,
  v1CreatePolicyIntentV3,
  v1Curve,
  v1HashFunction,
  v1Pagination,
  v1PayloadEncoding,
  v1TransactionType,
  v1WalletAccountParams,
  v1AppProof,
} from "@turnkey/sdk-types";
import type {
  CreateSubOrgParams,
  OtpType,
  StamperType,
  SwitchableChain,
  WalletAccount,
  WalletProvider,
  Wallet,
  TSignedRequest,
} from "./index";

export type CreateHttpClientParams = {
  apiBaseUrl?: string | undefined;
  organizationId?: string | undefined;
  authProxyUrl?: string | undefined;
  authProxyConfigId?: string | undefined;
  defaultStamperType?: StamperType | undefined;
};

export type CreatePasskeyParams = {
  name?: string;
  challenge?: string;
};

export type CreatePasskeyResult = {
  /** attestation object returned from the passkey creation process */
  attestation: v1Attestation;
  /** encoded challenge string used for passkey registration */
  encodedChallenge: string;
};

export type LogoutParams = {
  sessionKey?: string;
};

export type LoginWithPasskeyParams = {
  publicKey?: string;
  sessionKey?: string;
  expirationSeconds?: string;
  organizationId?: string;
};

export type SignUpWithPasskeyParams = {
  createSubOrgParams?: CreateSubOrgParams;
  sessionKey?: string;
  passkeyDisplayName?: string;
  expirationSeconds?: string;
  challenge?: string;
  organizationId?: string;
};

export type SwitchWalletAccountChainParams = {
  walletAccount: WalletAccount;
  chainOrId: string | SwitchableChain;
  walletProviders?: WalletProvider[] | undefined;
};

export type BuildWalletLoginRequestParams = {
  walletProvider: WalletProvider;
  publicKey?: string;
  expirationSeconds?: string;
};

export type BuildWalletLoginRequestResult = {
  publicKey: string;
  signedRequest: TSignedRequest;
};

export type LoginWithWalletParams = {
  walletProvider: WalletProvider;
  publicKey?: string;
  sessionKey?: string;
  expirationSeconds?: string;
  organizationId?: string;
};

export type SignUpWithWalletParams = {
  walletProvider: WalletProvider;
  createSubOrgParams?: CreateSubOrgParams;
  sessionKey?: string;
  expirationSeconds?: string;
};

export type LoginOrSignupWithWalletParams = {
  walletProvider: WalletProvider;
  publicKey?: string;
  createSubOrgParams?: CreateSubOrgParams;
  sessionKey?: string;
  expirationSeconds?: string;
};

export type InitOtpParams = {
  otpType: OtpType;
  contact: string;
};

export type VerifyOtpParams = {
  otpId: string;
  otpCode: string;
  contact: string;
  otpType: OtpType;
};

export type VerifyOtpResult = {
  subOrganizationId: string | undefined;
  verificationToken: string;
};

export type LoginWithOtpParams = {
  verificationToken: string;
  publicKey?: string;
  organizationId?: string;
  invalidateExisting?: boolean;
  sessionKey?: string;
};

export type SignUpWithOtpParams = {
  verificationToken: string;
  contact: string;
  otpType: OtpType;
  createSubOrgParams?: CreateSubOrgParams;
  invalidateExisting?: boolean;
  sessionKey?: string;
};

export type CompleteOtpParams = {
  otpId: string;
  otpCode: string;
  contact: string;
  otpType: OtpType;
  publicKey?: string;
  invalidateExisting?: boolean;
  sessionKey?: string;
  createSubOrgParams?: CreateSubOrgParams;
};

export type CompleteOauthParams = {
  oidcToken: string;
  publicKey: string;
  providerName?: string;
  sessionKey?: string;
  invalidateExisting?: boolean;
  createSubOrgParams?: CreateSubOrgParams;
};

export type LoginWithOauthParams = {
  oidcToken: string;
  publicKey: string;
  invalidateExisting?: boolean;
  sessionKey?: string;
};

export type SignUpWithOauthParams = {
  oidcToken: string;
  publicKey: string;
  providerName: string;
  createSubOrgParams?: CreateSubOrgParams;
  sessionKey?: string;
};

export type FetchWalletsParams = {
  walletProviders?: WalletProvider[] | undefined;
  organizationId?: string;
  userId?: string;
  connectedOnly?: boolean;
  stampWith?: StamperType | undefined;
};

export type FetchWalletAccountsParams = {
  wallet: Wallet;
  walletProviders?: WalletProvider[];
  paginationOptions?: v1Pagination;
  stampWith?: StamperType | undefined;
  organizationId?: string;
  userId?: string;
};

export type FetchPrivateKeysParams = {
  stampWith?: StamperType | undefined;
  organizationId?: string;
};

export type SignMessageParams = {
  message: string;
  walletAccount: WalletAccount;
  encoding?: v1PayloadEncoding;
  hashFunction?: v1HashFunction;
  stampWith?: StamperType | undefined;
  addEthereumPrefix?: boolean;
  organizationId?: string;
};

export type SignTransactionParams = {
  unsignedTransaction: string;
  transactionType: v1TransactionType;
  walletAccount: WalletAccount;
  stampWith?: StamperType | undefined;
  organizationId?: string;
};

export type SignAndSendTransactionParams = {
  unsignedTransaction: string;
  transactionType: v1TransactionType;
  walletAccount: WalletAccount;
  rpcUrl?: string;
  stampWith?: StamperType | undefined;
  organizationId?: string;
};

export type FetchUserParams = {
  organizationId?: string;
  userId?: string;
  stampWith?: StamperType | undefined;
};

export type FetchOrCreateP256ApiKeyUserParams = {
  publicKey: string;
  createParams?: {
    apiKeyName?: string;
    userName?: string;
  };
  organizationId?: string;
  stampWith?: StamperType | undefined;
};

export type FetchOrCreatePoliciesParams = {
  policies: v1CreatePolicyIntentV3[];
  stampWith?: StamperType | undefined;
  organizationId?: string;
};

export type FetchOrCreatePoliciesResult = ({
  policyId: string;
} & v1CreatePolicyIntentV3)[];

export type UpdateUserEmailParams = {
  email: string;
  verificationToken?: string;
  userId?: string;
  stampWith?: StamperType | undefined;
  organizationId?: string;
};

export type RemoveUserEmailParams = {
  userId?: string;
  stampWith?: StamperType | undefined;
  organizationId?: string;
};

export type UpdateUserPhoneNumberParams = {
  phoneNumber: string;
  verificationToken?: string;
  userId?: string;
  stampWith?: StamperType | undefined;
  organizationId?: string;
};

export type RemoveUserPhoneNumberParams = {
  userId?: string;
  stampWith?: StamperType | undefined;
  organizationId?: string;
};

export type UpdateUserNameParams = {
  userName: string;
  userId?: string;
  stampWith?: StamperType | undefined;
  organizationId?: string;
};

export type AddOauthProviderParams = {
  providerName: string;
  oidcToken: string;
  organizationId?: string;
  userId?: string;
  stampWith?: StamperType | undefined;
};

export type RemoveOauthProvidersParams = {
  providerIds: string[];
  userId?: string;
  stampWith?: StamperType | undefined;
  organizationId?: string;
};

export type AddPasskeyParams = {
  name?: string;
  displayName?: string;
  userId?: string;
  stampWith?: StamperType | undefined;
  organizationId?: string;
};

export type RemovePasskeyParams = {
  authenticatorIds: string[];
  userId?: string;
  stampWith?: StamperType | undefined;
  organizationId?: string;
};

export type CreateWalletParams = {
  walletName: string;
  accounts?: v1WalletAccountParams[] | v1AddressFormat[];
  organizationId?: string;
  mnemonicLength?: number;
  stampWith?: StamperType | undefined;
};

export type CreateWalletAccountsParams = {
  accounts: v1WalletAccountParams[] | v1AddressFormat[];
  walletId: string;
  organizationId?: string;
  stampWith?: StamperType | undefined;
};

export type ExportWalletParams = {
  walletId: string;
  targetPublicKey: string;
  organizationId?: string;
  stampWith?: StamperType | undefined;
};

export type ExportPrivateKeyParams = {
  privateKeyId: string;
  targetPublicKey: string;
  organizationId?: string;
  stampWith?: StamperType | undefined;
};

export type ExportWalletAccountParams = {
  address: string;
  targetPublicKey: string;
  organizationId?: string;
  stampWith?: StamperType | undefined;
};

export type ImportWalletParams = {
  encryptedBundle: string;
  walletName: string;
  accounts?: v1WalletAccountParams[];
  organizationId?: string;
  userId?: string;
  stampWith?: StamperType | undefined;
};

export type ImportPrivateKeyParams = {
  encryptedBundle: string;
  privateKeyName: string;
  curve: v1Curve;
  addressFormats: v1AddressFormat[];
  organizationId?: string;
  userId?: string;
  stampWith?: StamperType | undefined;
};

export type DeleteSubOrganizationParams = {
  deleteWithoutExport?: boolean;
  organizationId?: string;
  stampWith?: StamperType | undefined;
};

export type StoreSessionParams = {
  sessionToken: string;
  sessionKey?: string;
};

export type ClearSessionParams = { sessionKey?: string };

export type RefreshSessionParams = {
  expirationSeconds?: string;
  publicKey?: string;
  sessionKey?: string;
  invalidateExisitng?: boolean;
  stampWith?: StamperType | undefined;
};

export type GetSessionParams = { sessionKey?: string };

export type SetActiveSessionParams = { sessionKey: string };

export type CreateApiKeyPairParams = {
  externalKeyPair?: CryptoKeyPair | { publicKey: string; privateKey: string };
  storeOverride?: boolean;
};

export type FetchBootProofForAppProofParams = {
  appProof?: v1AppProof;
  organizationId?: string;
  stampWith?: StamperType | undefined;
};

export type VerifyAppProofsParams = {
  appProofs: v1AppProof[];
  organizationId?: string;
  stampWith?: StamperType | undefined;
};

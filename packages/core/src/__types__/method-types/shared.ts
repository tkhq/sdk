/**
 * Shared method param types for core, react-wallet-kit, and react-native-wallet-kit
 */

import type {
  v1AddressFormat,
  v1Attestation,
  v1CreatePolicyIntentV3,
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
} from "../index";

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

  // TODO: (breaking change): remove organizationId from here, there is literally
  // no reason to have it
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

export type InitOtpResult = {
  otpId: string;
  otpEncryptionTargetBundle: string;
};

/**
 * Parameters for verifying an OTP code.
 *
 * If `publicKey` is not provided, a new key pair is auto-generated via `apiKeyStamper`.
 * The returned `publicKey` in {@link VerifyOtpResult} must be passed to
 * `loginWithOtp` or `signUpWithOtp` to complete authentication, since the
 * verification token is cryptographically bound to that key.
 */
export type VerifyOtpParams = {
  /** ID of the OTP to verify (returned from `initOtp`). */
  otpId: string;
  /** The OTP code entered by the user. */
  otpCode: string;
  /** The encryption target bundle returned from `initOtp`. */
  otpEncryptionTargetBundle: string;
  /**
   * Optional public key to bind to the verification token.
   * If not provided, a new key pair is auto-generated. This becomes the session publicKey
   */
  publicKey?: string;
};

/**
 * Result of a successful OTP verification.
 *
 * The `publicKey` and `verificationToken` must both be forwarded to
 * `loginWithOtp` or `signUpWithOtp` to complete the authentication flow.
 * The verification token is cryptographically bound to `publicKey`.
 */
export type VerifyOtpResult = {
  /** Verification token bound to `publicKey`. Pass to `loginWithOtp` or `signUpWithOtp`. */
  verificationToken: string;
  /** The public key bound to the verification token */
  publicKey: string;
};

/**
 * Parameters for logging in with an OTP verification token.
 *
 */
export type LoginWithOtpParams = {
  /** Verification token received from `verifyOtp`. */
  verificationToken: string;
  /** Optional organization ID to target. */
  organizationId?: string;
  /** Whether to invalidate existing sessions for the user. */
  invalidateExisting?: boolean;
  /** Session storage key (defaults to the default session key). */
  sessionKey?: string;
};

/**
 * Parameters for signing up with an OTP verification token.
 *
 */
export type SignUpWithOtpParams = {
  /** Verification token received from `verifyOtp`. */
  verificationToken: string;
  /** Contact information (email or phone number). */
  contact: string;
  /** Type of OTP (OtpType.Email or OtpType.Sms). */
  otpType: OtpType;
  /** Optional parameters for creating a sub-organization. */
  createSubOrgParams?: CreateSubOrgParams;
  /** Whether to invalidate existing sessions for the user. */
  invalidateExisting?: boolean;
  /** Session storage key (defaults to the default session key). */
  sessionKey?: string;
};

/**
 * Parameters for the complete OTP flow (verify + login or signup).
 *
 * If `publicKey` is not provided, a new key pair is auto-generated via `apiKeyStamper`.
 * Auto-generated keys are cleaned up on failure; caller-provided keys are never deleted.
 */
export type CompleteOtpParams = {
  /** OTP ID returned from `initOtp`. */
  otpId: string;
  /** The OTP code entered by the user. */
  otpCode: string;
  /** The encryption target bundle returned from `initOtp`. */
  otpEncryptionTargetBundle: string;
  /** Contact information (email or phone number). */
  contact: string;
  /** Type of OTP (OtpType.Email or OtpType.Sms). */
  otpType: OtpType;
  /**
   * Optional public key for authentication. If not provided, a key pair is
   * auto-generated via `apiKeyStamper`. Auto-generated keys are cleaned up
   * on failure; caller-provided keys are never deleted.
   */
  publicKey?: string;
  /** Whether to invalidate existing sessions for the user. */
  invalidateExisting?: boolean;
  /** Session storage key (defaults to the default session key). */
  sessionKey?: string;
  /** Optional parameters for sub-organization creation (used if signup is needed). */
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
  organizationId?: string;
  invalidateExisting?: boolean;
  sessionKey?: string;
};

export type SignUpWithOauthParams = {
  oidcToken: string;
  publicKey: string;
  providerName?: string;
  invalidateExisting?: boolean;
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
  authenticatorAddresses?: {
    ethereum: string[];
    solana: string[];
  };
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

export type PollTransactionStatusParams = {
  organizationId?: string;
  stampWith?: StamperType | undefined;
  sendTransactionStatusId: string;
  pollingIntervalMs?: number;
};

export type EthTransaction = {
  from: string;
  to: string;
  caip2: string;

  value?: string;
  data?: string;
  nonce?: string;
  gasLimit?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;

  sponsor?: boolean;
  deadline?: string;
  gasStationNonce?: string;
};

export type Erc20Transfer = {
  from: string;
  to: string;
  tokenAddress: string;
  amount: string;
  caip2: string;

  nonce?: string;
  gasLimit?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;

  sponsor?: boolean;
};

export type SolanaTransaction = {
  unsignedTransaction: string;
  signWith: string;
  caip2: string;
  sponsor?: boolean;
  recentBlockhash?: string;
};

export type EthSendTransactionParams = {
  organizationId?: string;
  stampWith?: StamperType | undefined;
  transaction: EthTransaction;
};

export type EthSendErc20TransferParams = {
  organizationId?: string;
  stampWith?: StamperType | undefined;
  transfer: Erc20Transfer;
};

export type SolSendTransactionParams = {
  organizationId?: string;
  stampWith?: StamperType | undefined;
  transaction: SolanaTransaction;
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

export type SignWithApiKeyParams = {
  message: string;
  publicKey: string;
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

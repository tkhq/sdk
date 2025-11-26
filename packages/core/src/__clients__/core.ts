import { TurnkeySDKClientBase } from "../__generated__/sdk-client-base";
import {
  type TDeleteSubOrganizationResponse,
  type Session,
  type TStampLoginResponse,
  type v1Attestation,
  type v1SignRawPayloadResult,
  type v1User,
  TurnkeyError,
  TurnkeyErrorCodes,
  type ProxyTGetWalletKitConfigResponse,
  type v1WalletAccountParams,
  type v1PrivateKey,
  type WalletAuthResult,
  type BaseAuthResult,
  AuthAction,
  type PasskeyAuthResult,
  type v1CreatePolicyIntentV3,
  type v1BootProof,
  ProxyTSignupResponse,
  TGetWalletsResponse,
  TGetUserResponse,
} from "@turnkey/sdk-types";
import {
  DEFAULT_SESSION_EXPIRATION_IN_SECONDS,
  SignIntent,
  StamperType,
  OtpType,
  OtpTypeToFilterTypeMap,
  Chain,
  FilterType,
  WalletSource,
  Curve,
  SessionKey,
  type ExportBundle,
  type TurnkeySDKClientConfig,
  type WalletAccount,
  type Wallet,
  type EmbeddedWallet,
  type ConnectedWallet,
  type StorageBase,
  type EmbeddedWalletAccount,
  type ConnectedWalletAccount,
  type WalletManagerBase,
  type WalletProvider,
  type ConnectedEthereumWalletAccount,
  type ConnectedSolanaWalletAccount,
  type CreatePasskeyParams,
  type CreatePasskeyResult,
  type LogoutParams,
  type LoginWithPasskeyParams,
  type SignUpWithPasskeyParams,
  type SwitchWalletAccountChainParams,
  type LoginWithWalletParams,
  type SignUpWithWalletParams,
  type LoginOrSignupWithWalletParams,
  type InitOtpParams,
  type VerifyOtpParams,
  type VerifyOtpResult,
  type LoginWithOtpParams,
  type SignUpWithOtpParams,
  type CompleteOtpParams,
  type CompleteOauthParams,
  type LoginWithOauthParams,
  type SignUpWithOauthParams,
  type FetchWalletsParams,
  type FetchWalletAccountsParams,
  type FetchPrivateKeysParams,
  type SignMessageParams,
  type SignTransactionParams,
  type SignAndSendTransactionParams,
  type FetchUserParams,
  type FetchOrCreateP256ApiKeyUserParams,
  type FetchOrCreatePoliciesParams,
  type FetchOrCreatePoliciesResult,
  type UpdateUserEmailParams,
  type RemoveUserEmailParams,
  type UpdateUserPhoneNumberParams,
  type RemoveUserPhoneNumberParams,
  type UpdateUserNameParams,
  type AddOauthProviderParams,
  type RemoveOauthProvidersParams,
  type AddPasskeyParams,
  type RemovePasskeyParams,
  type CreateWalletParams,
  type CreateWalletAccountsParams,
  type ExportWalletParams,
  type ExportPrivateKeyParams,
  type ExportWalletAccountParams,
  type ImportWalletParams,
  type ImportPrivateKeyParams,
  type DeleteSubOrganizationParams,
  type StoreSessionParams,
  type ClearSessionParams,
  type RefreshSessionParams,
  type GetSessionParams,
  type SetActiveSessionParams,
  type CreateApiKeyPairParams,
  type FetchBootProofForAppProofParams,
  type CreateHttpClientParams,
  type BuildWalletLoginRequestResult,
  type BuildWalletLoginRequestParams,
  type VerifyAppProofsParams,
} from "../__types__";
import {
  buildSignUpBody,
  generateWalletAccountsFromAddressFormat,
  getEncodedMessage,
  getHashFunction,
  getEncodingType,
  isReactNative,
  isWalletAccountArray,
  isWeb,
  toExternalTimestamp,
  splitSignature,
  getPublicKeyFromStampHeader,
  broadcastTransaction,
  googleISS,
  withTurnkeyErrorHandling,
  findWalletProviderFromAddress,
  isEthereumProvider,
  isSolanaProvider,
  getAuthenticatorAddresses,
  getCurveTypeFromProvider,
  isValidPasskeyName,
  addressFromPublicKey,
  getPolicySignature,
  mapAccountsToWallet,
  getActiveSessionOrThrowIfRequired,
  fetchAllWalletAccountsWithCursor,
  sendSignedRequest,
} from "../utils";
import { createStorageManager } from "../__storage__/base";
import { CrossPlatformApiKeyStamper } from "../__stampers__/api/base";
import { CrossPlatformPasskeyStamper } from "../__stampers__/passkey/base";
import {
  DEFAULT_ETHEREUM_ACCOUNTS,
  DEFAULT_SOLANA_ACCOUNTS,
} from "../turnkey-helpers";
import { jwtDecode } from "jwt-decode";
import { createWalletManager } from "../__wallet__/base";
import { toUtf8Bytes } from "ethers";
import { verify } from "@turnkey/crypto";

/**
 * @internal
 * Gathers all public methods exposed in our core client and turns it into a type that
 * can be used to extend clients created for other packages built off core
 *
 * Should be used to keep any packages that extend this core package in sync with each
 * other, meaning any new additions to core should also be reflected in those packages
 */
type PublicMethods<T> = {
  [K in keyof T as T[K] extends Function ? K : never]: T[K];
};

export type TurnkeyClientMethods = Omit<
  PublicMethods<TurnkeyClient>,
  "init" | "config" | "httpClient" | "constructor"
>;

export class TurnkeyClient {
  config: TurnkeySDKClientConfig;
  httpClient!: TurnkeySDKClientBase;

  private apiKeyStamper?: CrossPlatformApiKeyStamper | undefined;
  private passkeyStamper?: CrossPlatformPasskeyStamper | undefined;
  private walletManager?: WalletManagerBase | undefined;
  private storageManager!: StorageBase;

  constructor(
    config: TurnkeySDKClientConfig,

    // Users can pass in their own stampers, or we will create them. Should we remove this?
    apiKeyStamper?: CrossPlatformApiKeyStamper,
    passkeyStamper?: CrossPlatformPasskeyStamper,
    walletManager?: WalletManagerBase,
  ) {
    this.config = config;

    // Just store any explicitly provided stampers
    this.apiKeyStamper = apiKeyStamper;
    this.passkeyStamper = passkeyStamper;
    this.walletManager = walletManager;

    // Actual initialization will happen in init()
  }

  async init() {
    // Initialize storage manager
    // TODO (Amir): StorageManager should be a class that extends StorageBase and has an init method
    this.storageManager = await createStorageManager();

    // Initialize the API key stamper
    this.apiKeyStamper = new CrossPlatformApiKeyStamper(this.storageManager);

    // we parallelize independent initializations:
    // - API key stamper init
    // - Passkey stamper creation and init (if configured)
    // - Wallet manager creation (if configured)
    const initTasks: Promise<void>[] = [this.apiKeyStamper.init()];

    if (this.config.passkeyConfig) {
      const passkeyStamper = new CrossPlatformPasskeyStamper(
        this.config.passkeyConfig,
      );
      initTasks.push(
        passkeyStamper.init().then(() => {
          this.passkeyStamper = passkeyStamper;
        }),
      );
    }

    if (
      this.config.walletConfig?.features?.auth ||
      this.config.walletConfig?.features?.connecting
    ) {
      initTasks.push(
        createWalletManager(this.config.walletConfig).then((manager) => {
          this.walletManager = manager;
        }),
      );
    }

    await Promise.all(initTasks);

    // Initialize the HTTP client with the appropriate stampers
    // Note: not passing anything here since we want to use the configured stampers and this.config
    this.httpClient = this.createHttpClient();
  }

  /**
   * Creates a new TurnkeySDKClientBase instance with the provided configuration.
   * This method is used internally to create the HTTP client for making API requests,
   * but can also be used to create an additional client with different configurations if needed.
   * By default, it uses the configuration provided during the TurnkeyClient initialization.
   *
   * @param params - Optional configuration parameters to override the default client configuration.
   * @param params.apiBaseUrl - The base URL of the Turnkey API (defaults to `https://api.turnkey.com` if not provided).
   * @param params.organizationId - The organization ID to associate requests with.
   * @param params.authProxyUrl - The base URL of the Auth Proxy (defaults to `https://authproxy.turnkey.com` if not provided).
   * @param params.authProxyConfigId - The configuration ID to use when making Auth Proxy requests.
   * @param params.defaultStamperType - The default stamper type to use for signing requests
   *   (overrides automatic detection of ApiKey, Passkey, or Wallet stampers).
   *
   * @returns A new instance of {@link TurnkeySDKClientBase} configured with the provided parameters.
   */
  createHttpClient = (
    params?: CreateHttpClientParams,
  ): TurnkeySDKClientBase => {
    // We can comfortably default to the prod urls here
    const apiBaseUrl =
      params?.apiBaseUrl || this.config.apiBaseUrl || "https://api.turnkey.com";
    const authProxyUrl =
      params?.authProxyUrl ||
      this.config.authProxyUrl ||
      "https://authproxy.turnkey.com";

    const organizationId = params?.organizationId || this.config.organizationId;

    return new TurnkeySDKClientBase({
      ...this.config,
      ...params,

      apiBaseUrl,
      authProxyUrl,
      organizationId,
      apiKeyStamper: this.apiKeyStamper,
      passkeyStamper: this.passkeyStamper,
      walletStamper: this.walletManager?.stamper,
      storageManager: this.storageManager,
    });
  };

  /**
   * Creates a new passkey authenticator for the user.
   *
   * - This function generates a new passkey attestation and challenge, suitable for registration with the user's device.
   * - Handles both web and React Native environments, automatically selecting the appropriate passkey creation flow.
   * - The resulting attestation and challenge can be used to register the passkey with Turnkey.
   *
   * @param params.name - display name for the passkey (defaults to a generated name based on the current timestamp).
   * @param params.challenge - challenge string to use for passkey registration. If not provided, a new challenge will be generated.
   * @returns A promise that resolves to {@link CreatePasskeyResult}
   * @throws {TurnkeyError} If there is an error during passkey creation, or if the platform is unsupported.
   */
  createPasskey = async (
    params: CreatePasskeyParams,
  ): Promise<CreatePasskeyResult> => {
    const { name: nameFromParams, challenge } = params || {};
    return withTurnkeyErrorHandling(
      async () => {
        if (!this.passkeyStamper) {
          throw new TurnkeyError(
            "Passkey stamper is not initialized",
            TurnkeyErrorCodes.INTERNAL_ERROR,
          );
        }

        const name = isValidPasskeyName(
          nameFromParams || `passkey-${Date.now()}`,
        );

        let passkey: { encodedChallenge: string; attestation: v1Attestation };
        if (isWeb()) {
          const res = await this.passkeyStamper.createWebPasskey({
            publicKey: {
              user: {
                name,
                displayName: name,
              },
              ...(challenge && { challenge }),
            },
          });
          if (!res) {
            throw new TurnkeyError(
              "Failed to create Web passkey",
              TurnkeyErrorCodes.INTERNAL_ERROR,
            );
          }
          passkey = {
            encodedChallenge: res?.encodedChallenge,
            attestation: res?.attestation,
          };
        } else if (isReactNative()) {
          const res = await this.passkeyStamper.createReactNativePasskey({
            name,
            displayName: name,
          });
          if (!res) {
            throw new TurnkeyError(
              "Failed to create React Native passkey",
              TurnkeyErrorCodes.INTERNAL_ERROR,
            );
          }
          passkey = {
            encodedChallenge: res?.challenge,
            attestation: res?.attestation,
          };
        } else {
          throw new TurnkeyError(
            "Unsupported platform for passkey creation",
            TurnkeyErrorCodes.INVALID_REQUEST,
          );
        }

        return passkey;
      },
      {
        errorMessage: "Failed to create passkey",
        errorCode: TurnkeyErrorCodes.CREATE_PASSKEY_ERROR,
        customErrorsByMessages: {
          "timed out or was not allowed": {
            message: "Passkey creation was cancelled by the user.",
            code: TurnkeyErrorCodes.SELECT_PASSKEY_CANCELLED,
          },
        },
      },
    );
  };

  /**
   * Logs out the current client session.
   *
   * - This function clears the specified session and removes any associated key pairs from storage.
   * - If a sessionKey is provided, it logs out from that session; otherwise, it logs out from the active session.
   * - Cleans up any api keys associated with the session.
   *
   * @param params.sessionKey - session key to specify which session to log out from (defaults to the active session).
   * @returns A promise that resolves when the logout process is complete.
   * @throws {TurnkeyError} If there is no active session or if there is an error during the logout process.
   */
  logout = async (params?: LogoutParams): Promise<void> => {
    withTurnkeyErrorHandling(
      async () => {
        if (params?.sessionKey) {
          const session = await this.storageManager.getSession(
            params.sessionKey,
          );
          this.storageManager.clearSession(params.sessionKey);
          this.apiKeyStamper?.deleteKeyPair(session?.publicKey!);
        } else {
          const sessionKey = await this.storageManager.getActiveSessionKey();
          const session = await this.storageManager.getActiveSession();
          if (sessionKey) {
            this.storageManager.clearSession(sessionKey);
            this.apiKeyStamper?.deleteKeyPair(session?.publicKey!);
          } else {
            throw new TurnkeyError(
              "No active session found to log out from.",
              TurnkeyErrorCodes.NO_SESSION_FOUND,
            );
          }
        }
      },
      {
        errorMessage: "Failed to log out",
        errorCode: TurnkeyErrorCodes.LOGOUT_ERROR,
      },
    );
  };

  /**
   * Logs in a user using a passkey, optionally specifying the public key, session key, and session expiration.
   *
   * - This function initiates the login process with a passkey and handles session creation and storage.
   * - If a public key is not provided, a new key pair will be generated for authentication.
   * - If a session key is not provided, the default session key will be used.
   * - The session expiration can be customized via the expirationSeconds parameter.
   * - Handles cleanup of unused key pairs if login fails.
   *
   * @param params.publicKey - public key to use for authentication. If not provided, a new key pair will be generated.
   * @param params.sessionKey - session key to use for session creation (defaults to the default session key).
   * @param params.expirationSeconds - session expiration time in seconds (defaults to the configured default).
   * @param params.organizationId - organization ID to target (defaults to the session's organization ID or the parent organization ID).
   * @returns A promise that resolves to a {@link PasskeyAuthResult}, which includes:
   *          - `sessionToken`: the signed JWT session token.
   *          - `credentialId`: an empty string.
   * @throws {TurnkeyError} If there is an error during the passkey login process or if the user cancels the passkey prompt.
   */
  loginWithPasskey = async (
    params?: LoginWithPasskeyParams,
  ): Promise<PasskeyAuthResult> => {
    let generatedPublicKey: string | undefined = undefined;
    return await withTurnkeyErrorHandling(
      async () => {
        generatedPublicKey =
          params?.publicKey || (await this.apiKeyStamper?.createKeyPair());
        const sessionKey = params?.sessionKey || SessionKey.DefaultSessionkey;

        const expirationSeconds =
          params?.expirationSeconds || DEFAULT_SESSION_EXPIRATION_IN_SECONDS;

        if (!generatedPublicKey) {
          throw new TurnkeyError(
            "A publickey could not be found or generated.",
            TurnkeyErrorCodes.INTERNAL_ERROR,
          );
        }
        const sessionResponse = await this.httpClient.stampLogin(
          {
            publicKey: generatedPublicKey,
            organizationId:
              params?.organizationId ?? this.config.organizationId,
            expirationSeconds,
          },
          StamperType.Passkey,
        );

        await this.storeSession({
          sessionToken: sessionResponse.session,
          sessionKey,
        });

        generatedPublicKey = undefined; // Key pair was successfully used, set to null to prevent cleanup

        return {
          sessionToken: sessionResponse.session,

          // TODO: can we return the credentialId here?
          // from a quick glance this is going to be difficult
          // for now we return an empty string
          credentialId: "",
        };
      },
      {
        errorMessage: "Unable to log in with the provided passkey",
        errorCode: TurnkeyErrorCodes.PASSKEY_LOGIN_AUTH_ERROR,
        customErrorsByMessages: {
          "timed out or was not allowed": {
            message: "Passkey login was cancelled by the user.",
            code: TurnkeyErrorCodes.SELECT_PASSKEY_CANCELLED,
          },
        },
      },
      {
        finallyFn: async () => {
          if (generatedPublicKey) {
            try {
              await this.apiKeyStamper?.deleteKeyPair(generatedPublicKey);
            } catch (cleanupError) {
              throw new TurnkeyError(
                `Failed to clean up generated key pair`,
                TurnkeyErrorCodes.KEY_PAIR_CLEANUP_ERROR,
                cleanupError,
              );
            }
          }
        },
      },
    );
  };

  /**
   * Signs up a user using a passkey, creating a new sub-organization and session.
   *
   * - This function creates a new passkey authenticator and uses it to register a new sub-organization for the user.
   * - Handles both passkey creation and sub-organization creation in a single flow.
   * - Optionally accepts additional sub-organization parameters, a custom session key, a custom passkey display name, and a custom session expiration.
   * - Automatically generates a new API key pair for authentication and session management.
   * - Stores the resulting session token and manages cleanup of unused key pairs.
   *
   * @param params.passkeyDisplayName - display name for the passkey (defaults to a generated name based on the current timestamp).
   * @param params.challenge - challenge string to use for passkey registration. If not provided, a new challenge will be generated.
   * @param params.expirationSeconds - session expiration time in seconds (defaults to the configured default).
   * @param params.createSubOrgParams - parameters for creating a sub-organization (e.g., authenticators, user metadata).
   * @param params.sessionKey - session key to use for storing the session (defaults to the default session key).
   * @param params.organizationId - organization ID to target (defaults to the session's organization ID or the parent organization ID).
   * @returns A promise that resolves to a {@link PasskeyAuthResult}, which includes:
   *          - `sessionToken`: the signed JWT session token.
   *          - `credentialId`: the credential ID associated with the passkey created.
   * @throws {TurnkeyError} If there is an error during passkey creation, sub-organization creation, or session storage.
   */
  signUpWithPasskey = async (
    params?: SignUpWithPasskeyParams,
  ): Promise<PasskeyAuthResult> => {
    const {
      passkeyDisplayName,
      challenge,
      expirationSeconds = DEFAULT_SESSION_EXPIRATION_IN_SECONDS,
      createSubOrgParams,
      sessionKey = SessionKey.DefaultSessionkey,
      organizationId,
    } = params || {};

    let generatedPublicKey: string | undefined = undefined;
    return withTurnkeyErrorHandling(
      async () => {
        generatedPublicKey = await this.apiKeyStamper?.createKeyPair();
        const passkeyName = passkeyDisplayName || `passkey-${Date.now()}`;

        // A passkey will be created automatically when you call this function. The name is passed in
        const passkey = await this.createPasskey({
          name: passkeyName,
          ...(challenge && { challenge }),
        });

        if (!passkey) {
          throw new TurnkeyError(
            "Failed to create passkey: encoded challenge or attestation is missing",
            TurnkeyErrorCodes.INTERNAL_ERROR,
          );
        }

        const signUpBody = buildSignUpBody({
          createSubOrgParams: {
            ...createSubOrgParams,
            authenticators: [
              ...(createSubOrgParams?.authenticators ?? []), // Any extra authenticators can be passed into createSubOrgParams
              {
                // Add our passkey that we made earlier.
                authenticatorName: passkeyName, // Ensure the name in orgData is the same name as the created passkey
                challenge: passkey.encodedChallenge,
                attestation: passkey.attestation,
              },
            ],
            apiKeys: [
              {
                apiKeyName: `passkey-auth-${generatedPublicKey}`,
                publicKey: generatedPublicKey!,
                curveType: "API_KEY_CURVE_P256",
                expirationSeconds: "60",
              },
            ],
          },
        });

        const res = await this.httpClient.proxySignup(signUpBody);

        if (!res) {
          throw new TurnkeyError(
            `Sign up failed`,
            TurnkeyErrorCodes.PASSKEY_SIGNUP_AUTH_ERROR,
          );
        }

        const newGeneratedKeyPair = await this.apiKeyStamper?.createKeyPair();
        this.apiKeyStamper?.setTemporaryPublicKey(generatedPublicKey!);

        const sessionResponse = await this.httpClient.stampLogin({
          publicKey: newGeneratedKeyPair!,
          organizationId: organizationId ?? this.config.organizationId,
          expirationSeconds,
        });

        await Promise.all([
          this.apiKeyStamper?.deleteKeyPair(generatedPublicKey!),
          this.storeSession({
            sessionToken: sessionResponse.session,
            sessionKey,
          }),
        ]);

        generatedPublicKey = undefined; // Key pair was successfully used, set to null to prevent cleanup

        return {
          sessionToken: sessionResponse.session,
          appProofs: res.appProofs,
          credentialId: passkey.attestation.credentialId,
        };
      },
      {
        errorCode: TurnkeyErrorCodes.PASSKEY_SIGNUP_AUTH_ERROR,
        errorMessage: "Failed to sign up with passkey",
      },
      {
        finallyFn: async () => {
          this.apiKeyStamper?.clearTemporaryPublicKey();
          if (generatedPublicKey) {
            try {
              await this.apiKeyStamper?.deleteKeyPair(generatedPublicKey);
            } catch (cleanupError) {
              throw new TurnkeyError(
                `Failed to clean up generated key pair`,
                TurnkeyErrorCodes.KEY_PAIR_CLEANUP_ERROR,
                cleanupError,
              );
            }
          }
        },
      },
    );
  };

  /**
   * Retrieves wallet providers from the initialized wallet manager.
   *
   * - Optionally filters providers by the specified blockchain chain.
   * - Throws an error if the wallet manager is not initialized.
   *
   * @param chain - optional blockchain chain to filter the returned providers.
   * @returns A promise that resolves to an array of wallet providers.
   * @throws {TurnkeyError} If the wallet manager is uninitialized or provider retrieval fails.
   */
  fetchWalletProviders = async (chain?: Chain): Promise<WalletProvider[]> => {
    return withTurnkeyErrorHandling(
      async () => {
        if (!this.walletManager) {
          throw new TurnkeyError(
            "Wallet manager is not initialized",
            TurnkeyErrorCodes.WALLET_MANAGER_COMPONENT_NOT_INITIALIZED,
          );
        }

        return await this.walletManager.getProviders(chain);
      },
      {
        errorMessage: "Unable to get wallet providers",
        errorCode: TurnkeyErrorCodes.FETCH_WALLETS_ERROR,
      },
    );
  };

  /**
   * Connects the specified wallet account.
   *
   * - Requires the wallet manager and its connector to be initialized.
   *
   * @param walletProvider - wallet provider to connect.
   * @returns A promise that resolves with the connected wallet's address.
   * @throws {TurnkeyError} If the wallet manager is uninitialized or the connection fails.
   */
  connectWalletAccount = async (
    walletProvider: WalletProvider,
  ): Promise<string> => {
    return withTurnkeyErrorHandling(
      async () => {
        if (!this.walletManager?.connector) {
          throw new TurnkeyError(
            "Wallet connector is not initialized",
            TurnkeyErrorCodes.WALLET_MANAGER_COMPONENT_NOT_INITIALIZED,
          );
        }
        return await this.walletManager.connector.connectWalletAccount(
          walletProvider,
        );
      },
      {
        errorMessage: "Unable to connect wallet account",
        errorCode: TurnkeyErrorCodes.CONNECT_WALLET_ACCOUNT_ERROR,
        customErrorsByMessages: {
          "WalletConnect: The connection request has expired. Please scan the QR code again.":
            {
              message:
                "Your WalletConnect session expired. Please scan the QR code again.",
              code: TurnkeyErrorCodes.WALLET_CONNECT_EXPIRED,
            },
          "User rejected the request": {
            message: "Connect wallet was cancelled by the user.",
            code: TurnkeyErrorCodes.CONNECT_WALLET_CANCELLED,
          },
        },
      },
    );
  };

  /**
   * Disconnects the specified wallet account.
   *
   * - Requires the wallet manager and its connector to be initialized.
   *
   * @param walletProvider - wallet provider to disconnect.
   * @returns A promise that resolves once the wallet account is disconnected.
   * @throws {TurnkeyError} If the wallet manager is uninitialized or the disconnection fails.
   */
  disconnectWalletAccount = async (walletProvider: WalletProvider) => {
    return withTurnkeyErrorHandling(
      async () => {
        if (!this.walletManager?.connector) {
          throw new TurnkeyError(
            "Wallet connector is not initialized",
            TurnkeyErrorCodes.WALLET_MANAGER_COMPONENT_NOT_INITIALIZED,
          );
        }

        await this.walletManager.connector.disconnectWalletAccount(
          walletProvider,
        );
      },
      {
        errorMessage: "Unable to disconnect wallet account",
        errorCode: TurnkeyErrorCodes.DISCONNECT_WALLET_ACCOUNT_ERROR,
      },
    );
  };

  /**
   * Switches the wallet provider associated with a given wallet account
   * to a different chain.
   *
   * - Requires the wallet manager and its connector to be initialized
   * - Only works for connected wallet accounts
   * - Looks up the provider for the given account address
   * - Does nothing if the provider is already on the desired chain.
   *
   * @param params.walletAccount - The wallet account whose provider should be switched.
   * @param params.chainOrId - The target chain, specified as a chain ID string or a SwitchableChain object.
   * @param params.walletProviders - Optional list of wallet providers to search; falls back to `fetchWalletProviders()` if omitted.
   * @returns A promise that resolves once the chain switch is complete.
   *
   * @throws {TurnkeyError} If the wallet manager is uninitialized, the provider is not connected, or the switch fails.
   */
  switchWalletAccountChain = async (
    params: SwitchWalletAccountChainParams,
  ): Promise<void> => {
    const { walletAccount, chainOrId, walletProviders } = params;

    return withTurnkeyErrorHandling(
      async () => {
        if (!this.walletManager?.connector) {
          throw new TurnkeyError(
            "Wallet connector is not initialized",
            TurnkeyErrorCodes.WALLET_MANAGER_COMPONENT_NOT_INITIALIZED,
          );
        }

        if (walletAccount.source === WalletSource.Embedded) {
          throw new TurnkeyError(
            "You can only switch chains for connected wallet accounts",
            TurnkeyErrorCodes.NOT_FOUND,
          );
        }

        const providers =
          walletProviders ?? (await this.fetchWalletProviders());
        const walletProvider = findWalletProviderFromAddress(
          walletAccount.address,
          providers,
        );

        if (!walletProvider) {
          throw new TurnkeyError(
            "Wallet provider not found",
            TurnkeyErrorCodes.SWITCH_WALLET_CHAIN_ERROR,
          );
        }

        // if the wallet provider is already on the desired chain, do nothing
        if (walletProvider.chainInfo.namespace === chainOrId) {
          return;
        }

        await this.walletManager.connector.switchChain(
          walletProvider,
          chainOrId,
        );
      },
      {
        errorMessage: "Unable to switch wallet account chain",
        errorCode: TurnkeyErrorCodes.SWITCH_WALLET_CHAIN_ERROR,
      },
    );
  };

  /**
   * Builds and signs a wallet login request without submitting it to Turnkey.
   *
   * - This function prepares a signed request for wallet authentication, which can later be used
   *   to log in or sign up a user with Turnkey.
   * - It initializes the wallet stamper, ensures a valid session public key (generating one if needed),
   *   and signs the login intent with the connected wallet.
   * - For Ethereum wallets, derives the public key from the stamped request header.
   * - For Solana wallets, retrieves the public key directly from the connected wallet.
   * - The signed request is not sent to Turnkey immediately; it is meant to be used in a subsequent flow
   *   (e.g., `loginOrSignupWithWallet`) where sub-organization existence is verified or created first.
   *
   * @param params.walletProvider - the wallet provider used for authentication and signing.
   * @param params.publicKey - optional pre-generated session public key (auto-generated if not provided).
   * @param params.expirationSeconds - optional session expiration time in seconds (defaults to the configured default).
   * @returns A promise resolving to an object containing:
   *          - `signedRequest`: the signed wallet login request.
   *          - `publicKey`: the public key associated with the signed request.
   * @throws {TurnkeyError} If the wallet stamper is not initialized, the signing process fails,
   *                        or the public key cannot be derived or generated.
   */
  buildWalletLoginRequest = async (
    params: BuildWalletLoginRequestParams,
  ): Promise<BuildWalletLoginRequestResult> => {
    const { walletProvider, publicKey: providedPublicKey } = params;
    const expirationSeconds =
      params.expirationSeconds || DEFAULT_SESSION_EXPIRATION_IN_SECONDS;

    let generatedPublicKey: string | undefined = undefined;
    return withTurnkeyErrorHandling(
      async () => {
        if (!this.walletManager?.stamper) {
          throw new TurnkeyError(
            "Wallet stamper is not initialized",
            TurnkeyErrorCodes.WALLET_MANAGER_COMPONENT_NOT_INITIALIZED,
          );
        }

        const futureSessionPublicKey =
          providedPublicKey ??
          (generatedPublicKey = await this.apiKeyStamper?.createKeyPair());

        if (!futureSessionPublicKey) {
          throw new TurnkeyError(
            "Failed to find or generate a public key for building the wallet login request",
            TurnkeyErrorCodes.WALLET_BUILD_LOGIN_REQUEST_ERROR,
          );
        }

        this.walletManager.stamper.setProvider(
          walletProvider.interfaceType,
          walletProvider,
        );

        // here we sign the request with the wallet, but we don't send it to Turnkey yet
        // this is because we need to check if the subOrg exists first, and create one if it doesn't
        // once we have the subOrg for the publicKey, we then can send the request to Turnkey
        const signedRequest = await withTurnkeyErrorHandling(
          async () => {
            return this.httpClient.stampStampLogin(
              {
                publicKey: futureSessionPublicKey,
                organizationId: this.config.organizationId,
                expirationSeconds,
              },
              StamperType.Wallet,
            );
          },
          {
            errorMessage: "Failed to create stamped request for wallet login",
            errorCode: TurnkeyErrorCodes.WALLET_BUILD_LOGIN_REQUEST_ERROR,
            customErrorsByMessages: {
              "WalletConnect: The connection request has expired. Please scan the QR code again.":
                {
                  message:
                    "Your WalletConnect session expired. Please scan the QR code again.",
                  code: TurnkeyErrorCodes.WALLET_CONNECT_EXPIRED,
                },
              "Failed to sign the message": {
                message: "Wallet auth was cancelled by the user.",
                code: TurnkeyErrorCodes.CONNECT_WALLET_CANCELLED,
              },
            },
          },
        );

        if (!signedRequest) {
          throw new TurnkeyError(
            "Failed to create stamped request for wallet login",
            TurnkeyErrorCodes.BAD_RESPONSE,
          );
        }

        let publicKey: string | undefined;
        switch (walletProvider.chainInfo.namespace) {
          case Chain.Ethereum: {
            // for Ethereum, there is no way to get the public key from the wallet address
            // so we derive it from the signed request
            publicKey = getPublicKeyFromStampHeader(
              signedRequest.stamp.stampHeaderValue,
            );
            break;
          }

          case Chain.Solana: {
            // for Solana, we can get the public key from the wallet address
            // since the wallet address is the public key
            // this doesn't require any action from the user as long as the wallet is connected
            // which it has to be since they just called stampStampLogin()
            publicKey = await this.walletManager.stamper.getPublicKey(
              walletProvider.interfaceType,
              walletProvider,
            );
            break;
          }

          default:
            throw new TurnkeyError(
              `Unsupported interface type: ${walletProvider.interfaceType}`,
              TurnkeyErrorCodes.INVALID_REQUEST,
            );
        }

        return {
          signedRequest,
          publicKey: publicKey,
        };
      },
      {
        errorCode: TurnkeyErrorCodes.WALLET_BUILD_LOGIN_REQUEST_ERROR,
        errorMessage: "Failed to build wallet login request",
        catchFn: async () => {
          if (generatedPublicKey) {
            try {
              await this.apiKeyStamper?.deleteKeyPair(generatedPublicKey);
            } catch (cleanupError) {
              throw new TurnkeyError(
                `Failed to clean up generated key pair`,
                TurnkeyErrorCodes.KEY_PAIR_CLEANUP_ERROR,
                cleanupError,
              );
            }
          }
        },
      },
    );
  };

  /**
   * Logs in a user using the specified wallet provider.
   *
   * - This function logs in a user by authenticating with the provided wallet provider via a wallet-based signature.
   * - If a public key is not provided, a new one will be generated for authentication.
   * - Optionally accepts a custom session key and session expiration time.
   * - Stores the resulting session token under the specified session key, or the default session key if not provided.
   * - Throws an error if a public key cannot be found or generated, or if the login process fails.
   *
   * @param params.walletProvider - wallet provider to use for authentication.
   * @param params.publicKey - optional public key to associate with the session (generated if not provided).
   * @param params.sessionKey - optional key to store the session under (defaults to the default session key).
   * @param params.expirationSeconds - optional session expiration time in seconds (defaults to the configured default).
   * @param params.organizationId - organization ID to target (defaults to the session's organization ID or the parent organization ID).
   * @returns A promise that resolves to a {@link WalletAuthResult}, which includes:
   *          - `sessionToken`: the signed JWT session token.
   *          - `address`: the authenticated wallet address.
   * @throws {TurnkeyError} If the wallet stamper is uninitialized, a public key cannot be found or generated, or login fails.
   */
  loginWithWallet = async (
    params: LoginWithWalletParams,
  ): Promise<WalletAuthResult> => {
    let generatedPublicKey =
      params.publicKey || (await this.apiKeyStamper?.createKeyPair());
    return withTurnkeyErrorHandling(
      async () => {
        if (!this.walletManager?.stamper) {
          throw new TurnkeyError(
            "Wallet stamper is not initialized",
            TurnkeyErrorCodes.WALLET_MANAGER_COMPONENT_NOT_INITIALIZED,
          );
        }
        const sessionKey = params.sessionKey || SessionKey.DefaultSessionkey;
        const walletProvider = params.walletProvider;

        const expirationSeconds =
          params?.expirationSeconds || DEFAULT_SESSION_EXPIRATION_IN_SECONDS;

        if (!generatedPublicKey) {
          throw new TurnkeyError(
            "A publickey could not be found or generated.",
            TurnkeyErrorCodes.INTERNAL_ERROR,
          );
        }

        this.walletManager.stamper.setProvider(
          walletProvider.interfaceType,
          walletProvider,
        );

        const sessionResponse = await this.httpClient.stampLogin(
          {
            publicKey: generatedPublicKey,
            organizationId:
              params?.organizationId ?? this.config.organizationId,
            expirationSeconds,
          },
          StamperType.Wallet,
        );

        await this.storeSession({
          sessionToken: sessionResponse.session,
          sessionKey,
        });

        // TODO (Moe): What happens if a user connects to MetaMask on Ethereum,
        // then switches to a Solana account within MetaMask? Will this flow break?
        const address = addressFromPublicKey(
          walletProvider.chainInfo.namespace,
          generatedPublicKey,
        );

        generatedPublicKey = undefined; // Key pair was successfully used, set to null to prevent cleanup
        return {
          sessionToken: sessionResponse.session,
          address,
        };
      },
      {
        errorMessage: "Unable to log in with the provided wallet",
        errorCode: TurnkeyErrorCodes.WALLET_LOGIN_AUTH_ERROR,
      },
      {
        finallyFn: async () => {
          // Clean up the generated key pair if it wasn't successfully used
          this.apiKeyStamper?.clearTemporaryPublicKey();
          if (generatedPublicKey) {
            try {
              await this.apiKeyStamper?.deleteKeyPair(generatedPublicKey);
            } catch (cleanupError) {
              throw new TurnkeyError(
                "Failed to clean up generated key pair",
                TurnkeyErrorCodes.KEY_PAIR_CLEANUP_ERROR,
                cleanupError,
              );
            }
          }
        },
      },
    );
  };

  /**
   * Signs up a user using a wallet, creating a new sub-organization and session.
   *
   * - This function creates a new wallet authenticator and uses it to register a new sub-organization for the user.
   * - Handles both wallet authentication and sub-organization creation in a single flow.
   * - Optionally accepts additional sub-organization parameters, a custom session key, and a custom session expiration.
   * - Automatically generates additional API key pairs for authentication and session management.
   * - Stores the resulting session token under the specified session key, or the default session key if not provided, and manages cleanup of unused key pairs.
   *
   * @param params.walletProvider - wallet provider to use for authentication.
   * @param params.createSubOrgParams - parameters for creating a sub-organization (e.g., authenticators, user metadata).
   * @param params.sessionKey - session key to use for storing the session (defaults to the default session key).
   * @param params.expirationSeconds - session expiration time in seconds (defaults to the configured default).
   * @param params.organizationId - organization ID to target (defaults to the session's organization ID or the parent organization ID).
   * @returns A promise that resolves to a {@link WalletAuthResult}, which includes:
   *          - `sessionToken`: the signed JWT session token.
   *          - `address`: the authenticated wallet address.
   * @throws {TurnkeyError} If there is an error during wallet authentication, sub-organization creation, session storage, or cleanup.
   */
  signUpWithWallet = async (
    params: SignUpWithWalletParams,
  ): Promise<WalletAuthResult> => {
    const {
      walletProvider,
      createSubOrgParams,
      sessionKey = SessionKey.DefaultSessionkey,
      expirationSeconds = DEFAULT_SESSION_EXPIRATION_IN_SECONDS,
    } = params;

    let generatedPublicKey: string | undefined = undefined;
    return withTurnkeyErrorHandling(
      async () => {
        if (!this.walletManager?.stamper) {
          throw new TurnkeyError(
            "Wallet stamper is not initialized",
            TurnkeyErrorCodes.WALLET_MANAGER_COMPONENT_NOT_INITIALIZED,
          );
        }

        generatedPublicKey = await this.apiKeyStamper?.createKeyPair();

        this.walletManager.stamper.setProvider(
          walletProvider.interfaceType,
          walletProvider,
        );

        const publicKey = await this.walletManager.stamper.getPublicKey(
          walletProvider.interfaceType,
          walletProvider,
        );

        if (!publicKey) {
          throw new TurnkeyError(
            "Failed to get public key from wallet",
            TurnkeyErrorCodes.WALLET_SIGNUP_AUTH_ERROR,
          );
        }

        const signUpBody = buildSignUpBody({
          createSubOrgParams: {
            ...createSubOrgParams,
            apiKeys: [
              {
                apiKeyName: `wallet-auth:${publicKey}`,
                publicKey: publicKey,
                curveType: getCurveTypeFromProvider(walletProvider),
              },
              {
                apiKeyName: `wallet-auth-${generatedPublicKey}`,
                publicKey: generatedPublicKey!,
                curveType: "API_KEY_CURVE_P256",
                expirationSeconds: "60",
              },
            ],
          },
        });

        const res = await this.httpClient.proxySignup(signUpBody);

        if (!res) {
          throw new TurnkeyError(
            `Sign up failed`,
            TurnkeyErrorCodes.WALLET_SIGNUP_AUTH_ERROR,
          );
        }

        const newGeneratedKeyPair = await this.apiKeyStamper?.createKeyPair();
        this.apiKeyStamper?.setTemporaryPublicKey(generatedPublicKey!);

        const sessionResponse = await this.httpClient.stampLogin({
          publicKey: newGeneratedKeyPair!,
          organizationId: this.config.organizationId,
          expirationSeconds,
        });

        await Promise.all([
          this.apiKeyStamper?.deleteKeyPair(generatedPublicKey!),
          this.storeSession({
            sessionToken: sessionResponse.session,
            sessionKey,
          }),
        ]);

        generatedPublicKey = undefined; // Key pair was successfully used, set to null to prevent cleanup

        // TODO (Moe): What happens if a user connects to MetaMask on Ethereum,
        // then switches to a Solana account within MetaMask? Will this flow break?
        return {
          sessionToken: sessionResponse.session,
          appProofs: res.appProofs,
          address: addressFromPublicKey(
            walletProvider.chainInfo.namespace,
            publicKey,
          ),
        };
      },
      {
        errorMessage: "Failed to sign up with wallet",
        errorCode: TurnkeyErrorCodes.WALLET_SIGNUP_AUTH_ERROR,
      },
      {
        finallyFn: async () => {
          // Clean up the generated key pair if it wasn't successfully used
          this.apiKeyStamper?.clearTemporaryPublicKey();
          if (generatedPublicKey) {
            try {
              await this.apiKeyStamper?.deleteKeyPair(generatedPublicKey);
            } catch (cleanupError) {
              throw new TurnkeyError(
                "Failed to clean up generated key pair",
                TurnkeyErrorCodes.KEY_PAIR_CLEANUP_ERROR,
                cleanupError,
              );
            }
          }
        },
      },
    );
  };

  /**
   * Logs in an existing user or signs up a new user using a wallet, creating a new sub-organization if needed.
   *
   * - This function attempts to log in the user by stamping a login request with the provided wallet.
   * - If the wallet’s public key is not associated with an existing sub-organization, a new one is created.
   * - Handles both wallet authentication and sub-organization creation in a single flow.
   * - For Ethereum wallets, derives the public key from the signed request header; for Solana wallets, retrieves it directly from the wallet.
   * - Optionally accepts additional sub-organization parameters, a custom session key, and a custom session expiration.
   * - Stores the resulting session token under the specified session key, or the default session key if not provided.
   *
   * @param params.walletProvider - wallet provider to use for authentication.
   * @param params.publicKey - optional public key to associate with the session (generated if not provided).
   * @param params.createSubOrgParams - optional parameters for creating a sub-organization (e.g., authenticators, user metadata).
   * @param params.sessionKey - session key to use for storing the session (defaults to the default session key).
   * @param params.expirationSeconds - session expiration time in seconds (defaults to the configured default).
   * @param params.organizationId - organization ID to target (defaults to the session's organization ID or the parent organization ID).
   * @returns A promise that resolves to an object containing:
   *          - `sessionToken`: the signed JWT session token.
   *          - `address`: the authenticated wallet address.
   *          - `action`: whether the flow resulted in a login or signup ({@link AuthAction}).
   * @throws {TurnkeyError} If there is an error during wallet authentication, sub-organization creation, or session storage.
   */
  loginOrSignupWithWallet = async (
    params: LoginOrSignupWithWalletParams,
  ): Promise<WalletAuthResult & { action: AuthAction }> => {
    const createSubOrgParams = params.createSubOrgParams;
    const sessionKey = params.sessionKey || SessionKey.DefaultSessionkey;
    const walletProvider = params.walletProvider;

    let generatedPublicKey: string | undefined = undefined;
    return withTurnkeyErrorHandling(
      async () => {
        const { signedRequest, publicKey } =
          await this.buildWalletLoginRequest(params);

        // here we check if the subOrg exists and create one
        // then we send off the stamped request to Turnkey

        const accountRes = await this.httpClient.proxyGetAccount({
          filterType: FilterType.PublicKey,
          filterValue: publicKey,
        });

        if (!accountRes) {
          throw new TurnkeyError(
            `Account fetch failed`,
            TurnkeyErrorCodes.ACCOUNT_FETCH_ERROR,
          );
        }

        const subOrganizationId = accountRes.organizationId;

        // if there is no subOrganizationId, we create one
        let signupRes: ProxyTSignupResponse | undefined;
        if (!subOrganizationId) {
          const signUpBody = buildSignUpBody({
            createSubOrgParams: {
              ...createSubOrgParams,
              apiKeys: [
                {
                  apiKeyName: `wallet-auth:${publicKey}`,
                  publicKey: publicKey,
                  curveType: getCurveTypeFromProvider(walletProvider),
                },
              ],
            },
          });

          signupRes = await this.httpClient.proxySignup(signUpBody);

          if (!signupRes) {
            throw new TurnkeyError(
              `Sign up failed`,
              TurnkeyErrorCodes.WALLET_SIGNUP_AUTH_ERROR,
            );
          }
        }

        // now we can send the stamped request to Turnkey
        const sessionResponse =
          await sendSignedRequest<TStampLoginResponse>(signedRequest);
        const sessionToken =
          sessionResponse.activity.result.stampLoginResult?.session;
        if (!sessionToken) {
          throw new TurnkeyError(
            "Session token not found in the response",
            TurnkeyErrorCodes.BAD_RESPONSE,
          );
        }

        await this.storeSession({
          sessionToken: sessionToken,
          sessionKey,
        });

        return {
          sessionToken: sessionToken,
          appProofs: signupRes?.appProofs,
          address: addressFromPublicKey(
            walletProvider.chainInfo.namespace,
            publicKey,
          ),

          // if the subOrganizationId exists, it means the user is logging in
          action: subOrganizationId ? AuthAction.LOGIN : AuthAction.SIGNUP,
        };
      },
      {
        errorCode: TurnkeyErrorCodes.WALLET_LOGIN_OR_SIGNUP_ERROR,
        errorMessage: "Failed to log in or sign up with wallet",
        catchFn: async () => {
          if (generatedPublicKey) {
            try {
              await this.apiKeyStamper?.deleteKeyPair(generatedPublicKey);
            } catch (cleanupError) {
              throw new TurnkeyError(
                `Failed to clean up generated key pair`,
                TurnkeyErrorCodes.KEY_PAIR_CLEANUP_ERROR,
                cleanupError,
              );
            }
          }
        },
      },
    );
  };

  /**
   * Initializes the OTP process by sending an OTP code to the provided contact.
   *
   * - This function initiates the OTP flow by sending a one-time password (OTP) code to the user's contact information (email address or phone number) via the auth proxy.
   * - Supports both email and SMS OTP types.
   * - Returns an OTP ID that is required for subsequent OTP verification.
   *
   * @param params.otpType - type of OTP to initialize (OtpType.Email or OtpType.Sms).
   * @param params.contact - contact information for the user (e.g., email address or phone number).
   * @param params.organizationId - optional organization ID to target (defaults to the session's organization ID or the parent organization ID).
   * @returns A promise that resolves to the OTP ID required for verification.
   * @throws {TurnkeyError} If there is an error during the OTP initialization process or if the maximum number of OTPs has been reached.
   */
  initOtp = async (params: InitOtpParams): Promise<string> => {
    return withTurnkeyErrorHandling(
      async () => {
        const initOtpRes = await this.httpClient.proxyInitOtp(params);

        if (!initOtpRes || !initOtpRes.otpId) {
          throw new TurnkeyError(
            "Failed to initialize OTP: otpId is missing",
            TurnkeyErrorCodes.INIT_OTP_ERROR,
          );
        }

        return initOtpRes.otpId;
      },
      {
        errorMessage: "Failed to initialize OTP",
        errorCode: TurnkeyErrorCodes.INIT_OTP_ERROR,
        customErrorsByMessages: {
          "Max number of OTPs have been initiated": {
            message:
              "Maximum number of OTPs has been reached for this contact.",
            code: TurnkeyErrorCodes.MAX_OTP_INITIATED_ERROR,
          },
        },
      },
    );
  };

  /**
   * Verifies the OTP code sent to the user.
   *
   * - This function verifies the OTP code entered by the user against the OTP sent to their contact information (email or phone) using the auth proxy.
   * - If verification is successful, it returns the sub-organization ID associated with the contact (if it exists) and a verification token.
   * - The verification token can be used for subsequent login or sign-up flows.
   * - Handles both email and SMS OTP types.
   *
   * @param params.otpId - ID of the OTP to verify (returned from `initOtp`).
   * @param params.otpCode - OTP code entered by the user.
   * @param params.contact - contact information for the user (e.g., email address or phone number).
   * @param params.otpType - type of OTP being verified (OtpType.Email or OtpType.Sms).
   * @returns A promise that resolves to an object containing:
   *   - subOrganizationId: sub-organization ID if the contact is already associated with a sub-organization, or an empty string if not.
   *   - verificationToken: verification token to be used for login or sign-up.
   * @throws {TurnkeyError} If there is an error during the OTP verification process, such as an invalid code or network failure.
   */
  verifyOtp = async (params: VerifyOtpParams): Promise<VerifyOtpResult> => {
    const { otpId, otpCode, contact, otpType } = params;

    return withTurnkeyErrorHandling(
      async () => {
        const verifyOtpRes = await this.httpClient.proxyVerifyOtp({
          otpId: otpId,
          otpCode: otpCode,
        });

        if (!verifyOtpRes) {
          throw new TurnkeyError(
            `OTP verification failed`,
            TurnkeyErrorCodes.INTERNAL_ERROR,
          );
        }
        const accountRes = await this.httpClient.proxyGetAccount({
          filterType: OtpTypeToFilterTypeMap[otpType],
          filterValue: contact,
        });

        if (!accountRes) {
          throw new TurnkeyError(
            `Account fetch failed`,
            TurnkeyErrorCodes.ACCOUNT_FETCH_ERROR,
          );
        }

        const subOrganizationId = accountRes.organizationId;
        return {
          subOrganizationId: subOrganizationId,
          verificationToken: verifyOtpRes.verificationToken,
        };
      },
      {
        errorMessage: "Failed to verify OTP",
        errorCode: TurnkeyErrorCodes.VERIFY_OTP_ERROR,
        customErrorsByMessages: {
          "Invalid OTP code": {
            message: "The provided OTP code is invalid.",
            code: TurnkeyErrorCodes.INVALID_OTP_CODE,
          },
        },
      },
    );
  };

  /**
   * Logs in a user using an OTP verification token.
   *
   * - This function logs in a user using the verification token received after OTP verification (from email or SMS).
   * - If a public key is not provided, a new API key pair will be generated for authentication.
   * - Optionally invalidates any existing sessions for the user if `invalidateExisting` is set to true.
   * - Stores the resulting session token under the specified session key, or the default session key if not provided.
   * - Handles cleanup of unused key pairs if login fails.
   *
   * @param params.verificationToken - verification token received after OTP verification.
   * @param params.publicKey - public key to use for authentication. If not provided, a new key pair will be generated.
   * @param params.organizationId - optional organization ID to target (defaults to the verified subOrg ID linked to the verification token contact).
   * @param params.invalidateExisting - flag to invalidate existing session for the user.
   * @param params.sessionKey - session key to use for session creation (defaults to the default session key).
   * @returns A promise that resolves to a {@link BaseAuthResult}, which includes:
   *          - `sessionToken`: the signed JWT session token.
   * @throws {TurnkeyError} If there is an error during the OTP login process or if key pair cleanup fails.
   */
  loginWithOtp = async (
    params: LoginWithOtpParams,
  ): Promise<BaseAuthResult> => {
    const {
      verificationToken,
      invalidateExisting = false,
      publicKey = await this.apiKeyStamper?.createKeyPair(),
      organizationId,
      sessionKey = SessionKey.DefaultSessionkey,
    } = params;

    return withTurnkeyErrorHandling(
      async () => {
        const res = await this.httpClient.proxyOtpLogin({
          verificationToken,
          publicKey: publicKey!,
          invalidateExisting,
          ...(organizationId && { organizationId }),
        });

        if (!res) {
          throw new TurnkeyError(
            `Auth proxy OTP login failed`,
            TurnkeyErrorCodes.OTP_LOGIN_ERROR,
          );
        }

        const loginRes = await res;
        if (!loginRes.session) {
          throw new TurnkeyError(
            "No session returned from OTP login",
            TurnkeyErrorCodes.OTP_LOGIN_ERROR,
          );
        }

        await this.storeSession({
          sessionToken: loginRes.session,
          sessionKey,
        });

        return {
          sessionToken: loginRes.session,
        };
      },
      {
        errorMessage: "Failed to log in with OTP",
        errorCode: TurnkeyErrorCodes.OTP_LOGIN_ERROR,
        catchFn: async () => {
          // Clean up the generated key pair if it wasn't successfully used
          if (publicKey) {
            try {
              await this.apiKeyStamper?.deleteKeyPair(publicKey);
            } catch (cleanupError) {
              throw new TurnkeyError(
                `Failed to clean up generated key pair`,
                TurnkeyErrorCodes.KEY_PAIR_CLEANUP_ERROR,
                cleanupError,
              );
            }
          }
        },
      },
    );
  };

  /**
   * Signs up a user using an OTP verification token.
   *
   * - This function signs up a user using the verification token received after OTP verification (from email or SMS).
   * - Creates a new sub-organization for the user with the provided parameters and associates the contact (email or phone) with the sub-organization.
   * - Automatically generates a new API key pair for authentication and session management.
   * - Stores the resulting session token under the specified session key, or the default session key if not provided.
   * - Handles both email and SMS OTP types, and supports additional sub-organization creation parameters.
   *
   * @param params.verificationToken - verification token received after OTP verification.
   * @param params.contact - contact information for the user (e.g., email address or phone number).
   * @param params.otpType - type of OTP being used (OtpType.Email or OtpType.Sms).
   * @param params.createSubOrgParams - parameters for creating a sub-organization (e.g., authenticators, user metadata).
   * @param params.invalidateExisting - flag to invalidate existing session for the user.
   * @param params.sessionKey - session key to use for session creation (defaults to the default session key).
   * @returns A promise that resolves to a {@link BaseAuthResult}, which includes:
   *          - `sessionToken`: the signed JWT session token.
   * @throws {TurnkeyError} If there is an error during the OTP sign-up process or session storage.
   */
  signUpWithOtp = async (
    params: SignUpWithOtpParams,
  ): Promise<BaseAuthResult> => {
    const {
      verificationToken,
      contact,
      otpType,
      createSubOrgParams,
      invalidateExisting,
      sessionKey,
    } = params;

    const signUpBody = buildSignUpBody({
      createSubOrgParams: {
        ...createSubOrgParams,
        ...(otpType === OtpType.Email
          ? { userEmail: contact }
          : { userPhoneNumber: contact }),
        verificationToken,
      },
    });

    return withTurnkeyErrorHandling(
      async () => {
        const generatedPublicKey = await this.apiKeyStamper?.createKeyPair();
        const signupRes = await this.httpClient.proxySignup(signUpBody);

        if (!signupRes) {
          throw new TurnkeyError(
            `Auth proxy OTP sign up failed`,
            TurnkeyErrorCodes.OTP_SIGNUP_ERROR,
          );
        }

        const otpRes = await this.loginWithOtp({
          verificationToken,
          publicKey: generatedPublicKey!,
          ...(invalidateExisting && { invalidateExisting }),
          ...(sessionKey && { sessionKey }),
        });

        return {
          ...otpRes,
          appProofs: signupRes.appProofs,
        };
      },
      {
        errorCode: TurnkeyErrorCodes.OTP_SIGNUP_ERROR,
        errorMessage: "Failed to sign up with OTP",
      },
    );
  };

  /**
   * Completes the OTP authentication flow by verifying the OTP code and then either signing up or logging in the user.
   *
   * - This function first verifies the OTP code for the provided contact and OTP type.
   * - If the contact is not associated with an existing sub-organization, it will automatically create a new sub-organization and complete the sign-up flow.
   * - If the contact is already associated with a sub-organization, it will complete the login flow.
   * - Supports passing a custom public key for authentication, invalidating existing session, specifying a session key, and providing additional sub-organization creation parameters.
   * - Handles both email and SMS OTP types.
   *
   * @param params.otpId - ID of the OTP to complete (returned from `initOtp`).
   * @param params.otpCode - OTP code entered by the user.
   * @param params.contact - contact information for the user (e.g., email address or phone number).
   * @param params.otpType - type of OTP being completed (OtpType.Email or OtpType.Sms).
   * @param params.publicKey - public key to use for authentication. If not provided, a new key pair may be generated.
   * @param params.invalidateExisting - flag to invalidate existing sessions for the user.
   * @param params.sessionKey - session key to use for session creation (defaults to the default session key).
   * @param params.createSubOrgParams - parameters for sub-organization creation (e.g., authenticators, user metadata).
   * @returns A promise that resolves to an object containing:
   *          - `sessionToken`: the signed JWT session token.
   *          - `verificationToken`: the OTP verification token.
   *          - `action`: whether the flow resulted in a login or signup ({@link AuthAction}).
   * @throws {TurnkeyError} If there is an error during OTP verification, sign-up, or login.
   */
  completeOtp = async (
    params: CompleteOtpParams,
  ): Promise<
    BaseAuthResult & { verificationToken: string; action: AuthAction }
  > => {
    const {
      otpId,
      otpCode,
      contact,
      otpType,
      publicKey,
      invalidateExisting = false,
      sessionKey,
      createSubOrgParams,
    } = params;

    return withTurnkeyErrorHandling(
      async () => {
        const { subOrganizationId, verificationToken } = await this.verifyOtp({
          otpId: otpId,
          otpCode: otpCode,
          contact: contact,
          otpType: otpType,
        });

        if (!verificationToken) {
          throw new TurnkeyError(
            "No verification token returned from OTP verification",
            TurnkeyErrorCodes.VERIFY_OTP_ERROR,
          );
        }

        if (!subOrganizationId) {
          const signUpRes = await this.signUpWithOtp({
            verificationToken,
            contact,
            otpType,
            ...(createSubOrgParams && { createSubOrgParams }),
            ...(invalidateExisting && { invalidateExisting }),
            ...(sessionKey && { sessionKey }),
          });

          return {
            ...signUpRes,
            verificationToken,
            action: AuthAction.SIGNUP,
          };
        } else {
          const loginRes = await this.loginWithOtp({
            verificationToken,
            ...(publicKey && { publicKey }),
            ...(invalidateExisting && { invalidateExisting }),
            ...(sessionKey && { sessionKey }),
          });

          return {
            ...loginRes,
            verificationToken,
            action: AuthAction.LOGIN,
          };
        }
      },
      {
        errorMessage: "Failed to complete OTP process",
        errorCode: TurnkeyErrorCodes.OTP_COMPLETION_ERROR,
      },
    );
  };

  /**
   * Completes the OAuth authentication flow by either signing up or logging in the user, depending on whether a sub-organization already exists for the provided OIDC token.
   *
   * - This function first checks if there is an existing sub-organization associated with the OIDC token.
   * - If a sub-organization exists, it proceeds with the OAuth login flow.
   * - If no sub-organization exists, it creates a new sub-organization and completes the sign-up flow.
   * - Optionally accepts a custom OAuth provider name, session key, and additional sub-organization creation parameters.
   * - Handles session storage and management, and supports invalidating existing sessions if specified.
   *
   * @param params.oidcToken - OIDC token received after successful authentication with the OAuth provider.
   * @param params.publicKey - public key to use for authentication. Must be generated prior to calling this function, this is because the OIDC nonce has to be set to `sha256(publicKey)`.
   * @param params.providerName - name of the OAuth provider (defaults to a generated name with a timestamp).
   * @param params.createSubOrgParams - parameters for sub-organization creation (e.g., authenticators, user metadata).
   * @param params.invalidateExisting - flag to invalidate existing sessions for the user.
   * @param params.sessionKey - session key to use for session creation (defaults to the default session key).
   *
   * @returns A promise that resolves to an object containing:
   *          - `sessionToken`: the signed JWT session token.
   *          - `action`: whether the flow resulted in a login or signup ({@link AuthAction}).
   * @throws {TurnkeyError} If there is an error during the OAuth completion process, such as account lookup, sign-up, or login.
   */
  completeOauth = async (
    params: CompleteOauthParams,
  ): Promise<BaseAuthResult & { action: AuthAction }> => {
    const {
      oidcToken,
      publicKey,
      providerName,
      createSubOrgParams,
      invalidateExisting,
      sessionKey,
    } = params;

    return withTurnkeyErrorHandling(
      async () => {
        const accountRes = await this.httpClient.proxyGetAccount({
          filterType: "OIDC_TOKEN",
          filterValue: oidcToken,
        });

        if (!accountRes) {
          throw new TurnkeyError(
            `Account fetch failed`,
            TurnkeyErrorCodes.ACCOUNT_FETCH_ERROR,
          );
        }
        const subOrganizationId = accountRes.organizationId;

        if (subOrganizationId) {
          const loginRes = await this.loginWithOauth({
            oidcToken,
            publicKey,
            ...(invalidateExisting && { invalidateExisting }),
            ...(sessionKey && { sessionKey }),
          });

          return {
            ...loginRes,
            action: AuthAction.LOGIN,
          };
        } else {
          const signUpRes = await this.signUpWithOauth({
            oidcToken,
            publicKey,
            ...(providerName && {
              providerName,
            }),
            ...(createSubOrgParams && {
              createSubOrgParams,
            }),
            ...(invalidateExisting && { invalidateExisting }),
            ...(sessionKey && { sessionKey }),
          });

          return {
            ...signUpRes,
            action: AuthAction.SIGNUP,
          };
        }
      },
      {
        errorMessage: "Failed to complete OAuth process",
        errorCode: TurnkeyErrorCodes.OAUTH_LOGIN_ERROR,
      },
    );
  };

  /**
   * Logs in a user using OAuth authentication.
   *
   * - This function logs in a user using the provided OIDC token and public key.
   * - Optionally invalidates any existing sessions for the user if `invalidateExisting` is set to true.
   * - Stores the resulting session token under the specified session key, or the default session key if not provided.
   * - Handles cleanup of unused key pairs if login fails.
   *
   * @param params.oidcToken - OIDC token received after successful authentication with the OAuth provider.
   * @param params.publicKey - The public key bound to the login session. This key is required because it is directly
   *                           tied to the nonce used during OIDC token generation and must match the value
   *                           encoded in the token.
   * @param params.organizationId - ID of the organization to target when creating the session.
   * @param params.invalidateExisting - flag to invalidate existing sessions for the user.
   * @param params.sessionKey - session key to use for session creation (defaults to the default session key).
   * @returns A promise that resolves to a {@link BaseAuthResult}, which includes:
   *          - `sessionToken`: the signed JWT session token.
   * @throws {TurnkeyError} If there is an error during the OAuth login process or if key pair cleanup fails.
   */
  loginWithOauth = async (
    params: LoginWithOauthParams,
  ): Promise<BaseAuthResult> => {
    const {
      oidcToken,
      publicKey,
      organizationId,
      invalidateExisting = false,
      sessionKey = SessionKey.DefaultSessionkey,
    } = params;

    return withTurnkeyErrorHandling(
      async () => {
        if (!publicKey) {
          throw new TurnkeyError(
            "Public key must be provided to log in with OAuth. Please create a key pair first.",
            TurnkeyErrorCodes.MISSING_PARAMS,
          );
        }

        const loginRes = await this.httpClient.proxyOAuthLogin({
          oidcToken,
          publicKey,
          invalidateExisting,
          ...(organizationId && { organizationId }),
        });

        if (!loginRes) {
          throw new TurnkeyError(
            `Auth proxy OAuth login failed`,
            TurnkeyErrorCodes.OAUTH_LOGIN_ERROR,
          );
        }

        if (!loginRes.session) {
          throw new TurnkeyError(
            "No session returned from oauth login",
            TurnkeyErrorCodes.OAUTH_LOGIN_ERROR,
          );
        }

        await this.storeSession({
          sessionToken: loginRes.session,
          sessionKey,
        });

        return { sessionToken: loginRes.session };
      },
      {
        errorMessage: "Failed to complete OAuth login",
        errorCode: TurnkeyErrorCodes.OAUTH_LOGIN_ERROR,
        customErrorsByMessages: {
          "OAUTH disallowed": {
            message:
              "OAuth is disabled on the dashboard for this organization.",
            code: TurnkeyErrorCodes.AUTH_METHOD_NOT_ENABLED,
          },
        },
        catchFn: async () => {
          // Clean up the generated key pair if it wasn't successfully used
          if (publicKey) {
            try {
              await this.apiKeyStamper?.deleteKeyPair(publicKey);
            } catch (cleanupError) {
              throw new TurnkeyError(
                `Failed to clean up generated key pair`,
                TurnkeyErrorCodes.KEY_PAIR_CLEANUP_ERROR,
                cleanupError,
              );
            }
          }
        },
      },
    );
  };

  /**
   * Signs up a user using OAuth authentication.
   *
   * - This function creates a new sub-organization for the user using the provided OIDC token, public key, and provider name.
   * - Handles the full OAuth sign-up flow, including sub-organization creation and session management.
   * - Optionally accepts additional sub-organization creation parameters and a custom session key.
   * - After successful sign-up, automatically logs in the user and returns a signed JWT session token.
   *
   * @param params.oidcToken - OIDC token received after successful authentication with the OAuth provider.
   * @param params.publicKey - public key to associate with the new sub-organization.
   * @param params.providerName - name of the OAuth provider (e.g., "Google", "Apple").
   * @param params.createSubOrgParams - parameters for sub-organization creation (e.g., authenticators, user metadata).
   * @param params.sessionKey - session key to use for session creation (defaults to the default session key).
   * @returns A promise that resolves to a {@link BaseAuthResult}, which includes:
   *          - `sessionToken`: the signed JWT session token.
   * @throws {TurnkeyError} If there is an error during the OAuth sign-up or login process.
   */
  signUpWithOauth = async (
    params: SignUpWithOauthParams,
  ): Promise<BaseAuthResult> => {
    const {
      oidcToken,
      publicKey,
      providerName = "OpenID Connect Provider" + " " + Date.now(),
      createSubOrgParams,
      sessionKey,
    } = params;

    return withTurnkeyErrorHandling(
      async () => {
        const signUpBody = buildSignUpBody({
          createSubOrgParams: {
            ...createSubOrgParams,
            oauthProviders: [
              {
                providerName,
                oidcToken,
              },
            ],
          },
        });

        const signupRes = await this.httpClient.proxySignup(signUpBody);

        if (!signupRes) {
          throw new TurnkeyError(
            `Auth proxy OAuth signup failed`,
            TurnkeyErrorCodes.OAUTH_SIGNUP_ERROR,
          );
        }

        const oauthRes = await this.loginWithOauth({
          oidcToken,
          publicKey: publicKey!,
          ...(sessionKey && { sessionKey }),
        });

        return {
          ...oauthRes,
          appProofs: signupRes.appProofs,
        };
      },
      {
        errorMessage: "Failed to sign up with OAuth",
        errorCode: TurnkeyErrorCodes.OAUTH_SIGNUP_ERROR,
      },
    );
  };

  /**
   * Fetches all wallets for the current user, including both embedded and connected wallets.
   *
   * - Retrieves all wallets associated with the organizationId from the current active session.
   * - For each embedded wallet, automatically fetches and attaches all associated wallet accounts.
   * - For connected wallets (e.g., browser extensions or external providers), groups providers by wallet name and attaches all connected accounts.
   * - Returns both embedded and connected wallets in a single array, each with their respective accounts populated.
   * - Optionally allows stamping the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   *
   * @param params.walletProviders - array of wallet providers to use for fetching wallets.
   * @param params.organizationId - organization ID to target (defaults to the session's organization ID).
   * @param params.userId - user ID to target (defaults to the session's user ID).
   * @param params.connectedOnly - if true, fetches only connected wallets; if false or undefined, fetches both embedded and connected wallets.
   * @param params.stampWith - parameter to stamp the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   * @returns A promise that resolves to an array of `Wallet` objects.
   * @throws {TurnkeyError} If no active session is found or if there is an error fetching wallets.
   */
  fetchWallets = async (params?: FetchWalletsParams): Promise<Wallet[]> => {
    const {
      walletProviders,
      organizationId: organizationIdFromParams,
      userId: userIdFromParams,
      connectedOnly,
      stampWith = this.config.defaultStamperType,
    } = params || {};
    const session = await this.storageManager.getActiveSession();
    if (!session && !connectedOnly) {
      throw new TurnkeyError(
        "No active session found. Fetching embedded wallets requires a valid session. If you only need connected wallets, set the 'connectedOnly' parameter to true.",
        TurnkeyErrorCodes.NO_SESSION_FOUND,
      );
    }

    // if `connectedOnly` is true, we need to make sure the walletManager is initialized
    // or else we can't fetch connected wallets, and we throw an error
    if (connectedOnly && !this.walletManager?.connector) {
      throw new TurnkeyError(
        "Wallet connector is not initialized",
        TurnkeyErrorCodes.WALLET_MANAGER_COMPONENT_NOT_INITIALIZED,
      );
    }

    return withTurnkeyErrorHandling(
      async () => {
        let embedded: EmbeddedWallet[] = [];

        const organizationId =
          organizationIdFromParams || session?.organizationId;
        const userId = userIdFromParams || session?.userId;

        // we start fetching user early if we have the required params (needed for connected wallets)
        // this runs in parallel with the embedded wallet fetching below
        let userPromise:
          | Promise<{ ethereum: string[]; solana: string[] }>
          | undefined;
        if (organizationId && userId && this.walletManager?.connector) {
          const signedUserRequest = await this.httpClient.stampGetUser(
            {
              userId,
              organizationId,
            },
            stampWith,
          );
          if (!signedUserRequest) {
            throw new TurnkeyError(
              "Failed to stamp user request",
              TurnkeyErrorCodes.INVALID_REQUEST,
            );
          }
          userPromise = sendSignedRequest<TGetUserResponse>(
            signedUserRequest,
          ).then((response) => getAuthenticatorAddresses(response.user));
        }

        // if connectedOnly is true, we skip fetching embedded wallets
        if (!connectedOnly) {
          if (!organizationId) {
            throw new TurnkeyError(
              "No organization ID provided and no active session found. Please log in first or pass in an organization ID.",
              TurnkeyErrorCodes.INVALID_REQUEST,
            );
          }

          if (!userId) {
            throw new TurnkeyError(
              "No user ID provided and no active session found. Please log in first or pass in a user ID.",
              TurnkeyErrorCodes.INVALID_REQUEST,
            );
          }

          // we stamp the wallet request first
          // this is done to avoid concurrent passkey prompts
          const signedWalletsRequest = await this.httpClient.stampGetWallets(
            {
              organizationId,
            },
            stampWith,
          );

          if (!signedWalletsRequest) {
            throw new TurnkeyError(
              "Failed to stamp wallet request",
              TurnkeyErrorCodes.INVALID_REQUEST,
            );
          }

          const [accounts, walletsRes] = await Promise.all([
            fetchAllWalletAccountsWithCursor(
              this.httpClient,
              organizationId,
              stampWith,
            ),
            sendSignedRequest<TGetWalletsResponse>(signedWalletsRequest),
          ]);

          // create a map of walletId to EmbeddedWallet for easy lookup
          const walletMap: Map<string, EmbeddedWallet> = new Map(
            walletsRes.wallets.map((wallet) => [
              wallet.walletId,
              {
                ...wallet,
                source: WalletSource.Embedded,
                accounts: [],
              },
            ]),
          );
          // map the accounts to their respective wallets
          embedded = mapAccountsToWallet(accounts, walletMap);
        }

        // if wallet connecting is disabled we return only embedded wallets
        // this will never be hit if `connectedOnly` is true because of the check above
        if (!this.walletManager?.connector) return embedded;

        const providers =
          walletProviders ?? (await this.fetchWalletProviders());

        const groupedProviders = new Map<string, WalletProvider[]>();
        for (const provider of providers) {
          // connected wallets don't all have some uuid we can use for the walletId
          // so what we do is we use a normalized version of the name for the wallet, like "metamask" or "phantom-wallet"
          const walletId =
            provider.info?.name?.toLowerCase().replace(/\s+/g, "-") ||
            "unknown";
          const group = groupedProviders.get(walletId) || [];
          group.push(provider);
          groupedProviders.set(walletId, group);
        }

        // we fetch user once for all connected wallets to avoid duplicate `fetchUser` calls
        // this is only done if we have `organizationId` and `userId`
        // Note: this was started earlier in parallel with embedded wallet fetching for performance
        let authenticatorAddresses:
          | { ethereum: string[]; solana: string[] }
          | undefined;
        if (userPromise) {
          authenticatorAddresses = await userPromise;
        }

        // has to be done in a for of loop so we can await each fetchWalletAccounts call individually
        // otherwise await Promise.all would cause them all to fire at once breaking passkey only set ups
        // (multiple wallet fetches at once causing "OperationError: A request is already pending.")
        let connected: ConnectedWallet[] = [];
        for (const [walletId, grouped] of groupedProviders.entries()) {
          const timestamp = toExternalTimestamp();

          const wallet: Wallet = {
            source: WalletSource.Connected,
            walletId,
            walletName: grouped[0]?.info?.name ?? "Unknown",
            createdAt: timestamp,
            updatedAt: timestamp,
            exported: false,
            imported: false,
            accounts: [],
          };

          const accounts = await this.fetchWalletAccounts({
            wallet,
            walletProviders: grouped,
            ...(stampWith !== undefined && { stampWith }),
            ...(organizationIdFromParams !== undefined && {
              organizationId: organizationIdFromParams,
            }),
            ...(userIdFromParams !== undefined && { userId: userIdFromParams }),
            ...(authenticatorAddresses && { authenticatorAddresses }),
          });

          wallet.accounts = accounts;
          if (wallet.accounts.length > 0) {
            connected.push(wallet);
          }
        }

        return [...embedded, ...connected];
      },
      {
        errorMessage: "Failed to fetch wallets",
        errorCode: TurnkeyErrorCodes.FETCH_WALLETS_ERROR,
      },
    );
  };

  /**
   * Fetches all accounts for a specific wallet, including both embedded and connected wallet accounts.
   *
   * - For embedded wallets, retrieves accounts from the Turnkey API, supporting pagination (defaults to the first page with a limit of 100 accounts).
   * - For connected wallets (e.g., browser extensions or external providers), constructs account objects for each connected address from the provided or discovered wallet providers.
   * - Automatically determines the account type and populates relevant fields such as address, curve, and signing capability.
   * - Optionally allows filtering by a specific set of wallet providers and supports custom pagination options.
   * - Supports stamping the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   *
   * @param params.wallet - wallet for which to fetch accounts.
   * @param params.walletProviders - list of wallet providers to filter by (used for connected wallets).
   * @param params.paginationOptions - pagination options for embedded wallets.
   * @param params.stampWith - parameter to stamp the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   * @param params.organizationId - organization ID to target (defaults to the session's organization ID).
   * @param params.userId - user ID to target (defaults to the session's user ID).
   * @param params.authenticatorAddresses - optional authenticator addresses to avoid redundant user fetches (this is used for connected wallets to determine if a connected wallet is an authenticator)
   *
   * @returns A promise that resolves to an array of `v1WalletAccount` objects.
   * @throws {TurnkeyError} If no active session is found or if there is an error fetching wallet accounts.
   */
  fetchWalletAccounts = async (
    params: FetchWalletAccountsParams,
  ): Promise<WalletAccount[]> => {
    const {
      wallet,
      stampWith = this.config.defaultStamperType,
      walletProviders,
      paginationOptions,
    } = params;
    const session = await this.storageManager.getActiveSession();

    const organizationId = params?.organizationId || session?.organizationId;
    const userId = params?.userId || session?.userId;

    return withTurnkeyErrorHandling(
      async () => {
        // this is an embedded wallet so we fetch accounts from Turnkey
        if (wallet.source === WalletSource.Embedded) {
          const embedded: EmbeddedWalletAccount[] = [];

          if (!organizationId) {
            throw new TurnkeyError(
              "No organization ID provided and no active session found. Please log in first or pass in an organization ID.",
              TurnkeyErrorCodes.INVALID_REQUEST,
            );
          }

          if (!userId) {
            throw new TurnkeyError(
              "No user ID provided and no active session found. Please log in first or pass in a user ID.",
              TurnkeyErrorCodes.INVALID_REQUEST,
            );
          }

          const res = await this.httpClient.getWalletAccounts(
            {
              walletId: wallet.walletId,
              organizationId,
              paginationOptions: paginationOptions || { limit: "100" },
            },
            stampWith,
          );

          if (!res || !res.accounts) {
            throw new TurnkeyError(
              "No wallet accounts found in the response",
              TurnkeyErrorCodes.BAD_RESPONSE,
            );
          }

          for (const account of res.accounts) {
            embedded.push({
              ...account,
              source: WalletSource.Embedded,
            });
          }

          return embedded;
        }

        // this is an external wallet so we fetch accounts from the connected wallet provider

        // if wallet connecting is disabled we return only embedded wallets
        // we should never reach this point if wallet connecting is disabled
        if (!this.walletManager?.connector) return [];

        const connected: ConnectedWalletAccount[] = [];

        const providers =
          walletProviders ?? (await this.fetchWalletProviders());

        // Context: connected wallets don't all have some uuid we can use for the walletId so what
        //          we do is we use a normalized version of the name for the wallet, like "metamask"
        //          or "phantom-wallet"
        //
        // when fetching accounts, we select all providers with this normalized walletId.
        // A single wallet can map to multiple providers if it supports multiple chains
        // (e.g. MetaMask for Ethereum and MetaMask for Solana)
        const matching = providers.filter(
          (p) =>
            p.info?.name?.toLowerCase().replace(/\s+/g, "-") ===
              wallet.walletId && p.connectedAddresses.length > 0,
        );

        const sign = this.walletManager!.connector!.sign.bind(
          this.walletManager!.connector,
        );

        let ethereumAddresses: string[] = [];
        let solanaAddresses: string[] = [];

        if (params.authenticatorAddresses) {
          ({ ethereum: ethereumAddresses, solana: solanaAddresses } =
            params.authenticatorAddresses);
        } else if (organizationId && userId) {
          // we only fetch the user if authenticator addresses aren't provided and we have the organizationId and userId
          // if not, then that means `isAuthenticator` will always be false
          const user = await this.fetchUser({
            userId,
            organizationId,
            stampWith,
          });

          ({ ethereum: ethereumAddresses, solana: solanaAddresses } =
            getAuthenticatorAddresses(user));
        }

        for (const provider of matching) {
          const timestamp = toExternalTimestamp();

          for (const address of provider.connectedAddresses) {
            if (isEthereumProvider(provider)) {
              const evmAccount: ConnectedEthereumWalletAccount = {
                walletAccountId: `${wallet.walletId}-${provider.interfaceType}-${address}`,
                organizationId: organizationId ?? "",
                walletId: wallet.walletId,
                pathFormat: "PATH_FORMAT_BIP32",
                path: WalletSource.Connected,
                source: WalletSource.Connected,
                address,
                createdAt: timestamp,
                updatedAt: timestamp,

                // ethereum specific
                curve: Curve.SECP256K1,
                addressFormat: "ADDRESS_FORMAT_ETHEREUM",
                chainInfo: provider.chainInfo,
                isAuthenticator: ethereumAddresses.includes(
                  address.toLowerCase(),
                ),
                signMessage: (msg: string) =>
                  sign(msg, provider, SignIntent.SignMessage),
                signAndSendTransaction: (tx: string) =>
                  sign(tx, provider, SignIntent.SignAndSendTransaction),
              };

              connected.push(evmAccount);
              continue;
            }

            if (isSolanaProvider(provider)) {
              const solAccount: ConnectedSolanaWalletAccount = {
                walletAccountId: `${wallet.walletId}-${provider.interfaceType}-${address}`,
                organizationId: organizationId ?? "",
                walletId: wallet.walletId,
                pathFormat: "PATH_FORMAT_BIP32",
                path: WalletSource.Connected,
                source: WalletSource.Connected,
                address,
                createdAt: timestamp,
                updatedAt: timestamp,

                // solana specific
                publicKey: address,
                curve: Curve.ED25519,
                addressFormat: "ADDRESS_FORMAT_SOLANA",
                chainInfo: provider.chainInfo,
                isAuthenticator: solanaAddresses.includes(address),
                signMessage: (msg: string) =>
                  sign(msg, provider, SignIntent.SignMessage),
                signTransaction: (tx: string) =>
                  sign(tx, provider, SignIntent.SignTransaction),
              };

              connected.push(solAccount);
              continue;
            }

            throw new Error(
              `Unsupported wallet chain: ${provider.chainInfo}. Supported chains are Ethereum and Solana.`,
            );
          }
        }

        return connected;
      },
      {
        errorMessage: "Failed to fetch wallet accounts",
        errorCode: TurnkeyErrorCodes.FETCH_WALLET_ACCOUNTS_ERROR,
      },
    );
  };

  /**
   * Fetches all private keys for the current user.
   *
   * - Retrieves private keys from the Turnkey API.
   * - Supports stamping the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   *
   * @param params.stampWith - parameter to stamp the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   * @param params.organizationId - organization ID to target (defaults to the session's organization ID).
   * @returns A promise that resolves to an array of `v1PrivateKey` objects.
   * @throws {TurnkeyError} If no active session is found or if there is an error fetching private keys.
   */
  fetchPrivateKeys = async (
    params?: FetchPrivateKeysParams,
  ): Promise<v1PrivateKey[]> => {
    const { stampWith = this.config.defaultStamperType } = params || {};
    const session = await getActiveSessionOrThrowIfRequired(
      stampWith,
      this.storageManager.getActiveSession,
    );

    const organizationId = params?.organizationId || session?.organizationId;

    if (!organizationId) {
      throw new TurnkeyError(
        "No organization ID provided and no active session found. Please log in first or pass in an organization ID.",
        TurnkeyErrorCodes.INVALID_REQUEST,
      );
    }

    return withTurnkeyErrorHandling(
      async () => {
        const res = await this.httpClient.getPrivateKeys(
          { organizationId },
          stampWith,
        );

        if (!res) {
          throw new TurnkeyError(
            "Failed to fetch private keys",
            TurnkeyErrorCodes.BAD_RESPONSE,
          );
        }

        return res.privateKeys;
      },
      {
        errorMessage: "Failed to fetch private keys",
        errorCode: TurnkeyErrorCodes.FETCH_PRIVATE_KEYS_ERROR,
      },
    );
  };

  /**
   * Signs a message using the specified wallet account.
   *
   * Behavior differs depending on the wallet type:
   *
   * - **Connected wallets**
   *   - Delegates signing to the wallet provider’s native signing method.
   *   - *Ethereum*: signatures always follow [EIP-191](https://eips.ethereum.org/EIPS/eip-191).
   *     - The wallet automatically prefixes messages with
   *       `"\x19Ethereum Signed Message:\n" + message length` before signing.
   *     - As a result, these signatures cannot be used as raw transaction signatures or broadcast on-chain.
   *     - If `addEthereumPrefix` is set to `false`, an error is thrown because connected Ethereum wallets always prefix.
   *   - *Other chains*: follows the native connected wallet behavior.
   *
   * - **Embedded wallets**
   *   - Uses the Turnkey API to sign the message directly.
   *   - Supports optional `addEthereumPrefix`:
   *     - If `true` (default for Ethereum), the message is prefixed before signing.
   *     - If `false`, the raw message is signed without any prefix.
   *
   * Additional details:
   * - Automatically handles encoding and hashing based on the wallet account’s address format,
   *   unless explicitly overridden.
   * - Optionally allows stamping with a specific stamper
   *   (`StamperType.Passkey`, `StamperType.ApiKey`, or `StamperType.Wallet`).
   *
   * @param params.message - plaintext (UTF-8) message to sign.
   * @param params.walletAccount - wallet account to use for signing.
   * @param params.encoding - override for payload encoding (defaults to the encoding appropriate for the address format).
   * @param params.hashFunction - override for hash function (defaults to the function appropriate for the address format).
   * @param params.stampWith - optional stamper for the signing request.
   * @param params.addEthereumPrefix - whether to prefix the message with Ethereum’s
   *   `"\x19Ethereum Signed Message:\n"` string (default: `true` for Ethereum).
   * @param params.organizationId - organization ID to target (defaults to the session's organization ID).
   *
   * @returns A promise that resolves to a `v1SignRawPayloadResult` containing the signature and metadata.
   * @throws {TurnkeyError} If signing fails, the wallet type does not support message signing, or the response is invalid.
   */
  signMessage = async (
    params: SignMessageParams,
  ): Promise<v1SignRawPayloadResult> => {
    const {
      message,
      walletAccount,
      stampWith = this.config.defaultStamperType,
      addEthereumPrefix,
      organizationId,
    } = params;

    const hashFunction =
      params.hashFunction || getHashFunction(walletAccount.addressFormat);
    const payloadEncoding =
      params.encoding || getEncodingType(walletAccount.addressFormat);

    return withTurnkeyErrorHandling(
      async () => {
        const isEthereum =
          walletAccount.addressFormat === "ADDRESS_FORMAT_ETHEREUM";

        if (walletAccount.source === WalletSource.Connected) {
          // this is a connected wallet

          if (!addEthereumPrefix && isEthereum) {
            throw new TurnkeyError(
              "Connected Ethereum wallets automatically prefix messages. Use `addEthereumPrefix: true`.",
              TurnkeyErrorCodes.SIGN_MESSAGE_ERROR,
            );
          }

          let encodedMessage = message;
          if (isEthereum) {
            const msgBytes = toUtf8Bytes(message);
            encodedMessage = getEncodedMessage(payloadEncoding, msgBytes);
          }

          const sigHex = await walletAccount.signMessage(encodedMessage);
          return splitSignature(sigHex, walletAccount.addressFormat);
        }

        // this is an embedded wallet
        let msgBytes = toUtf8Bytes(message);

        if (addEthereumPrefix && isEthereum) {
          const prefix = `\x19Ethereum Signed Message:\n${msgBytes.length}`;
          const prefixBytes = toUtf8Bytes(prefix);

          const combined = new Uint8Array(prefixBytes.length + msgBytes.length);
          combined.set(prefixBytes, 0);
          combined.set(msgBytes, prefixBytes.length);

          msgBytes = combined;
        }

        const encodedMessage = getEncodedMessage(payloadEncoding, msgBytes);

        const response = await this.httpClient.signRawPayload(
          {
            signWith: walletAccount.address,
            payload: encodedMessage,
            encoding: payloadEncoding,
            hashFunction,
            ...(organizationId && { organizationId }),
          },
          stampWith,
        );

        if (response.activity.failure) {
          throw new TurnkeyError(
            "Failed to sign message, no signed payload returned",
            TurnkeyErrorCodes.SIGN_MESSAGE_ERROR,
          );
        }

        return response.activity.result
          .signRawPayloadResult as v1SignRawPayloadResult;
      },
      {
        errorMessage: "Failed to sign message",
        errorCode: TurnkeyErrorCodes.SIGN_MESSAGE_ERROR,
      },
    );
  };

  /**
   * Signs a transaction using the specified wallet account.
   *
   * Behavior differs depending on the type of wallet:
   *
   * - **Connected wallets**
   *   - Ethereum: does not support raw transaction signing. Calling this function will throw an error instructing you to use `signAndSendTransaction` instead.
   *   - Solana: supports raw transaction signing via the connected wallet provider.
   *   - Other chains: not supported; will throw an error.
   *
   * - **Embedded wallets**
   *   - Delegates signing to the Turnkey API, which returns the signed transaction.
   *   - Supports all Turnkey-supported transaction types (e.g., Ethereum, Solana, Tron).
   *   - Optionally allows stamping with a specific stamper (`StamperType.Passkey`, `StamperType.ApiKey`, or `StamperType.Wallet`).
   *   - Note: For embedded Ethereum wallets, the returned signature doesn’t include the `0x` prefix. You should add `0x` before
   *     broadcasting if it’s missing. It’s a good idea to check whether the signature already starts with `0x` before adding it,
   *     since we plan to include the prefix by default in a future breaking change.
   *
   * @param params.walletAccount - wallet account to use for signing.
   * @param params.unsignedTransaction - unsigned transaction data as a serialized
   *   string in the canonical encoding for the given `transactionType`.
   * @param params.transactionType - type of transaction (e.g., "TRANSACTION_TYPE_ETHEREUM", "TRANSACTION_TYPE_SOLANA", "TRANSACTION_TYPE_TRON").
   * @param params.stampWith - stamper to use for signing (`StamperType.Passkey`, `StamperType.ApiKey`, or `StamperType.Wallet`).
   * @param params.organizationId - organization ID to target (defaults to the session's organization ID).
   * @returns A promise that resolves to the signed transaction string.
   * @throws {TurnkeyError} If the wallet type is unsupported, signing fails, or the response is invalid.
   */
  signTransaction = async (params: SignTransactionParams): Promise<string> => {
    const {
      walletAccount,
      unsignedTransaction,
      transactionType,
      stampWith = this.config.defaultStamperType,
      organizationId,
    } = params;

    return withTurnkeyErrorHandling(
      async () => {
        if (walletAccount.source === WalletSource.Connected) {
          switch (walletAccount.chainInfo.namespace) {
            case Chain.Ethereum:
              throw new TurnkeyError(
                "Ethereum connected wallets do not support raw transaction signing. Use signAndSendTransaction instead.",
                TurnkeyErrorCodes.INVALID_REQUEST,
              );

            case Chain.Solana:
              // not sure why typescript isn't inferring the type here
              // if namespace is Chain.Solana, then it must be a ConnectedSolanaWalletAccount
              return (
                walletAccount as ConnectedSolanaWalletAccount
              ).signTransaction(unsignedTransaction);

            default:
              throw new TurnkeyError(
                "Unsupported connected wallet type.",
                TurnkeyErrorCodes.INVALID_REQUEST,
              );
          }
        }

        // this is an embedded wallet account
        const signTransaction = await this.httpClient.signTransaction(
          {
            signWith: walletAccount.address,
            unsignedTransaction,
            type: transactionType,
            ...(organizationId && { organizationId }),
          },
          stampWith,
        );

        // TODO (breaking change): eventually we should append a `0x` prefix for ethereum signatures here
        // then we should remove the note in the comment header
        return signTransaction.signedTransaction;
      },
      {
        errorMessage: "Failed to sign transaction",
        errorCode: TurnkeyErrorCodes.SIGN_TRANSACTION_ERROR,
      },
    );
  };

  /**
   * Signs and broadcasts a transaction using the specified wallet account.
   *
   * Behavior differs depending on the type of wallet:
   *
   * - **Connected wallets**
   *   - *Ethereum*: delegates to the wallet’s native `signAndSendTransaction` method.
   *     - Does **not** require an `rpcUrl` (the wallet handles broadcasting).
   *   - *Solana*: signs the transaction locally with the connected wallet, but requires an `rpcUrl` to broadcast it.
   *   - Other chains: not supported; will throw an error.
   *
   * - **Embedded wallets**
   *   - Signs the transaction using the Turnkey API.
   *   - Requires an `rpcUrl` to broadcast the signed transaction, since Turnkey does not broadcast directly.
   *   - Broadcasts the transaction using a JSON-RPC client and returns the resulting transaction hash/signature.
   *   - Optionally allows stamping with a specific stamper (`StamperType.Passkey`, `StamperType.ApiKey`, or `StamperType.Wallet`).
   *
   * @param params.walletAccount - wallet account to use for signing and broadcasting.
   * @param params.unsignedTransaction - unsigned transaction data as a serialized
   *   string in the canonical encoding for the given `transactionType`.
   * @param params.transactionType - type of transaction (e.g., `"TRANSACTION_TYPE_SOLANA"`, `"TRANSACTION_TYPE_ETHEREUM"`).
   * @param params.rpcUrl - JSON-RPC endpoint used for broadcasting (required for Solana connected wallets and all embedded wallets).
   * @param params.stampWith - optional stamper to use when signing (`StamperType.Passkey`, `StamperType.ApiKey`, or `StamperType.Wallet`).
   * @param params.organizationId - **Only for Turnkey embedded wallets**: organization ID to target (defaults to the session's organization ID).
   * @returns A promise that resolves to a transaction signature or hash.
   * @throws {TurnkeyError} If the wallet type is unsupported, or if signing/broadcasting fails.
   */
  signAndSendTransaction = async (
    params: SignAndSendTransactionParams,
  ): Promise<string> => {
    const {
      walletAccount,
      unsignedTransaction,
      transactionType,
      rpcUrl,
      stampWith = this.config.defaultStamperType,
      organizationId,
    } = params;

    return withTurnkeyErrorHandling(
      async () => {
        if (walletAccount.source === WalletSource.Connected) {
          // this is a connected wallet account
          switch (walletAccount.chainInfo.namespace) {
            case Chain.Ethereum:
              // not sure why typescript isn't inferring the type here
              // if namespace is Chain.Ethereum, then it must be a ConnectedEthereumWalletAccount
              return await (
                walletAccount as ConnectedEthereumWalletAccount
              ).signAndSendTransaction(unsignedTransaction);

            case Chain.Solana:
              if (!rpcUrl) {
                throw new TurnkeyError(
                  "Missing rpcUrl: connected Solana wallets require an RPC URL to broadcast transactions.",
                  TurnkeyErrorCodes.SIGN_AND_SEND_TRANSACTION_ERROR,
                );
              }
              // not sure why typescript isn't inferring the type here
              // if namespace is Chain.Solana, then it must be a ConnectedSolanaWalletAccount
              const signature = await (
                walletAccount as ConnectedSolanaWalletAccount
              ).signTransaction(unsignedTransaction);
              return await broadcastTransaction({
                signedTransaction: signature,
                rpcUrl,
                transactionType,
              });

            default:
              throw new TurnkeyError(
                "Connected wallets do not support signAndSendTransaction for this transaction type.",
                TurnkeyErrorCodes.SIGN_AND_SEND_TRANSACTION_ERROR,
              );
          }
        }

        // this is an embedded wallet account

        // embedded wallet requires an RPC URL to broadcast
        // since Turnkey does not broadcast transactions directly
        if (!rpcUrl) {
          throw new TurnkeyError(
            "Missing rpcUrl: embedded wallets require an RPC URL to broadcast transactions.",
            TurnkeyErrorCodes.SIGN_AND_SEND_TRANSACTION_ERROR,
          );
        }

        const signTransactionResponse = await this.httpClient.signTransaction(
          {
            signWith: walletAccount.address,
            unsignedTransaction,
            type: transactionType,
            ...(organizationId && { organizationId }),
          },
          stampWith,
        );

        const signedTx =
          transactionType === "TRANSACTION_TYPE_ETHEREUM"
            ? `0x${signTransactionResponse.signedTransaction}`
            : signTransactionResponse.signedTransaction;

        const txHash = await broadcastTransaction({
          signedTransaction: signedTx,
          rpcUrl,
          transactionType,
        });

        return txHash;
      },
      {
        errorMessage: "Failed to sign and send transaction",
        errorCode: TurnkeyErrorCodes.SIGN_AND_SEND_TRANSACTION_ERROR,
      },
    );
  };

  /**
   * Fetches the user details for the current session or a specified user.
   *
   * - Retrieves user details from the Turnkey API using the provided userId and organizationId, or defaults to those from the active session.
   * - If no userId is provided, the userId from the current session is used.
   * - If no organizationId is provided, the organizationId from the current session is used.
   * - Optionally allows stamping the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   * - Ensures that an active session exists before making the request.
   *
   * @param params.organizationId - organization ID to specify the sub-organization (defaults to the current session's organizationId).
   * @param params.userId - user ID to fetch specific user details (defaults to the current session's userId).
   * @param params.stampWith - parameter to stamp the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   * @returns A promise that resolves to a `v1User` object containing the user details.
   * @throws {TurnkeyError} If there is no active session, if there is no userId, or if there is an error fetching user details.
   */
  fetchUser = async (params?: FetchUserParams): Promise<v1User> => {
    const {
      organizationId: organizationIdFromParams,
      userId: userIdFromParams,
      stampWith = this.config.defaultStamperType,
    } = params || {};
    const session = await getActiveSessionOrThrowIfRequired(
      stampWith,
      this.storageManager.getActiveSession,
    );

    const userId = userIdFromParams || session?.userId;
    if (!userId) {
      throw new TurnkeyError(
        "User ID must be provided to fetch user",
        TurnkeyErrorCodes.INVALID_REQUEST,
      );
    }

    const organizationId = organizationIdFromParams || session?.organizationId;
    if (!organizationId) {
      throw new TurnkeyError(
        "Organization ID must be provided to fetch user",
        TurnkeyErrorCodes.INVALID_REQUEST,
      );
    }

    return withTurnkeyErrorHandling(
      async () => {
        const userResponse = await this.httpClient.getUser(
          { organizationId, userId },
          stampWith,
        );

        if (!userResponse || !userResponse.user) {
          throw new TurnkeyError(
            "No user found in the response",
            TurnkeyErrorCodes.BAD_RESPONSE,
          );
        }

        return userResponse.user;
      },
      {
        errorMessage: "Failed to fetch user",
        errorCode: TurnkeyErrorCodes.FETCH_USER_ERROR,
      },
    );
  };

  /**
   * Fetches an existing user by P-256 API key public key, or creates a new one if none exists.
   *
   * - This function is idempotent: multiple calls with the same `publicKey` will always return the same user.
   * - Attempts to find a user whose API keys include the given P-256 public key.
   * - If a matching user is found, it is returned as-is.
   * - If no matching user is found, a new user is created with the given public key as a P-256 API key.
   *
   * @param params.publicKey - the P-256 public key to use for lookup and creation.
   * @param params.createParams.userName - optional username to assign if creating a new user (defaults to `"Public Key User"`).
   * @param params.createParams.apiKeyName - optional API key name to assign if creating a new API key (defaults to `public-key-user-${publicKey}`).
   * @param params.organizationId - organization ID to specify the sub-organization (defaults to the current session's organizationId).
   * @param params.stampWith - parameter to stamp the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   * @returns A promise that resolves to the existing or newly created {@link v1User}.
   * @throws {TurnkeyError} If there is no active session, if the input is invalid, if user retrieval fails, or if user creation fails.
   */
  fetchOrCreateP256ApiKeyUser = async (
    params: FetchOrCreateP256ApiKeyUserParams,
  ): Promise<v1User> => {
    const {
      publicKey,
      createParams,
      stampWith = this.config.defaultStamperType,
      organizationId: organizationIdFromParams,
    } = params;

    return withTurnkeyErrorHandling(
      async () => {
        const session = await getActiveSessionOrThrowIfRequired(
          stampWith,
          this.storageManager.getActiveSession,
        );

        const organizationId =
          organizationIdFromParams || session?.organizationId;
        if (!organizationId) {
          throw new TurnkeyError(
            "Organization ID is required to fetch or create P-256 API key user.",
            TurnkeyErrorCodes.INVALID_REQUEST,
          );
        }

        // we validate their input
        if (!publicKey?.trim()) {
          throw new TurnkeyError(
            "'publicKey' is required and cannot be empty.",
            TurnkeyErrorCodes.INVALID_REQUEST,
          );
        }

        const usersResponse = await this.httpClient.getUsers(
          {
            organizationId,
          },
          stampWith,
        );
        if (!usersResponse || !usersResponse.users) {
          throw new TurnkeyError(
            "No users found in the response",
            TurnkeyErrorCodes.BAD_RESPONSE,
          );
        }

        const userWithPublicKey = usersResponse.users.find((user) =>
          user.apiKeys.some(
            (apiKey) =>
              apiKey.credential.publicKey === publicKey &&
              apiKey.credential.type === "CREDENTIAL_TYPE_API_KEY_P256",
          ),
        );

        // the user already exists, so we return it
        if (userWithPublicKey) {
          return userWithPublicKey;
        }

        // at this point we know the user doesn't exist, so we create it
        const userName = createParams?.userName?.trim() || "Public Key User";
        const apiKeyName =
          createParams?.apiKeyName?.trim() || `public-key-user-${publicKey}`;

        const createUserResp = await this.httpClient.createUsers(
          {
            organizationId,
            users: [
              {
                userName: userName,
                userTags: [],
                apiKeys: [
                  {
                    apiKeyName: apiKeyName,
                    curveType: "API_KEY_CURVE_P256",
                    publicKey,
                  },
                ],
                authenticators: [],
                oauthProviders: [],
              },
            ],
          },
          stampWith,
        );

        if (
          !createUserResp?.userIds ||
          createUserResp.userIds.length === 0 ||
          !createUserResp.userIds[0]
        ) {
          throw new TurnkeyError(
            "Failed to create P-256 API key user",
            TurnkeyErrorCodes.CREATE_USERS_ERROR,
          );
        }

        const newUserId = createUserResp.userIds[0];

        return await this.fetchUser({
          organizationId,
          userId: newUserId,
          stampWith,
        });
      },
      {
        errorMessage: "Failed to get or create P-256 API key user",
        errorCode: TurnkeyErrorCodes.CREATE_USERS_ERROR,
      },
    );
  };

  /**
   * Fetches each requested policy if it exists, or creates it if it does not.
   *
   * - This function is idempotent: multiple calls with the same policies will not create duplicates.
   * - For every policy in the request:
   *   - If it already exists, it is returned with its `policyId`.
   *   - If it does not exist, it is created and returned with its new `policyId`.
   *
   * @param params.policies - the list of policies to fetch or create.
   * @param params.stampWith - parameter to stamp the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   * @param params.organizationId - organization ID to specify the sub-organization (defaults to the current session's organizationId).
   * @returns A promise that resolves to an array of objects, each containing:
   *          - `policyId`: the unique identifier of the policy.
   *          - `policyName`: human-readable name of the policy.
   *          - `effect`: the instruction to DENY or ALLOW an activity.
   *          - `condition`: (optional) the condition expression that triggers the effect.
   *          - `consensus`: (optional) the consensus expression that triggers the effect.
   *          - `notes`: (optional) developer notes or description for the policy.
   * @throws {TurnkeyError} If there is no active session, if the input is invalid,
   *                        if fetching policies fails, or if creating policies fails.
   */
  fetchOrCreatePolicies = async (
    params: FetchOrCreatePoliciesParams,
  ): Promise<FetchOrCreatePoliciesResult> => {
    const { policies, stampWith = this.config.defaultStamperType } = params;

    return await withTurnkeyErrorHandling(
      async () => {
        const session = await getActiveSessionOrThrowIfRequired(
          stampWith,
          this.storageManager.getActiveSession,
        );

        if (!Array.isArray(policies) || policies.length === 0) {
          throw new TurnkeyError(
            "'policies' must be a non-empty array of policy definitions.",
            TurnkeyErrorCodes.INVALID_REQUEST,
          );
        }

        const organizationId =
          params?.organizationId ?? session?.organizationId;
        if (!organizationId) {
          throw new TurnkeyError(
            "Organization ID is required to fetch or create policies.",
            TurnkeyErrorCodes.INVALID_REQUEST,
          );
        }

        // we first fetch existing policies
        const existingPoliciesResponse = await this.httpClient.getPolicies(
          {
            organizationId,
          },
          stampWith,
        );
        const existingPolicies = existingPoliciesResponse.policies || [];

        // we create a map of existing policies by their signature
        // where the policySignature maps to its policyId
        const existingPoliciesSignatureMap: Record<string, string> = {};
        for (const existingPolicy of existingPolicies) {
          const signature = getPolicySignature(existingPolicy);
          existingPoliciesSignatureMap[signature] = existingPolicy.policyId;
        }

        // we go through each requested policy and check if it already exists
        // if it exists, we add it to the alreadyExistingPolicies list
        // if it doesn't exist, we add it to the missingPolicies list
        const alreadyExistingPolicies: (v1CreatePolicyIntentV3 & {
          policyId: string;
        })[] = [];
        const missingPolicies: v1CreatePolicyIntentV3[] = [];

        for (const policy of policies) {
          const existingId =
            existingPoliciesSignatureMap[getPolicySignature(policy)];
          if (existingId) {
            alreadyExistingPolicies.push({ ...policy, policyId: existingId });
          } else {
            missingPolicies.push(policy);
          }
        }

        // if there are no missing policies, that means we're done
        // so we return them with their respective IDs
        if (missingPolicies.length === 0) {
          return alreadyExistingPolicies;
        }

        // at this point we know there is at least one missing policy.
        // so we create the missing policies and then return the full list

        const createPoliciesResponse = await this.httpClient.createPolicies(
          {
            organizationId,
            policies: missingPolicies,
          },
          stampWith,
        );

        // assign returned IDs back to the missing ones in order
        if (!createPoliciesResponse || !createPoliciesResponse.policyIds) {
          throw new TurnkeyError(
            "Failed to create missing policies",
            TurnkeyErrorCodes.CREATE_POLICY_ERROR,
          );
        }

        const newlyCreatedPolicies = missingPolicies.map((p, idx) => ({
          ...p,

          // we can safely assert the ID exists because we know Turnkey's api
          // will return one ID for each created policy or throw an error
          policyId: createPoliciesResponse.policyIds[idx]!,
        }));

        // we return the full list of policies, both existing and the newly created
        // which includes each of their respective IDs
        return [...alreadyExistingPolicies, ...newlyCreatedPolicies];
      },
      {
        errorMessage: "Failed to get or create policies",
        errorCode: TurnkeyErrorCodes.CREATE_USERS_ERROR,
      },
    );
  };

  /**
   * Updates the user's email address.
   *
   * - This function updates the user's email address and, if provided, verifies it using a verification token (typically from an OTP flow).
   * - If a userId is provided, it updates the email for that specific user; otherwise, it uses the current session's userId.
   * - If a verificationToken is not provided, the email will be updated but will not be marked as verified.
   * - Automatically ensures an active session exists before making the request.
   * - Handles session management and error reporting for both update and verification flows.
   *
   * @param params.email - new email address to set for the user.
   * @param params.verificationToken - verification token from OTP email verification (required if verifying the email).
   * @param params.userId - user ID to update a specific user's email (defaults to the current session's userId).
   * @param params.stampWith - parameter to stamp the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   * @param params.organizationId - organization ID to specify the sub-organization (defaults to the current session's organizationId).
   * @returns A promise that resolves to the userId of the updated user.
   * @throws {TurnkeyError} If there is no active session, if the userId is missing, or if there is an error updating or verifying the user email.
   */
  updateUserEmail = async (params: UpdateUserEmailParams): Promise<string> => {
    const {
      verificationToken,
      email,
      stampWith = this.config.defaultStamperType,
      organizationId,
    } = params;
    const session = await getActiveSessionOrThrowIfRequired(
      stampWith,
      this.storageManager.getActiveSession,
    );

    const userId = params?.userId || session?.userId;
    if (!userId) {
      throw new TurnkeyError(
        "User ID must be provided to update user email",
        TurnkeyErrorCodes.INVALID_REQUEST,
      );
    }

    return withTurnkeyErrorHandling(
      async () => {
        const existingUser = await this.httpClient.proxyGetAccount({
          filterType: FilterType.Email,
          filterValue: email,
        });

        if (existingUser.organizationId) {
          throw new TurnkeyError(
            `Email ${email} is already associated with another user.`,
            TurnkeyErrorCodes.ACCOUNT_ALREADY_EXISTS,
          );
        }

        const res = await this.httpClient.updateUserEmail(
          {
            userId: userId,
            userEmail: email,
            ...(verificationToken && { verificationToken }),
            ...(organizationId && { organizationId }),
          },
          stampWith,
        );

        if (!res || !res.userId) {
          throw new TurnkeyError(
            "No user ID found in the update user email response",
            TurnkeyErrorCodes.BAD_RESPONSE,
          );
        }

        return res.userId;
      },
      {
        errorMessage: "Failed to update user email",
        errorCode: TurnkeyErrorCodes.UPDATE_USER_EMAIL_ERROR,
      },
    );
  };

  /**
   * Removes the user's email address.
   *
   * - This function removes the user's email address by setting it to an empty string.
   * - If a userId is provided, it removes the email for that specific user; otherwise, it uses the current session's userId.
   * - Automatically ensures an active session exists before making the request.
   * - Optionally allows stamping the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   *
   * @param params.userId - user ID to remove a specific user's email address (defaults to the current session's userId).
   * @param params.stampWith - parameter to stamp the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   * @param params.organizationId - organization ID to specify the sub-organization (defaults to the current session's organizationId).
   * @returns A promise that resolves to the userId of the user whose email was removed.
   * @throws {TurnkeyError} If there is no active session, if the userId is missing, or if there is an error removing the user email.
   */
  removeUserEmail = async (params?: RemoveUserEmailParams): Promise<string> => {
    const { stampWith = this.config.defaultStamperType, organizationId } =
      params || {};
    const session = await getActiveSessionOrThrowIfRequired(
      stampWith,
      this.storageManager.getActiveSession,
    );

    return withTurnkeyErrorHandling(
      async () => {
        const userId = params?.userId || session?.userId;
        if (!userId) {
          throw new TurnkeyError(
            "User ID must be provided to remove user email",
            TurnkeyErrorCodes.INVALID_REQUEST,
          );
        }

        const res = await this.httpClient.updateUserEmail(
          {
            userId: userId,
            userEmail: "",
            ...(organizationId && { organizationId }),
          },
          stampWith,
        );
        if (!res || !res.userId) {
          throw new TurnkeyError(
            "No user ID found in the remove user email response",
            TurnkeyErrorCodes.BAD_RESPONSE,
          );
        }
        return res.userId;
      },
      {
        errorMessage: "Failed to remove user email",
        errorCode: TurnkeyErrorCodes.UPDATE_USER_EMAIL_ERROR,
      },
    );
  };

  /**
   * Updates the user's phone number.
   *
   * - This function updates the user's phone number and, if provided, verifies it using a verification token (from an OTP flow).
   * - If a userId is provided, it updates the phone number for that specific user; otherwise, it uses the current session's userId.
   * - If a verificationToken is not provided, the phone number will be updated but will not be marked as verified.
   * - Automatically ensures an active session exists before making the request.
   * - Handles session management and error reporting for both update and verification flows.
   *
   * @param params.phoneNumber - new phone number to set for the user.
   * @param params.verificationToken - verification token from OTP phone verification (required if verifying the phone number).
   * @param params.userId - user ID to update a specific user's phone number (defaults to the current session's userId).
   * @param params.stampWith - parameter to stamp the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   * @param params.organizationId - organization ID to specify the sub-organization (defaults to the current session's organizationId).
   * @returns A promise that resolves to the userId of the updated user.
   * @throws {TurnkeyError} If there is no active session, if the userId is missing, or if there is an error updating or verifying the user phone number.
   */
  updateUserPhoneNumber = async (
    params: UpdateUserPhoneNumberParams,
  ): Promise<string> => {
    const {
      verificationToken,
      phoneNumber,
      stampWith = this.config.defaultStamperType,
      organizationId,
    } = params;
    const session = await getActiveSessionOrThrowIfRequired(
      stampWith,
      this.storageManager.getActiveSession,
    );

    const userId = params?.userId || session?.userId;
    if (!userId) {
      throw new TurnkeyError(
        "User ID must be provided to update user phone number",
        TurnkeyErrorCodes.INVALID_REQUEST,
      );
    }

    return withTurnkeyErrorHandling(
      async () => {
        const res = await this.httpClient.updateUserPhoneNumber(
          {
            userId,
            userPhoneNumber: phoneNumber,
            ...(verificationToken && { verificationToken }),
            ...(organizationId && { organizationId }),
          },
          stampWith,
        );

        if (!res || !res.userId) {
          throw new TurnkeyError(
            "Failed to update user phone number",
            TurnkeyErrorCodes.UPDATE_USER_PHONE_NUMBER_ERROR,
          );
        }

        return res.userId;
      },
      {
        errorMessage: "Failed to update user phone number",
        errorCode: TurnkeyErrorCodes.UPDATE_USER_PHONE_NUMBER_ERROR,
      },
    );
  };

  /**
   * Removes the user's phone number.
   *
   * - This function removes the user's phone number by setting it to an empty string.
   * - If a userId is provided, it removes the phone number for that specific user; otherwise, it uses the current session's userId.
   * - Automatically ensures an active session exists before making the request.
   * - Optionally allows stamping the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   *
   * @param params.userId - user ID to remove a specific user's phone number (defaults to the current session's userId).
   * @param params.stampWith - parameter to stamp the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   * @param params.organizationId - organization ID to specify the sub-organization (defaults to the current session's organizationId).
   * @returns A promise that resolves to the userId of the user whose phone number was removed.
   * @throws {TurnkeyError} If there is no active session, if the userId is missing, or if there is an error removing the user phone number.
   */
  removeUserPhoneNumber = async (
    params?: RemoveUserPhoneNumberParams,
  ): Promise<string> => {
    const { stampWith = this.config.defaultStamperType, organizationId } =
      params || {};
    const session = await getActiveSessionOrThrowIfRequired(
      stampWith,
      this.storageManager.getActiveSession,
    );

    const userId = params?.userId || session?.userId;
    if (!userId) {
      throw new TurnkeyError(
        "User ID must be provided to remove user phone number",
        TurnkeyErrorCodes.INVALID_REQUEST,
      );
    }

    return withTurnkeyErrorHandling(
      async () => {
        const res = await this.httpClient.updateUserPhoneNumber(
          {
            userId,
            userPhoneNumber: "",
            ...(organizationId && { organizationId }),
          },
          stampWith,
        );
        if (!res || !res.userId) {
          throw new TurnkeyError(
            "Failed to remove user phone number",
            TurnkeyErrorCodes.UPDATE_USER_PHONE_NUMBER_ERROR,
          );
        }
        return res.userId;
      },
      {
        errorMessage: "Failed to remove user phone number",
        errorCode: TurnkeyErrorCodes.UPDATE_USER_PHONE_NUMBER_ERROR,
      },
    );
  };

  /**
   * Updates the user's name.
   *
   * - This function updates the user's display name.
   * - If a userId is provided, it updates the name for that specific user; otherwise, it uses the current session's userId.
   * - Automatically ensures an active session exists before making the request.
   * - Optionally allows stamping the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   * - Handles session management and error reporting for the update flow.
   *
   * @param params.userName - new name to set for the user.
   * @param params.userId - user ID to update a specific user's name (defaults to the current session's userId).
   * @param params.stampWith - parameter to stamp the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   * @param params.organizationId - organization ID to specify the sub-organization (defaults to the current session's organizationId).
   * @returns A promise that resolves to the userId of the updated user.
   * @throws {TurnkeyError} If there is no active session, if the userId is missing, or if there is an error updating the user name.
   */
  updateUserName = async (params: UpdateUserNameParams): Promise<string> => {
    const {
      userName,
      stampWith = this.config.defaultStamperType,
      organizationId,
    } = params;
    const session = await getActiveSessionOrThrowIfRequired(
      stampWith,
      this.storageManager.getActiveSession,
    );

    const userId = params?.userId || session?.userId;
    if (!userId) {
      throw new TurnkeyError(
        "User ID must be provided to update user name",
        TurnkeyErrorCodes.INVALID_REQUEST,
      );
    }

    return withTurnkeyErrorHandling(
      async () => {
        const res = await this.httpClient.updateUserName(
          {
            userId,
            userName,
            ...(organizationId && { organizationId }),
          },
          stampWith,
        );

        if (!res || !res.userId) {
          throw new TurnkeyError(
            "No user ID found in the update user name response",
            TurnkeyErrorCodes.BAD_RESPONSE,
          );
        }

        return res.userId;
      },
      {
        errorMessage: "Failed to update user name",
        errorCode: TurnkeyErrorCodes.UPDATE_USER_NAME_ERROR,
      },
    );
  };

  /**
   * Adds an OAuth provider to the user.
   *
   * - This function adds an OAuth provider (e.g., Google, Apple) to the user account.
   * - If a userId is provided, it adds the provider for that specific user; otherwise, it uses the current session's userId.
   * - Automatically checks if an account already exists for the provided OIDC token and prevents duplicate associations.
   * - If the user's email is not set or not verified, attempts to update and verify the email using the email from the OIDC token.
   * - Handles session management and error reporting for the add provider flow.
   * - Optionally allows stamping the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   *
   * @param params.providerName - name of the OAuth provider to add (e.g., "Google", "Apple").
   * @param params.oidcToken - OIDC token for the OAuth provider.
   * @param params.organizationId - organization ID to specify the sub-organization (defaults to the current session's organizationId).
   * @param params.userId - user ID to add the provider for a specific user (defaults to current session's userId).
   * @param params.stampWith - parameter to stamp the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   * @returns A promise that resolves to an array of provider IDs associated with the user.
   * @throws {TurnkeyError} If there is no active session, if the account already exists, or if there is an error adding the OAuth provider.
   */
  addOauthProvider = async (
    params: AddOauthProviderParams,
  ): Promise<string[]> => {
    const {
      providerName,
      oidcToken,
      stampWith = this.config.defaultStamperType,
    } = params;
    const session = await getActiveSessionOrThrowIfRequired(
      stampWith,
      this.storageManager.getActiveSession,
    );

    return withTurnkeyErrorHandling(
      async () => {
        const accountRes = await this.httpClient.proxyGetAccount({
          filterType: "OIDC_TOKEN",
          filterValue: oidcToken,
        });

        if (!accountRes) {
          throw new TurnkeyError(
            `Account fetch failed`,
            TurnkeyErrorCodes.ACCOUNT_FETCH_ERROR,
          );
        }

        if (accountRes.organizationId) {
          throw new TurnkeyError(
            "Account already exists with this OIDC token",
            TurnkeyErrorCodes.ACCOUNT_ALREADY_EXISTS,
          );
        }

        const userId = params?.userId || session?.userId;
        if (!userId) {
          throw new TurnkeyError(
            "User ID must be provided to add OAuth provider",
            TurnkeyErrorCodes.INVALID_REQUEST,
          );
        }

        const organizationId =
          params?.organizationId ?? session?.organizationId;
        if (!organizationId) {
          throw new TurnkeyError(
            "Organization ID is required to add OAuth provider",
            TurnkeyErrorCodes.INVALID_REQUEST,
          );
        }

        // parse the oidc token so we can get the email. Pass it in to updateUser then call createOauthProviders. This will be verified by Turnkey.
        const { email: oidcEmail, iss } = jwtDecode<any>(oidcToken) || {};

        if (iss === googleISS) {
          const verifiedSuborg = await this.httpClient.proxyGetAccount({
            filterType: "EMAIL",
            filterValue: oidcEmail,
          });

          const isVerified = verifiedSuborg.organizationId === organizationId;

          const user = await this.fetchUser({
            userId,
            stampWith,
          });

          if (!user?.userEmail && !isVerified) {
            await this.updateUserEmail({
              email: oidcEmail,
              userId,
              stampWith,
            });
          }
        }

        const createProviderRes = await this.httpClient.createOauthProviders(
          {
            userId,
            oauthProviders: [
              {
                providerName,
                oidcToken,
              },
            ],
          },
          stampWith,
        );

        if (!createProviderRes) {
          throw new TurnkeyError(
            "Failed to create OAuth provider",
            TurnkeyErrorCodes.ADD_OAUTH_PROVIDER_ERROR,
          );
        }

        return createProviderRes?.providerIds || [];
      },
      {
        errorMessage: "Failed to add OAuth provider",
        errorCode: TurnkeyErrorCodes.ADD_OAUTH_PROVIDER_ERROR,
      },
    );
  };

  /**
   * Removes a list of OAuth providers from the user.
   *
   * - This function removes OAuth providers (e.g., Google, Apple) from the user's account.
   * - If a userId is provided, it removes the providers for that specific user; otherwise, it uses the current session's userId.
   * - Automatically ensures an active session exists before making the request.
   * - Optionally allows stamping the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   * - Returns an array of remaining provider IDs associated with the user after removal.
   *
   * @param params.providerIds - IDs of the OAuth providers to remove.
   * @param params.userId - user ID to remove the provider for a specific user (defaults to the current session's userId).
   * @param params.stampWith - parameter to stamp the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   * @param params.organizationId - organization ID to specify the sub-organization (defaults to the current session's organizationId).
   * @returns A promise that resolves to an array of provider IDs that were removed.
   * @throws {TurnkeyError} If there is no active session, if the userId is missing, or if there is an error removing the OAuth provider.
   */
  removeOauthProviders = async (
    params: RemoveOauthProvidersParams,
  ): Promise<string[]> => {
    const {
      providerIds,
      stampWith = this.config.defaultStamperType,
      organizationId,
    } = params;
    const session = await getActiveSessionOrThrowIfRequired(
      stampWith,
      this.storageManager.getActiveSession,
    );

    const userId = params?.userId || session?.userId;
    if (!userId) {
      throw new TurnkeyError(
        "User ID must be provided to remove OAuth provider",
        TurnkeyErrorCodes.INVALID_REQUEST,
      );
    }

    return withTurnkeyErrorHandling(
      async () => {
        const res = await this.httpClient.deleteOauthProviders(
          {
            userId,
            providerIds,
            ...(organizationId && { organizationId }),
          },
          stampWith,
        );
        if (!res) {
          throw new TurnkeyError(
            "Failed to remove OAuth provider",
            TurnkeyErrorCodes.REMOVE_OAUTH_PROVIDER_ERROR,
          );
        }
        return res.providerIds;
      },
      {
        errorMessage: "Failed to remove OAuth provider",
        errorCode: TurnkeyErrorCodes.REMOVE_OAUTH_PROVIDER_ERROR,
      },
    );
  };

  /**
   * Adds a new passkey authenticator for the user.
   *
   * - This function prompts the user to create a new passkey (WebAuthn/FIDO2) and adds it as an authenticator for the user.
   * - Handles both web and React Native environments, automatically selecting the appropriate passkey creation flow.
   * - If a userId is provided, the passkey is added for that specific user; otherwise, it uses the current session's userId.
   * - The passkey's name and display name can be customized; if not provided, defaults are generated.
   * - The resulting passkey attestation and challenge are registered with Turnkey as a new authenticator.
   *
   * @param params.name - name of the passkey (defaults to "Turnkey Passkey-`timestamp`").
   * @param params.displayName - display name of the passkey (defaults to the value of `name`).
   * @param params.userId - user ID to add the passkey for a specific user (defaults to the current session's userId).
   * @param params.stampWith - parameter to stamp the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   * @param params.organizationId - organization ID to specify the sub-organization (defaults to the current session's organizationId).
   * @returns A promise that resolves to an array of authenticator IDs for the newly added passkey(s).
   * @throws {TurnkeyError} If there is no active session, if passkey creation fails, or if there is an error adding the passkey.
   */
  addPasskey = async (params?: AddPasskeyParams): Promise<string[]> => {
    const { stampWith = this.config.defaultStamperType, organizationId } =
      params || {};
    const name = params?.name || `Turnkey Passkey-${Date.now()}`;

    return withTurnkeyErrorHandling(
      async () => {
        const session = await getActiveSessionOrThrowIfRequired(
          stampWith,
          this.storageManager.getActiveSession,
        );

        const userId = params?.userId || session?.userId;
        if (!userId) {
          throw new TurnkeyError(
            "User ID must be provided to add passkey",
            TurnkeyErrorCodes.INVALID_REQUEST,
          );
        }

        const { encodedChallenge, attestation } = await this.createPasskey({
          name,
        });

        if (!attestation || !encodedChallenge) {
          throw new TurnkeyError(
            "Failed to create passkey challenge and attestation",
            TurnkeyErrorCodes.CREATE_PASSKEY_ERROR,
          );
        }

        const res = await this.httpClient.createAuthenticators(
          {
            userId,
            authenticators: [
              {
                authenticatorName: name,
                challenge: encodedChallenge,
                attestation,
              },
            ],
            ...(organizationId && { organizationId }),
          },
          stampWith,
        );

        return res?.authenticatorIds || [];
      },
      {
        errorMessage: "Failed to add passkey",
        errorCode: TurnkeyErrorCodes.ADD_PASSKEY_ERROR,
      },
    );
  };

  /**
   * Removes passkeys (authenticator) from the user.
   *
   * - This function removes passkeys (WebAuthn/FIDO2 authenticators) from the user's account.
   * - If a userId is provided, it removes the passkeys for that specific user; otherwise, it uses the current session's userId.
   * - Automatically ensures an active session exists before making the request.
   * - Optionally allows stamping the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   * - Returns an array of remaining authenticator IDs for the user after removal.
   *
   * @param params.authenticatorIds - IDs of the authenticators (passkeys) to remove.
   * @param params.userId - user ID to remove the passkeys for a specific user (defaults to the current session's userId).
   * @param params.stampWith - parameter to stamp the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   * @param params.organizationId - organization ID to specify the sub-organization (defaults to the current session's organizationId).
   * @returns A promise that resolves to an array of authenticator IDs that were removed.
   * @throws {TurnkeyError} If there is no active session, if the userId is missing, or if there is an error removing the passkeys.
   */
  removePasskeys = async (params: RemovePasskeyParams): Promise<string[]> => {
    const {
      authenticatorIds,
      stampWith = this.config.defaultStamperType,
      organizationId,
    } = params;

    const session = await getActiveSessionOrThrowIfRequired(
      stampWith,
      this.storageManager.getActiveSession,
    );

    const userId = params?.userId || session?.userId;
    if (!userId) {
      throw new TurnkeyError(
        "User ID must be provided to remove passkey",
        TurnkeyErrorCodes.INVALID_REQUEST,
      );
    }

    return withTurnkeyErrorHandling(
      async () => {
        const res = await this.httpClient.deleteAuthenticators(
          {
            userId,
            authenticatorIds,
            ...(organizationId && { organizationId }),
          },
          stampWith,
        );
        if (!res) {
          throw new TurnkeyError(
            "No response found in the remove passkey response",
            TurnkeyErrorCodes.REMOVE_PASSKEY_ERROR,
          );
        }
        return res.authenticatorIds;
      },
      {
        errorMessage: "Failed to remove passkey",
        errorCode: TurnkeyErrorCodes.REMOVE_PASSKEY_ERROR,
      },
    );
  };

  /**
   * Creates a new wallet for sub-organization.
   *
   * - This function creates a new wallet for the current sub-organization.
   * - If an organizationId is provided, the wallet will be created under that specific sub-organization; otherwise, it uses the current session's organizationId.
   * - If a list of address formats is provided, accounts will be created in the wallet based on those formats (starting from path index 0).
   * - If a list of account parameters is provided, those accounts will be created in the wallet.
   * - If no accounts or address formats are provided, default Ethereum and Solana accounts will be created.
   * - Optionally allows specifying the mnemonic length for the wallet seed phrase (defaults to 12).
   * - Optionally allows stamping the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   *
   * @param params.walletName - name of the wallet to create.
   * @param params.accounts - array of account parameters or address formats to create in the wallet.
   * @param params.organizationId - organization ID to create the wallet under a specific sub-organization (defaults to the current session's organizationId).
   * @param params.mnemonicLength - mnemonic length for the wallet seed phrase (defaults to 12).
   * @param params.stampWith - parameter to stamp the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   * @returns A promise that resolves to the ID of the newly created wallet.
   * @throws {TurnkeyError} If there is no active session or if there is an error creating the wallet.
   */
  createWallet = async (params: CreateWalletParams): Promise<string> => {
    const {
      walletName,
      accounts,
      organizationId: organizationIdFromParams,
      mnemonicLength,
      stampWith = this.config.defaultStamperType,
    } = params;

    const session = await getActiveSessionOrThrowIfRequired(
      stampWith,
      this.storageManager.getActiveSession,
    );

    const organizationId = organizationIdFromParams || session?.organizationId;
    if (!organizationId) {
      throw new TurnkeyError(
        "Organization ID must be provided to create wallet",
        TurnkeyErrorCodes.INVALID_REQUEST,
      );
    }

    let walletAccounts: v1WalletAccountParams[] = [];
    if (accounts && !isWalletAccountArray(accounts)) {
      walletAccounts = generateWalletAccountsFromAddressFormat({
        addresses: accounts,
      });
    } else {
      walletAccounts = (accounts as v1WalletAccountParams[]) || [
        ...DEFAULT_ETHEREUM_ACCOUNTS,
        ...DEFAULT_SOLANA_ACCOUNTS,
      ];
    }

    return withTurnkeyErrorHandling(
      async () => {
        const res = await this.httpClient.createWallet(
          {
            organizationId: organizationId,
            walletName,
            accounts: walletAccounts,
            mnemonicLength: mnemonicLength || 12,
          },
          stampWith,
        );
        if (!res || !res.walletId) {
          throw new TurnkeyError(
            "No wallet found in the create wallet response",
            TurnkeyErrorCodes.BAD_RESPONSE,
          );
        }
        return res.walletId;
      },
      {
        errorMessage: "Failed to create wallet",
        errorCode: TurnkeyErrorCodes.CREATE_WALLET_ERROR,
      },
    );
  };

  /**
   * Creates new accounts in the specified wallet.
   *
   * - This function creates new wallet accounts based on the provided account parameters or address formats.
   * - If a walletId is provided, it creates the accounts in that specific wallet; otherwise, it uses the current session's wallet.
   * - If a list of address formats is provided, it will create accounts in the wallet based on those formats, automatically determining the next available path indexes to avoid duplicates with existing accounts.
   * - If account parameters are provided, they are used directly for account creation.
   * - Automatically queries existing wallet accounts to prevent duplicate account creation for the same address format and path.
   * - Supports stamping the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   *
   * @param params.accounts - An array of account parameters or address formats to create in the wallet.
   * @param params.walletId - ID of the wallet to create accounts in.
   * @param params.organizationId - organization ID to create the accounts under a specific organization (walletId must be associated with the sub-organization).
   * @param params.stampWith - parameter to stamp the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   * @returns A promise that resolves to an array of addresses for the newly created accounts.
   * @throws {TurnkeyError} If there is no active session, if the wallet does not exist, or if there is an error creating the wallet accounts.
   */
  createWalletAccounts = async (
    params: CreateWalletAccountsParams,
  ): Promise<string[]> => {
    const {
      accounts,
      walletId,
      organizationId: organizationIdFromParams,
      stampWith = this.config.defaultStamperType,
    } = params;

    const session = await getActiveSessionOrThrowIfRequired(
      stampWith,
      this.storageManager.getActiveSession,
    );

    const organizationId = organizationIdFromParams || session?.organizationId;
    if (!organizationId) {
      throw new TurnkeyError(
        "Organization ID must be provided to create wallet accounts",
        TurnkeyErrorCodes.INVALID_REQUEST,
      );
    }

    return withTurnkeyErrorHandling(
      async () => {
        let walletAccounts: v1WalletAccountParams[] = [];
        if (accounts && !isWalletAccountArray(accounts)) {
          // Query existing wallet accounts to avoid duplicates
          const existingWalletAccounts =
            await this.httpClient.getWalletAccounts(
              {
                walletId,
                organizationId: organizationId,
                paginationOptions: { limit: "100" },
              },
              stampWith,
            );
          walletAccounts = generateWalletAccountsFromAddressFormat({
            addresses: accounts,
            existingWalletAccounts: existingWalletAccounts.accounts || [],
          });
        } else {
          walletAccounts = accounts;
        }

        const res = await this.httpClient.createWalletAccounts(
          {
            organizationId: organizationId,
            walletId,
            accounts: walletAccounts,
          },
          stampWith,
        );

        if (!res || !res.addresses) {
          throw new TurnkeyError(
            "No account found in the create wallet account response",
            TurnkeyErrorCodes.BAD_RESPONSE,
          );
        }
        return res.addresses;
      },
      {
        errorMessage: "Failed to create wallet account",
        errorCode: TurnkeyErrorCodes.CREATE_WALLET_ACCOUNT_ERROR,
      },
    );
  };

  /**
   * Exports a wallet as an encrypted bundle.
   *
   * - This function exports the specified wallet and its accounts as an encrypted bundle, suitable for backup or transfer.
   * - The exported bundle contains the wallet's seed phrase, encrypted to the provided target public key.
   * - If a targetPublicKey is provided, the bundle will be encrypted to that public key; otherwise, an error will be thrown.
   * - If an organizationId is provided, the wallet will be exported under that sub-organization; otherwise, the current session's organizationId is used.
   * - Optionally allows stamping the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   * - The exported bundle can later be imported using the `importWallet` method.
   *
   * @param params.walletId - ID of the wallet to export.
   * @param params.targetPublicKey - public key to encrypt the bundle to (required).
   * @param params.organizationId - organization ID to export the wallet under a specific sub-organization (walletId must be associated with the sub-organization).
   * @param params.stampWith - parameter to stamp the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   * @returns A promise that resolves to an `ExportBundle` object containing the encrypted wallet seed phrase and metadata.
   * @throws {TurnkeyError} If there is no active session, if the targetPublicKey is missing, or if there is an error exporting the wallet.
   */
  exportWallet = async (params: ExportWalletParams): Promise<ExportBundle> => {
    const {
      walletId,
      targetPublicKey,
      stampWith = this.config.defaultStamperType,
      organizationId: organizationIdFromParams,
    } = params;

    const session = await getActiveSessionOrThrowIfRequired(
      stampWith,
      this.storageManager.getActiveSession,
    );

    const organizationId = organizationIdFromParams || session?.organizationId;
    if (!organizationId) {
      throw new TurnkeyError(
        "Organization ID must be provided to export wallet",
        TurnkeyErrorCodes.INVALID_REQUEST,
      );
    }

    return withTurnkeyErrorHandling(
      async () => {
        const res = await this.httpClient.exportWallet(
          {
            walletId,
            targetPublicKey,
            organizationId: organizationId,
          },
          stampWith,
        );

        if (!res.exportBundle) {
          throw new TurnkeyError(
            "No export bundle found in the response",
            TurnkeyErrorCodes.BAD_RESPONSE,
          );
        }
        return res.exportBundle as ExportBundle;
      },
      {
        errorMessage: "Failed to export wallet",
        errorCode: TurnkeyErrorCodes.EXPORT_WALLET_ERROR,
      },
    );
  };

  /**
   * Exports a private key as an encrypted bundle.
   *
   * - This function exports the specified private key as an encrypted bundle, suitable for backup or transfer.
   * - The exported bundle contains the private key's key material, encrypted to the provided target public key.
   * - If a targetPublicKey is provided, the bundle will be encrypted to that public key; otherwise, an error will be thrown.
   * - If an organizationId is provided, the private key will be exported under that sub-organization; otherwise, the current session's organizationId is used.
   * - Optionally allows stamping the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   *
   * @param params.privateKeyId - ID of the private key to export.
   * @param params.targetPublicKey - public key to encrypt the bundle to (required).
   * @param params.organizationId - organization ID to export the private key under a specific sub
   * @param params.stampWith - parameter to stamp the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   * @returns A promise that resolves to an `ExportBundle` object containing the encrypted private key and metadata.
   * @throws {TurnkeyError} If there is no active session, if the targetPublicKey is missing, or if there is an error exporting the private key.
   */
  exportPrivateKey = async (
    params: ExportPrivateKeyParams,
  ): Promise<ExportBundle> => {
    const {
      privateKeyId,
      targetPublicKey,
      stampWith = this.config.defaultStamperType,
      organizationId: organizationIdFromParams,
    } = params;

    const session = await getActiveSessionOrThrowIfRequired(
      stampWith,
      this.storageManager.getActiveSession,
    );

    const organizationId = organizationIdFromParams || session?.organizationId;
    if (!organizationId) {
      throw new TurnkeyError(
        "Organization ID must be provided to export private key",
        TurnkeyErrorCodes.INVALID_REQUEST,
      );
    }

    return withTurnkeyErrorHandling(
      async () => {
        const res = await this.httpClient.exportPrivateKey(
          {
            privateKeyId,
            targetPublicKey,
            organizationId: organizationId,
          },
          stampWith,
        );
        if (!res.exportBundle) {
          throw new TurnkeyError(
            "No export bundle found in the response",
            TurnkeyErrorCodes.BAD_RESPONSE,
          );
        }
        return res.exportBundle as ExportBundle;
      },
      {
        errorMessage: "Failed to export private key",
        errorCode: TurnkeyErrorCodes.EXPORT_PRIVATE_KEY_ERROR,
      },
    );
  };

  /**
   * Exports a wallet account as an encrypted bundle.
   *
   * - This function exports the specified wallet account as an encrypted bundle, suitable for backup or transfer.
   * - The exported bundle contains the wallet account's key material, encrypted to the provided target public key.
   * - If a targetPublicKey is provided, the bundle will be encrypted to that public key; otherwise, an error will be thrown.
   * - If an organizationId is provided, the wallet account will be exported under that sub-organization; otherwise, the current session's organizationId is used.
   * - Optionally allows stamping the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   *
   * @param params.address - address of the wallet account to export.
   * @param params.targetPublicKey - public key to encrypt the bundle to.
   * @param params.organizationId - organization ID to export the wallet account under a specific sub-organization.
   * @param params.stampWith - parameter to stamp the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   * @returns A promise that resolves to an `ExportBundle` object containing the encrypted wallet account and metadata.
   * @throws {TurnkeyError} If there is no active session, if the targetPublicKey is missing, or if there is an error exporting the wallet account.
   *
   */
  exportWalletAccount = async (
    params: ExportWalletAccountParams,
  ): Promise<ExportBundle> => {
    const {
      address,
      targetPublicKey,
      stampWith = this.config.defaultStamperType,
      organizationId: organizationIdFromParams,
    } = params;

    const session = await getActiveSessionOrThrowIfRequired(
      stampWith,
      this.storageManager.getActiveSession,
    );

    const organizationId = organizationIdFromParams || session?.organizationId;
    if (!organizationId) {
      throw new TurnkeyError(
        "Organization ID must be provided to export wallet account",
        TurnkeyErrorCodes.INVALID_REQUEST,
      );
    }

    return withTurnkeyErrorHandling(
      async () => {
        const res = await this.httpClient.exportWalletAccount(
          {
            address,
            targetPublicKey,
            organizationId: organizationId,
          },
          stampWith,
        );
        if (!res.exportBundle) {
          throw new TurnkeyError(
            "No export bundle found in the response",
            TurnkeyErrorCodes.BAD_RESPONSE,
          );
        }
        return res.exportBundle as ExportBundle;
      },
      {
        errorMessage: "Failed to export wallet account",
        errorCode: TurnkeyErrorCodes.EXPORT_WALLET_ACCOUNT_ERROR,
      },
    );
  };

  /**
   * Imports a wallet from an encrypted bundle.
   *
   * - This function imports a wallet using the provided encrypted bundle and creates accounts based on the provided parameters.
   * - If a userId is provided, the wallet will be imported for that specific user; otherwise, it uses the current session's userId.
   * - If an accounts array is provided, those accounts will be created in the imported wallet; otherwise, default Ethereum and Solana accounts will be created.
   * - The encrypted bundle MUST be encrypted to
   * - Automatically ensures an active session exists before making the request.
   * - Optionally allows stamping the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   *
   * @param params.encryptedBundle - encrypted bundle containing the wallet seed phrase and metadata.
   * @param params.walletName - name of the wallet to create upon import.
   * @param params.accounts - array of account parameters to create in the imported wallet (defaults to standard Ethereum and Solana accounts).
   * @param params.organizationId - organization ID to import the wallet under a specific sub-organization (wallet will be associated with the sub-organization).
   * @param params.userId - user ID to import the wallet for a specific user (defaults to the current session's userId).
   * @param params.stampWith - parameter to stamp the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   * @returns A promise that resolves to the ID of the imported wallet.
   * @throws {TurnkeyError} If there is no active session, if the encrypted bundle is invalid, or if there is an error importing the wallet.
   */
  importWallet = async (params: ImportWalletParams): Promise<string> => {
    const {
      encryptedBundle,
      accounts,
      walletName,
      organizationId: organizationIdFromParams,
      userId: userIdFromParams,
      stampWith = this.config.defaultStamperType,
    } = params;

    const session = await getActiveSessionOrThrowIfRequired(
      stampWith,
      this.storageManager.getActiveSession,
    );

    const organizationId = organizationIdFromParams || session?.organizationId;
    if (!organizationId) {
      throw new TurnkeyError(
        "Organization ID must be provided to import wallet",
        TurnkeyErrorCodes.INVALID_REQUEST,
      );
    }

    const userId = userIdFromParams || session?.userId;
    if (!userId) {
      throw new TurnkeyError(
        "User ID must be provided to import wallet",
        TurnkeyErrorCodes.INVALID_REQUEST,
      );
    }

    return withTurnkeyErrorHandling(
      async () => {
        const res = await this.httpClient.importWallet(
          {
            organizationId: organizationId,
            userId: userId,
            encryptedBundle,
            walletName,
            accounts: accounts || [
              ...DEFAULT_ETHEREUM_ACCOUNTS,
              ...DEFAULT_SOLANA_ACCOUNTS,
            ],
          },
          stampWith,
        );

        if (!res || !res.walletId) {
          throw new TurnkeyError(
            "No wallet ID found in the import response",
            TurnkeyErrorCodes.BAD_RESPONSE,
          );
        }
        return res.walletId;
      },
      {
        errorMessage: "Failed to import wallet",
        errorCode: TurnkeyErrorCodes.IMPORT_WALLET_ERROR,
        customErrorsByMessages: {
          "invalid mnemonic": {
            message: "Invalid mnemonic input",
            code: TurnkeyErrorCodes.BAD_REQUEST,
          },
        },
      },
    );
  };

  /**
   * Imports a private key from an encrypted bundle.
   *
   * - This function imports a private key using the provided encrypted bundle.
   * - If a userId is provided, the private key will be imported for that specific user; otherwise, it uses the current session's userId.
   * - Requires address formats to
   * - Automatically infers the cryptographic curve used to generate the private key based on the address format (can be optionally overriden if needed).
   * - The encrypted bundle MUST be encrypted to ensure security.
   * - Automatically ensures an active session exists before making the request.
   * - Optionally allows stamping the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   *
   * @param params.encryptedBundle - encrypted bundle containing the private key key material and metadata.
   * @param params.privateKeyName - name of the private key to create upon import.
   * @param params.curve - the cryptographic curve used to generate a given private key
   * @param params.addressFormat - address format of the private key to import.
   * @param params.organizationId - organization ID to import the private key under a specific sub-organization (private key will be associated with the sub-organization).
   * @param params.userId - user ID to import the wallet for a specific user (defaults to the current session's userId).
   * @param params.stampWith - parameter to stamp the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   * @returns A promise that resolves to the ID of the imported wallet.
   * @throws {TurnkeyError} If there is no active session, if the encrypted bundle is invalid, or if there is an error importing the wallet.
   */
  importPrivateKey = async (
    params: ImportPrivateKeyParams,
  ): Promise<string> => {
    const {
      encryptedBundle,
      privateKeyName,
      addressFormats,
      curve,
      organizationId: organizationIdFromParams,
      userId: userIdFromParams,
      stampWith = this.config.defaultStamperType,
    } = params;

    const session = await getActiveSessionOrThrowIfRequired(
      stampWith,
      this.storageManager.getActiveSession,
    );

    const organizationId = organizationIdFromParams || session?.organizationId;
    if (!organizationId) {
      throw new TurnkeyError(
        "Organization ID must be provided to import private key",
        TurnkeyErrorCodes.INVALID_REQUEST,
      );
    }

    const userId = userIdFromParams || session?.userId;
    if (!userId) {
      throw new TurnkeyError(
        "User ID must be provided to import private key",
        TurnkeyErrorCodes.INVALID_REQUEST,
      );
    }

    return withTurnkeyErrorHandling(
      async () => {
        const res = await this.httpClient.importPrivateKey(
          {
            organizationId,
            userId,
            encryptedBundle,
            privateKeyName,
            curve,
            addressFormats,
          },
          stampWith,
        );

        if (!res || !res.privateKeyId) {
          throw new TurnkeyError(
            "No wallet ID found in the import response",
            TurnkeyErrorCodes.BAD_RESPONSE,
          );
        }
        return res.privateKeyId;
      },
      {
        errorMessage: "Failed to import wallet",
        errorCode: TurnkeyErrorCodes.IMPORT_WALLET_ERROR,
        customErrorsByMessages: {
          "invalid mnemonic": {
            message: "Invalid mnemonic input",
            code: TurnkeyErrorCodes.BAD_REQUEST,
          },
        },
      },
    );
  };

  /**
   * Deletes the current sub-organization (sub-org) for the active session.
   *
   * - This function deletes the sub-organization associated with the current active session.
   * - By default, the deletion will fail if any wallets associated with the sub-organization have not been exported.
   * - If `deleteWithoutExport` is set to true, the sub-organization will be deleted even if its wallets have not been exported (potentially resulting in loss of access to those wallets).
   * - Requires an active session; otherwise, an error is thrown.
   * - Optionally allows stamping the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   *
   * @param params.deleteWithoutExport - flag to delete the sub-organization without requiring all wallets to be exported first (defaults to false).
   * @param params.organizationId - organization ID to delete a specific sub-organization (defaults to the current session's organizationId).
   * @param params.stampWith - parameter to stamp the request with a specific stamper.
   * @returns A promise that resolves to a `TDeleteSubOrganizationResponse` object containing the result of the deletion.
   * @throws {TurnkeyError} If there is no active session or if there is an error deleting the sub-organization.
   */
  deleteSubOrganization = async (
    params?: DeleteSubOrganizationParams,
  ): Promise<TDeleteSubOrganizationResponse> => {
    const {
      deleteWithoutExport = false,
      organizationId: organizationIdFromParams,
      stampWith = this.config.defaultStamperType,
    } = params || {};

    const session = await getActiveSessionOrThrowIfRequired(
      stampWith,
      this.storageManager.getActiveSession,
    );

    const organizationId = organizationIdFromParams || session?.organizationId;

    return withTurnkeyErrorHandling(
      async () => {
        return await this.httpClient.deleteSubOrganization(
          { deleteWithoutExport, ...(organizationId && { organizationId }) },
          stampWith,
        );
      },
      {
        errorMessage: "Failed to delete sub-organization",
        errorCode: TurnkeyErrorCodes.DELETE_SUB_ORGANIZATION_ERROR,
      },
    );
  };

  /**
   * Stores a session token and updates the session associated with the specified session key, or by default the active session.
   *
   * - This function parses and stores a signed JWT session token in local storage, associating it with the given session key.
   * - If a sessionKey is provided, the session will be stored under that key; otherwise, it will use the default session key.
   * - If a session already exists for the session key, its associated key pair will be deleted before storing the new session.
   * - After storing the session, any unused key pairs are automatically cleared from storage.
   * - Ensures that session management is consistent and prevents orphaned key pairs.
   *
   * @param params.sessionToken - JWT session token to store.
   * @param params.sessionKey - session key to store the session under (defaults to the default session key).
   * @returns A promise that resolves when the session is successfully stored.
   * @throws {TurnkeyError} If there is an error storing the session or cleaning up key pairs.
   */
  storeSession = async (params: StoreSessionParams): Promise<void> => {
    const { sessionToken, sessionKey = SessionKey.DefaultSessionkey } = params;
    if (!sessionToken) return;

    withTurnkeyErrorHandling(
      async () => {
        await this.storageManager.storeSession(sessionToken, sessionKey);
      },
      {
        errorMessage: "Failed to store session",
        errorCode: TurnkeyErrorCodes.STORE_SESSION_ERROR,
      },
      {
        finallyFn: async () => await this.clearUnusedKeyPairs(),
      },
    );
  };

  /**
   * Clears the session associated with the specified session key, or the active session by default.
   *
   * - This function deletes the session and its associated key pair from storage.
   * - If a sessionKey is provided, it will clear the session under that key; otherwise, it will clear the default (active) session.
   * - Removes the session data from local storage and deletes the corresponding API key pair from the key store.
   * - Throws an error if the session does not exist or if there is an error during the clearing process.
   *
   * @param params.sessionKey - session key to clear the session under (defaults to the default session key).
   * @returns A promise that resolves when the session is successfully cleared.
   * @throws {TurnkeyError} If the session does not exist or if there is an error clearing the session.
   */
  clearSession = async (params?: ClearSessionParams): Promise<void> => {
    const { sessionKey = SessionKey.DefaultSessionkey } = params || {};
    withTurnkeyErrorHandling(
      async () => {
        const session = await this.storageManager.getSession(sessionKey);
        if (session) {
          await Promise.all([
            this.apiKeyStamper?.deleteKeyPair(session.publicKey!),
            this.storageManager.clearSession(sessionKey),
          ]);
        } else {
          throw new TurnkeyError(
            `No session found with key: ${sessionKey}`,
            TurnkeyErrorCodes.NOT_FOUND,
          );
        }
      },
      {
        errorMessage: "Failed to delete session",
        errorCode: TurnkeyErrorCodes.CLEAR_SESSION_ERROR,
      },
    );
  };

  /**
   * Clears all sessions and resets the active session state.
   *
   * - This function removes all session data from the client and persistent storage, including all associated key pairs.
   * - Iterates through all stored session keys, clearing each session and deleting its corresponding API key pair.
   * - After clearing, there will be no active session, and all session-related data will be removed from local storage.
   * - Throws an error if no sessions exist or if there is an error during the clearing process.
   *
   * @returns A promise that resolves when all sessions are successfully cleared.
   * @throws {TurnkeyError} If no sessions exist or if there is an error clearing all sessions.
   */
  clearAllSessions = async (): Promise<void> => {
    withTurnkeyErrorHandling(
      async () => {
        const sessionKeys = await this.storageManager.listSessionKeys();
        if (sessionKeys.length === 0) return;
        for (const sessionKey of sessionKeys) {
          this.clearSession({ sessionKey });
        }
      },
      {
        errorMessage: "Failed to clear all sessions",
        errorCode: TurnkeyErrorCodes.CLEAR_ALL_SESSIONS_ERROR,
      },
    );
  };

  /**
   * Refreshes the session associated with the specified session key, or the active session by default.
   *
   * - This function refreshes the session and updates the session token and key pair associated with the given session key.
   * - If a sessionKey is provided, it will refresh the session under that key; otherwise, it will use the current active session key.
   * - Optionally allows specifying a new expiration time for the session, a custom public key, and whether to invalidate the existing session after refreshing.
   * - Makes a request to the Turnkey API to stamp a new login and stores the refreshed session token.
   * - Automatically manages key pair cleanup and session storage to ensure consistency.
   * - Optionally allows stamping the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   *
   * @param params.sessionKey - session key to refresh the session under (defaults to the active session key).
   * @param params.expirationSeconds - expiration time in seconds for the refreshed session (defaults to the configured default).
   * @param params.publicKey - public key to use for the refreshed session (if not provided, a new key pair will be generated).
   * @param params.invalidateExisitng - flag to invalidate the existing session before refreshing (defaults to false).
   * @param params.stampWith - parameter to stamp the request with a specific stamper.
   * @returns A promise that resolves to a `TStampLoginResponse` object containing the refreshed session details.
   * @throws {TurnkeyError} If the session key does not exist, if there is no active session, or if there is an error refreshing the session.
   */
  refreshSession = async (
    params?: RefreshSessionParams,
  ): Promise<TStampLoginResponse | undefined> => {
    const {
      sessionKey = await this.storageManager.getActiveSessionKey(),
      expirationSeconds = DEFAULT_SESSION_EXPIRATION_IN_SECONDS,
      publicKey,
      stampWith = this.config.defaultStamperType,
      invalidateExisitng = false,
    } = params || {};
    if (!sessionKey) {
      throw new TurnkeyError(
        "No session key provided or active session to refresh session",
        TurnkeyErrorCodes.NO_SESSION_FOUND,
      );
    }
    const session = await this.getSession({
      sessionKey: sessionKey,
    });
    if (!session) {
      throw new TurnkeyError(
        `No active session found: ${sessionKey}`,
        TurnkeyErrorCodes.NO_SESSION_FOUND,
      );
    }

    if (!this.httpClient) {
      throw new TurnkeyError(
        "HTTP client is not initialized. Please initialize the client before refreshing the session.",
        TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
      );
    }

    let keyPair: string | undefined;
    return withTurnkeyErrorHandling(
      async () => {
        keyPair = publicKey ?? (await this.apiKeyStamper?.createKeyPair());
        if (!keyPair) {
          throw new TurnkeyError(
            "Failed to create new key pair.",
            TurnkeyErrorCodes.INTERNAL_ERROR,
          );
        }
        const res = await this.httpClient.stampLogin(
          {
            publicKey: keyPair,
            expirationSeconds,
            invalidateExisting: invalidateExisitng,
          },
          stampWith,
        );

        if (!res || !res.session) {
          throw new TurnkeyError(
            "No session found in the refresh response",
            TurnkeyErrorCodes.BAD_RESPONSE,
          );
        }

        await this.storeSession({
          sessionToken: res.session,
          ...(sessionKey && { sessionKey }),
        });
        return res;
      },
      {
        errorMessage: "Failed to refresh session",
        errorCode: TurnkeyErrorCodes.REFRESH_SESSION_ERROR,
      },
    );
  };

  /**
   * Retrieves the session associated with the specified session key, or the active session by default.
   *
   * - This function retrieves the session object from storage, using the provided session key or, if not specified, the current active session key.
   * - If no session key is provided and there is no active session, it returns undefined.
   * - Returns the session details, including public key, organization ID, user ID, and expiration.
   *
   * @param params.sessionKey - session key to retrieve a specific session (defaults to the current active session key).
   * @returns A promise that resolves to a `Session` object containing the session details, or undefined if not found.
   * @throws {TurnkeyError} If there is an error retrieving the session from storage.
   */
  getSession = async (
    params?: GetSessionParams,
  ): Promise<Session | undefined> => {
    return withTurnkeyErrorHandling(
      async () => {
        const { sessionKey = await this.storageManager.getActiveSessionKey() } =
          params || {};
        return this.storageManager.getSession(sessionKey);
      },
      {
        errorMessage: "Failed to get session with key " + params?.sessionKey,
        errorCode: TurnkeyErrorCodes.GET_SESSION_ERROR,
      },
    );
  };

  /**
   * Retrieves all sessions stored in persistent storage.
   *
   * - This function fetches all session objects currently stored by the client, including those that are not active.
   * - Returns a record mapping each session key to its corresponding `Session` object.
   * - Useful for session management, auditing, or displaying all available sessions to the user.
   * - Automatically skips any session keys that do not have a valid session object.
   *
   * @returns A promise that resolves to a record of session keys and their corresponding `Session` objects, or `undefined` if no sessions exist.
   * @throws {TurnkeyError} If there is an error retrieving sessions from storage.
   */
  getAllSessions = async (): Promise<Record<string, Session> | undefined> => {
    return withTurnkeyErrorHandling(
      async () => {
        const sessionKeys = await this.storageManager.listSessionKeys();
        if (!sessionKeys || sessionKeys.length === 0) {
          return undefined;
        }
        const sessions: Record<string, Session> = {};
        for (const sessionKey of sessionKeys) {
          const session = await this.storageManager.getSession(sessionKey);
          if (session) {
            sessions[sessionKey] = session;
          }
        }
        return sessions || undefined;
      },
      {
        errorMessage: "Failed to get all sessions",
        errorCode: TurnkeyErrorCodes.GET_ALL_SESSIONS_ERROR,
      },
    );
  };

  /**
   * Sets the active session to the specified session key.
   *
   * - This function updates the `activeSessionKey` in persistent storage to the specified session key.
   * - Ensures that subsequent operations use the session associated with this key as the active session.
   * - Does not validate whether the session key exists or is valid; it simply updates the pointer.
   * - Useful for switching between multiple stored sessions or restoring a previous session context.
   *
   * @param params.sessionKey - session key to set as the active session.
   * @returns A promise that resolves when the active session key is successfully set.
   * @throws {TurnkeyError} If the client is not initialized or if there is an error setting the active session key.
   */
  setActiveSession = async (params: SetActiveSessionParams): Promise<void> => {
    const { sessionKey } = params;
    return withTurnkeyErrorHandling(
      async () => {
        await this.storageManager.setActiveSessionKey(sessionKey);
      },
      {
        errorMessage: "Failed to set active session",
        errorCode: TurnkeyErrorCodes.SET_ACTIVE_SESSION_ERROR,
      },
    );
  };

  /**
   * Retrieves the active session key currently set in persistent storage.
   *
   * - This function fetches the session key that is currently marked as active in the client's persistent storage.
   * - The active session key determines which session is used for all session-dependent operations.
   * - If no active session key is set, returns `undefined`.
   * - Useful for determining which session is currently in use, especially when managing multiple sessions.
   *
   * @returns A promise that resolves to the active session key as a string, or `undefined` if no active session is set.
   * @throws {TurnkeyError} If there is an error retrieving the active session key from storage.
   */
  getActiveSessionKey = async (): Promise<string | undefined> => {
    return withTurnkeyErrorHandling(
      async () => {
        return await this.storageManager.getActiveSessionKey();
      },
      {
        errorMessage: "Failed to get active session key",
        errorCode: TurnkeyErrorCodes.GET_ACTIVE_SESSION_KEY_ERROR,
      },
    );
  };

  /**
   * Clears any unused API key pairs from persistent storage.
   *
   * - This function scans all API key pairs stored in indexedDB and removes any key pairs that are not associated with a session in persistent storage.
   * - Ensures that only key pairs referenced by existing sessions are retained, preventing orphaned or stale key pairs from accumulating.
   * - Iterates through all stored session keys and builds a map of in-use public keys, then deletes any key pairs not present in this map.
   * - Intended to be called after session changes (e.g., login, logout, session replacement) to keep key storage clean and secure.
   *
   * @returns A promise that resolves when all unused key pairs are successfully cleared.
   * @throws {TurnkeyError} If there is an error listing, checking, or deleting unused key pairs.
   */
  clearUnusedKeyPairs = async (): Promise<void> => {
    withTurnkeyErrorHandling(
      async () => {
        const publicKeys = await this.apiKeyStamper?.listKeyPairs();
        if (!publicKeys || publicKeys.length === 0) {
          return;
        }
        const sessionKeys = await this.storageManager?.listSessionKeys();

        const sessionTokensMap: Record<string, string> = {};
        for (const sessionKey of sessionKeys) {
          const session = await this.storageManager.getSession(sessionKey);
          if (session) {
            sessionTokensMap[session.publicKey!] = sessionKey;
          }
        }

        for (const publicKey of publicKeys) {
          if (!sessionTokensMap[publicKey]) {
            try {
              await this.apiKeyStamper?.deleteKeyPair(publicKey);
            } catch (error) {
              throw new TurnkeyError(
                `Failed to delete unused key pair ${publicKey}`,
                TurnkeyErrorCodes.INTERNAL_ERROR,
                error,
              );
            }
          }
        }
      },
      {
        errorMessage: "Failed to clear unused key pairs",
        errorCode: TurnkeyErrorCodes.CLEAR_UNUSED_KEY_PAIRS_ERROR,
      },
    );
  };

  /**
   * Creates a new API key pair and returns the public key.
   *
   * - This function generates a new API key pair and stores it in the underlying key store (IndexedDB).
   * - If an external key pair is provided, it will use that key pair for creation instead of generating a new one.
   * - If `storeOverride` is set to true, the generated or provided public key will be set as the override key in the API key stamper, making it the active key for subsequent signing operations.
   * - Ensures the API key stamper is initialized before proceeding.
   * - Handles both native CryptoKeyPair objects and raw key material.
   *
   * @param params.externalKeyPair - An externally generated key pair (either a CryptoKeyPair or an object with publicKey/privateKey strings) to use instead of generating a new one.
   * @param params.storeOverride - If true, sets the generated or provided public key as the override key in the API key stamper (defaults to false).
   * @returnparams.s A promise that resolves to the public key of the created or provided API key pair as a string.
   * @throws {TurnkeyError} If the API key stamper is not initialized or if there is an error during key pair creation or storage.
   */
  createApiKeyPair = async (
    params?: CreateApiKeyPairParams,
  ): Promise<string> => {
    return withTurnkeyErrorHandling(
      async () => {
        const externalKeyPair = params?.externalKeyPair;
        const storeOverride = params?.storeOverride ?? false;

        if (!this.apiKeyStamper) {
          throw new TurnkeyError(
            "API Key Stamper is not initialized.",
            TurnkeyErrorCodes.INTERNAL_ERROR,
          );
        }
        const publicKey = await this.apiKeyStamper.createKeyPair(
          externalKeyPair ? externalKeyPair : undefined,
        );

        if (storeOverride && publicKey) {
          await this.apiKeyStamper.setTemporaryPublicKey(publicKey);
        }

        return publicKey;
      },
      {
        errorMessage: "Failed to create API key pair",
        errorCode: TurnkeyErrorCodes.CREATE_API_KEY_PAIR_ERROR,
      },
    );
  };

  /**
   * Fetches the WalletKit proxy authentication configuration from the auth proxy.
   *
   * - This function makes a request to the Turnkey auth proxy to retrieve the current WalletKit configuration,
   *   including supported authentication methods, OAuth providers, and any custom proxy settings.
   * - Useful for dynamically configuring the client UI or authentication flows based on the proxy's capabilities.
   * - Ensures that the client is aware of the latest proxy-side configuration, which may affect available login/signup options.
   *
   * @returns A promise that resolves to a `ProxyTGetWalletKitConfigResponse` object containing the proxy authentication configuration.
   * @throws {TurnkeyError} If there is an error retrieving the proxy authentication configuration from the auth proxy.
   */
  getProxyAuthConfig = async (): Promise<ProxyTGetWalletKitConfigResponse> => {
    return withTurnkeyErrorHandling(
      async () => {
        const res = await this.httpClient.proxyGetWalletKitConfig({});

        if (!res) {
          throw new TurnkeyError(
            `Failed to fetch auth proxy config`,
            TurnkeyErrorCodes.GET_PROXY_AUTH_CONFIG_ERROR,
          );
        }

        return res;
      },
      {
        errorMessage: "Failed to get auth proxy config",
        errorCode: TurnkeyErrorCodes.GET_PROXY_AUTH_CONFIG_ERROR,
      },
    );
  };

  /**
   * Fetches the boot proof for a given app proof.
   *
   * - This function is idempotent: multiple calls with the same `app proof` will always return the boot proof.
   * - Attempts to find the boot proof for the given app proof.
   * - If a boot proof is found, it is returned as is.
   * - If no boot proof is found, an error is thrown.
   *
   * @param params.appProof - the app proof for which the boot proof is being fetched.
   * @param params.organizationId - organization ID to specify the sub-organization (defaults to the current session's organizationId).
   * @param params.stampWith - parameter to stamp the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   * @returns A promise that resolves to the {@link v1BootProof} associated with the given app proof.
   * @throws {TurnkeyError} If there is no active session, if the input is invalid, or if boot proof retrieval fails.
   */
  fetchBootProofForAppProof = async (
    params: FetchBootProofForAppProofParams,
  ): Promise<v1BootProof> => {
    const {
      appProof,
      stampWith = this.config.defaultStamperType,
      organizationId: organizationIdFromParams,
    } = params;

    return withTurnkeyErrorHandling(
      async () => {
        const session = await getActiveSessionOrThrowIfRequired(
          stampWith,
          this.storageManager.getActiveSession,
        );

        const organizationId =
          organizationIdFromParams || session?.organizationId;
        if (!organizationId) {
          throw new TurnkeyError(
            "Organization ID is required to fetch a Boot Proof.",
            TurnkeyErrorCodes.INVALID_REQUEST,
          );
        }

        // validate their input
        if (appProof === null || appProof?.publicKey === null) {
          throw new TurnkeyError(
            "'appProof' is required and cannot be empty.",
            TurnkeyErrorCodes.INVALID_REQUEST,
          );
        }
        const ephemeralKey = appProof!.publicKey!;

        const bootProofResponse = await this.httpClient.getBootProof(
          {
            organizationId,
            ephemeralKey,
          },
          stampWith,
        );
        if (!bootProofResponse || !bootProofResponse.bootProof) {
          throw new TurnkeyError(
            "No boot proof found in the response",
            TurnkeyErrorCodes.BAD_RESPONSE,
          );
        }
        return bootProofResponse.bootProof;
      },
      {
        errorMessage: "Failed to get boot proof for app proof",
        errorCode: TurnkeyErrorCodes.FETCH_BOOT_PROOF_ERROR,
      },
    );
  };

  /**
   * Verifies a list of app proofs against their corresponding boot proofs.
   *
   * - This function iterates through each provided app proof, fetches the corresponding boot proof, and verifies the app proof against the boot proof.
   * - If any app proof fails verification, an error is thrown.
   * @param params.appProofs - the app proofs to verify.
   * @param params.organizationId - organization ID to specify the sub-organization (defaults to the current session's organizationId).
   * @param params.stampWith - parameter to stamp the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   * @returns A promise that resolves when all app proofs have been successfully verified.
   * @throws {TurnkeyError} If there is no active session, if the input is invalid, or if verification fails.
   */
  verifyAppProofs = async (params: VerifyAppProofsParams): Promise<void> => {
    const {
      appProofs,
      stampWith = this.config.defaultStamperType,
      organizationId: organizationIdFromParams,
    } = params;

    return withTurnkeyErrorHandling(
      async () => {
        const session = await getActiveSessionOrThrowIfRequired(
          stampWith,
          this.storageManager.getActiveSession,
        );

        const organizationId =
          organizationIdFromParams || session?.organizationId;
        if (!organizationId) {
          throw new TurnkeyError(
            "Organization ID is required to verify app proofs.",
            TurnkeyErrorCodes.INVALID_REQUEST,
          );
        }

        if (!appProofs || appProofs.length === 0) {
          throw new TurnkeyError(
            "'appProofs' is required and cannot be empty.",
            TurnkeyErrorCodes.INVALID_REQUEST,
          );
        }

        let lastPublicKey: string | undefined;
        let lastBootProof: v1BootProof | undefined;

        for (const appProof of appProofs) {
          if (!appProof.publicKey) {
            throw new TurnkeyError(
              "App proof publicKey is missing.",
              TurnkeyErrorCodes.INVALID_REQUEST,
            );
          }

          let bootProof: v1BootProof;
          if (appProof.publicKey === lastPublicKey && lastBootProof) {
            bootProof = lastBootProof;
          } else {
            bootProof = await this.fetchBootProofForAppProof({
              appProof,
              organizationId,
              stampWith,
            });

            lastPublicKey = appProof.publicKey;
            lastBootProof = bootProof;
          }

          await verify(appProof, bootProof); // throws if invalid
        }
      },
      {
        errorMessage: "Failed to verify app proofs",
        errorCode: TurnkeyErrorCodes.VERIFY_APP_PROOFS_ERROR,
      },
    );
  };
}

import { TurnkeySDKClientBase } from "../__generated__/sdk-client-base";
import {
  TDeleteSubOrganizationResponse,
  Session,
  TStampLoginResponse,
  v1AddressFormat,
  v1Attestation,
  v1Pagination,
  v1SignRawPayloadResult,
  v1TransactionType,
  v1User,
  TurnkeyError,
  TurnkeyErrorCodes,
  TurnkeyNetworkError,
  ProxyTGetWalletKitConfigResponse,
  v1WalletAccountParams,
  v1PayloadEncoding,
  v1HashFunction,
  v1Curve,
  TInitFiatOnRampBody,
} from "@turnkey/sdk-types";
import {
  DEFAULT_SESSION_EXPIRATION_IN_SECONDS,
  ExportBundle,
  StamperType,
  TurnkeySDKClientConfig,
  WalletAccount,
  Wallet,
  OtpType,
  OtpTypeToFilterTypeMap,
  CreateSubOrgParams,
  Chain,
  FilterType,
  EmbeddedWallet,
  WalletSource,
  ConnectedWallet,
  Curve,
  StorageBase,
  SessionKey,
  EmbeddedWalletAccount,
  ConnectedWalletAccount,
  WalletManagerBase,
  WalletProvider,
  SwitchableChain,
  ConnectedEthereumWalletAccount,
  ConnectedSolanaWalletAccount,
  SignIntent,
} from "../__types__/base"; // TODO (Amir): How many of these should we keep in sdk-types
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
} from "@utils";
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

// Gathers all public methods exposed in our core client and turns it into a type that
// can be used to extend clients created for other packages built off core
//
// Should be used to keep any packages that extend this core package in sync with each
// other, meaning any new additions to core should also be reflected in those packages
type PublicMethods<T> = {
  [K in keyof T as K extends string | number | symbol
    ? K extends
        | "init"
        | "constructor"
        | "config"
        | "httpClient"
        | "user"
        | "wallets"
      ? never
      : K
    : never]: T[K] extends (...args: any[]) => any ? T[K] : never;
};

/**@internal */
export type TurnkeyClientMethods = PublicMethods<TurnkeyClient>;

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
    walletManager?: WalletManagerBase
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
    await this.apiKeyStamper.init();

    if (this.config.passkeyConfig) {
      this.passkeyStamper = new CrossPlatformPasskeyStamper(
        this.config.passkeyConfig
      );
      await this.passkeyStamper.init();
    }

    if (
      this.config.walletConfig?.features?.auth ||
      this.config.walletConfig?.features?.connecting
    ) {
      this.walletManager = await createWalletManager(this.config.walletConfig);
    }

    // We can comfortably default to the prod urls here
    const apiBaseUrl = this.config.apiBaseUrl || "https://api.turnkey.com";
    const authProxyUrl =
      this.config.authProxyUrl || "https://authproxy.turnkey.com";

    // Initialize the HTTP client with the appropriate stampers
    this.httpClient = new TurnkeySDKClientBase({
      ...this.config,
      apiBaseUrl,
      authProxyUrl,
      apiKeyStamper: this.apiKeyStamper,
      passkeyStamper: this.passkeyStamper,
      walletStamper: this.walletManager?.stamper,
      storageManager: this.storageManager,
    });
  }

  /**
   * Creates a new passkey authenticator for the user.
   *
   * - This function generates a new passkey attestation and challenge, suitable for registration with the user's device.
   * - Handles both web and React Native environments, automatically selecting the appropriate passkey creation flow.
   * - The resulting attestation and challenge can be used to register the passkey with Turnkey.
   *
   * @param params.name - name of the passkey. If not provided, defaults to "A Passkey".
   * @param params.displayName - display name for the passkey. If not provided, defaults to "A Passkey".
   * @param params.stampWith - parameter to stamp the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   * @returns A promise that resolves to an object containing:
   *   - attestation: attestation object returned from the passkey creation process.
   *   - encodedChallenge: encoded challenge string used for passkey registration.
   * @throws {TurnkeyError} If there is an error during passkey creation, or if the platform is unsupported.
   */
  createPasskey = async (params?: {
    name?: string;
    displayName?: string;
    stampWith?: StamperType | undefined;
  }): Promise<{ attestation: v1Attestation; encodedChallenge: string }> => {
    return withTurnkeyErrorHandling(
      async () => {
        const name = params?.name || "A Passkey";
        const displayName = params?.displayName || "A Passkey";
        let passkey: { encodedChallenge: string; attestation: v1Attestation };
        if (isWeb()) {
          const res = await this.passkeyStamper?.createWebPasskey({
            publicKey: {
              user: {
                name,
                displayName,
              },
            },
          });
          if (!res) {
            throw new TurnkeyError(
              "Failed to create React Native passkey",
              TurnkeyErrorCodes.INTERNAL_ERROR
            );
          }
          passkey = {
            encodedChallenge: res?.encodedChallenge,
            attestation: res?.attestation,
          };
        } else if (isReactNative()) {
          const res = await this.passkeyStamper?.createReactNativePasskey({
            name,
            displayName,
          });
          if (!res) {
            throw new TurnkeyError(
              "Failed to create React Native passkey",
              TurnkeyErrorCodes.INTERNAL_ERROR
            );
          }
          passkey = {
            encodedChallenge: res?.challenge,
            attestation: res?.attestation,
          };
        } else {
          throw new TurnkeyError(
            "Unsupported platform for passkey creation",
            TurnkeyErrorCodes.INVALID_REQUEST
          );
        }

        return passkey;
      },
      {
        errorMessage: "Failed to create passkey",
        errorCode: TurnkeyErrorCodes.CREATE_PASSKEY_ERROR,
        customMessageByMessages: {
          "timed out or was not allowed": {
            message: "Passkey creation was cancelled by the user.",
            code: TurnkeyErrorCodes.SELECT_PASSKEY_CANCELLED,
          },
        },
      }
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
  logout = async (params?: { sessionKey?: string }): Promise<void> => {
    withTurnkeyErrorHandling(
      async () => {
        if (params?.sessionKey) {
          const session = await this.storageManager.getSession(
            params.sessionKey
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
              TurnkeyErrorCodes.NO_SESSION_FOUND
            );
          }
        }
      },
      {
        errorMessage: "Failed to log out",
        errorCode: TurnkeyErrorCodes.LOGOUT_ERROR,
      }
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
   * @returns A promise that resolves to a signed JWT session token.
   * @throws {TurnkeyError} If there is an error during the passkey login process or if the user cancels the passkey prompt.
   */
  loginWithPasskey = async (params?: {
    publicKey?: string;
    sessionKey?: string;
    expirationSeconds?: string;
  }): Promise<string> => {
    let generatedKeyPair: string | undefined = undefined;
    return await withTurnkeyErrorHandling(
      async () => {
        generatedKeyPair =
          params?.publicKey || (await this.apiKeyStamper?.createKeyPair());
        const sessionKey = params?.sessionKey || SessionKey.DefaultSessionkey;

        const expirationSeconds =
          params?.expirationSeconds || DEFAULT_SESSION_EXPIRATION_IN_SECONDS;

        if (!generatedKeyPair) {
          throw new TurnkeyError(
            "A publickey could not be found or generated.",
            TurnkeyErrorCodes.INTERNAL_ERROR
          );
        }
        const sessionResponse = await this.httpClient.stampLogin(
          {
            publicKey: generatedKeyPair,
            organizationId: this.config.organizationId,
            expirationSeconds,
          },
          StamperType.Passkey
        );

        await this.storeSession({
          sessionToken: sessionResponse.session,
          sessionKey,
        });

        generatedKeyPair = undefined; // Key pair was successfully used, set to null to prevent cleanup

        return sessionResponse.session;
      },
      {
        errorMessage: "Unable to log in with the provided passkey",
        errorCode: TurnkeyErrorCodes.PASSKEY_LOGIN_AUTH_ERROR,
        customMessageByMessages: {
          "timed out or was not allowed": {
            message: "Passkey login was cancelled by the user.",
            code: TurnkeyErrorCodes.SELECT_PASSKEY_CANCELLED,
          },
        },
      },
      {
        finallyFn: async () => {
          if (generatedKeyPair) {
            try {
              await this.apiKeyStamper?.deleteKeyPair(generatedKeyPair);
            } catch (cleanupError) {
              throw new TurnkeyError(
                `Failed to clean up generated key pair`,
                TurnkeyErrorCodes.KEY_PAIR_CLEANUP_ERROR,
                cleanupError
              );
            }
          }
        },
      }
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
   * @param params.createSubOrgParams - parameters for creating a sub-organization (e.g., authenticators, user metadata).
   * @param params.sessionKey - session key to use for storing the session (defaults to the default session key).
   * @param params.passkeyDisplayName - display name for the passkey (defaults to a generated name based on the current timestamp).
   * @param params.expirationSeconds - session expiration time in seconds (defaults to the configured default).
   * @returns A promise that resolves to a signed JWT session token for the new sub-organization.
   * @throws {TurnkeyError} If there is an error during passkey creation, sub-organization creation, or session storage.
   */
  signUpWithPasskey = async (params?: {
    createSubOrgParams?: CreateSubOrgParams;
    sessionKey?: string;
    passkeyDisplayName?: string;
    expirationSeconds?: string;
  }): Promise<string> => {
    const {
      createSubOrgParams,
      passkeyDisplayName,
      sessionKey = SessionKey.DefaultSessionkey,
      expirationSeconds = DEFAULT_SESSION_EXPIRATION_IN_SECONDS,
    } = params || {};

    let generatedKeyPair: string | undefined = undefined;
    return withTurnkeyErrorHandling(
      async () => {
        generatedKeyPair = await this.apiKeyStamper?.createKeyPair();
        const passkeyName = passkeyDisplayName || `passkey-${Date.now()}`;

        // A passkey will be created automatically when you call this function. The name is passed in
        const passkey = await this.createPasskey({
          name: passkeyName,
          displayName: passkeyName,
        });

        if (!passkey) {
          throw new TurnkeyError(
            "Failed to create passkey: encoded challenge or attestation is missing",
            TurnkeyErrorCodes.INTERNAL_ERROR
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
                apiKeyName: `passkey-auth-${generatedKeyPair}`,
                publicKey: generatedKeyPair!,
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
            TurnkeyErrorCodes.PASSKEY_SIGNUP_AUTH_ERROR
          );
        }

        const newGeneratedKeyPair = await this.apiKeyStamper?.createKeyPair();
        this.apiKeyStamper?.setPublicKeyOverride(generatedKeyPair!);

        const sessionResponse = await this.httpClient.stampLogin({
          publicKey: newGeneratedKeyPair!,
          organizationId: this.config.organizationId,
          expirationSeconds,
        });

        await this.apiKeyStamper?.deleteKeyPair(generatedKeyPair!);

        await this.storeSession({
          sessionToken: sessionResponse.session,
          sessionKey,
        });

        generatedKeyPair = undefined; // Key pair was successfully used, set to null to prevent cleanup

        return sessionResponse.session;
      },
      {
        errorCode: TurnkeyErrorCodes.PASSKEY_SIGNUP_AUTH_ERROR,
        errorMessage: "Failed to sign up with passkey",
      },
      {
        finallyFn: async () => {
          this.apiKeyStamper?.clearPublicKeyOverride();
          if (generatedKeyPair) {
            try {
              await this.apiKeyStamper?.deleteKeyPair(generatedKeyPair);
            } catch (cleanupError) {
              throw new TurnkeyError(
                `Failed to clean up generated key pair`,
                TurnkeyErrorCodes.KEY_PAIR_CLEANUP_ERROR,
                cleanupError
              );
            }
          }
        },
      }
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
  getWalletProviders = async (chain?: Chain): Promise<WalletProvider[]> => {
    return withTurnkeyErrorHandling(
      async () => {
        if (!this.walletManager) {
          throw new TurnkeyError(
            "Wallet manager is not initialized",
            TurnkeyErrorCodes.WALLET_MANAGER_COMPONENT_NOT_INITIALIZED
          );
        }

        return await this.walletManager.getProviders(chain);
      },
      {
        errorMessage: "Unable to get wallet providers",
        errorCode: TurnkeyErrorCodes.FETCH_WALLETS_ERROR,
      }
    );
  };

  /**
   * Connects the specified wallet account.
   *
   * - Requires the wallet manager and its connector to be initialized.
   *
   * @param walletProvider - wallet provider to connect.
   * @returns A promise that resolves once the wallet account is connected.
   * @throws {TurnkeyError} If the wallet manager is uninitialized or the connection fails.
   */
  connectWalletAccount = async (walletProvider: WalletProvider) => {
    return withTurnkeyErrorHandling(
      async () => {
        if (!this.walletManager?.connector) {
          throw new TurnkeyError(
            "Wallet connector is not initialized",
            TurnkeyErrorCodes.WALLET_MANAGER_COMPONENT_NOT_INITIALIZED
          );
        }
        await this.walletManager.connector.connectWalletAccount(walletProvider);
      },
      {
        errorMessage: "Unable to connect wallet account",
        errorCode: TurnkeyErrorCodes.CONNECT_WALLET_ACCOUNT_ERROR,
      }
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
            TurnkeyErrorCodes.WALLET_MANAGER_COMPONENT_NOT_INITIALIZED
          );
        }

        await this.walletManager.connector.disconnectWalletAccount(
          walletProvider
        );
      },
      {
        errorMessage: "Unable to disconnect wallet account",
        errorCode: TurnkeyErrorCodes.DISCONNECT_WALLET_ACCOUNT_ERROR,
      }
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
   * @param params.walletProviders - Optional list of wallet providers to search; falls back to `getWalletProviders()` if omitted.
   * @returns A promise that resolves once the chain switch is complete.
   *
   * @throws {TurnkeyError} If the wallet manager is uninitialized, the provider is not connected, or the switch fails.
   */
  switchWalletAccountChain = async (params: {
    walletAccount: WalletAccount;
    chainOrId: string | SwitchableChain;
    walletProviders?: WalletProvider[] | undefined;
  }): Promise<void> => {
    const { walletAccount, chainOrId, walletProviders } = params;

    return withTurnkeyErrorHandling(
      async () => {
        if (!this.walletManager?.connector) {
          throw new TurnkeyError(
            "Wallet connector is not initialized",
            TurnkeyErrorCodes.WALLET_MANAGER_COMPONENT_NOT_INITIALIZED
          );
        }

        if (walletAccount.source === WalletSource.Embedded) {
          throw new TurnkeyError(
            "You can only switch chains for connected wallet accounts",
            TurnkeyErrorCodes.NOT_FOUND
          );
        }

        const providers = walletProviders ?? (await this.getWalletProviders());
        const walletProvider = findWalletProviderFromAddress(
          walletAccount.address,
          providers
        );

        if (!walletProvider) {
          throw new TurnkeyError(
            "Wallet provider not found",
            TurnkeyErrorCodes.SWITCH_WALLET_CHAIN_ERROR
          );
        }

        // if the wallet provider is already on the desired chain, do nothing
        if (walletProvider.chainInfo.namespace === chainOrId) {
          return;
        }

        await this.walletManager.connector.switchChain(
          walletProvider,
          chainOrId
        );
      },
      {
        errorMessage: "Unable to switch wallet account chain",
        errorCode: TurnkeyErrorCodes.SWITCH_WALLET_CHAIN_ERROR,
      }
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
   * @returns A promise that resolves to the created session token.
   * @throws {TurnkeyError} If the wallet stamper is uninitialized, a public key cannot be found or generated, or login fails.
   */
  loginWithWallet = async (params: {
    walletProvider: WalletProvider;
    publicKey?: string;
    sessionKey?: string;
    expirationSeconds?: string;
  }): Promise<string> => {
    let publicKey =
      params.publicKey || (await this.apiKeyStamper?.createKeyPair());
    return withTurnkeyErrorHandling(
      async () => {
        if (!this.walletManager?.stamper) {
          throw new TurnkeyError(
            "Wallet stamper is not initialized",
            TurnkeyErrorCodes.WALLET_MANAGER_COMPONENT_NOT_INITIALIZED
          );
        }
        const sessionKey = params.sessionKey || SessionKey.DefaultSessionkey;
        const walletProvider = params.walletProvider;

        const expirationSeconds =
          params?.expirationSeconds || DEFAULT_SESSION_EXPIRATION_IN_SECONDS;

        if (!publicKey) {
          throw new TurnkeyError(
            "A publickey could not be found or generated.",
            TurnkeyErrorCodes.INTERNAL_ERROR
          );
        }

        this.walletManager.stamper.setProvider(
          walletProvider.interfaceType,
          walletProvider
        );

        const sessionResponse = await this.httpClient.stampLogin(
          {
            publicKey,
            organizationId: this.config.organizationId,
            expirationSeconds,
          },
          StamperType.Wallet
        );

        await this.storeSession({
          sessionToken: sessionResponse.session,
          sessionKey,
        });

        return sessionResponse.session;
      },
      {
        errorMessage: "Unable to log in with the provided wallet",
        errorCode: TurnkeyErrorCodes.WALLET_LOGIN_AUTH_ERROR,
      },
      {
        finallyFn: async () => {
          // Clean up the generated key pair if it wasn't successfully used
          this.apiKeyStamper?.clearPublicKeyOverride();
          if (publicKey) {
            try {
              await this.apiKeyStamper?.deleteKeyPair(publicKey);
            } catch (cleanupError) {
              throw new TurnkeyError(
                "Failed to clean up generated key pair",
                TurnkeyErrorCodes.KEY_PAIR_CLEANUP_ERROR,
                cleanupError
              );
            }
          }
        },
      }
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
   * @returns A promise that resolves to a signed JWT session token for the new sub-organization.
   * @throws {TurnkeyError} If there is an error during wallet authentication, sub-organization creation, session storage, or cleanup.
   */
  signUpWithWallet = async (params: {
    walletProvider: WalletProvider;
    createSubOrgParams?: CreateSubOrgParams;
    sessionKey?: string;
    expirationSeconds?: string;
  }): Promise<string> => {
    const {
      walletProvider,
      createSubOrgParams,
      sessionKey = SessionKey.DefaultSessionkey,
      expirationSeconds = DEFAULT_SESSION_EXPIRATION_IN_SECONDS,
    } = params;

    let generatedKeyPair: string | undefined = undefined;
    return withTurnkeyErrorHandling(
      async () => {
        if (!this.walletManager?.stamper) {
          throw new TurnkeyError(
            "Wallet stamper is not initialized",
            TurnkeyErrorCodes.WALLET_MANAGER_COMPONENT_NOT_INITIALIZED
          );
        }

        generatedKeyPair = await this.apiKeyStamper?.createKeyPair();

        this.walletManager.stamper.setProvider(
          walletProvider.interfaceType,
          walletProvider
        );

        const publicKey = await this.walletManager.stamper.getPublicKey(
          walletProvider.interfaceType,
          walletProvider
        );

        if (!publicKey) {
          throw new TurnkeyError(
            "Failed to get public key from wallet",
            TurnkeyErrorCodes.WALLET_SIGNUP_AUTH_ERROR
          );
        }

        const signUpBody = buildSignUpBody({
          createSubOrgParams: {
            ...createSubOrgParams,
            apiKeys: [
              {
                apiKeyName: `wallet-auth:${publicKey}`,
                publicKey: publicKey,
                curveType: isEthereumProvider(walletProvider)
                  ? ("API_KEY_CURVE_SECP256K1" as const)
                  : ("API_KEY_CURVE_ED25519" as const),
              },
              {
                apiKeyName: `wallet-auth-${generatedKeyPair}`,
                publicKey: generatedKeyPair!,
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
            TurnkeyErrorCodes.WALLET_SIGNUP_AUTH_ERROR
          );
        }

        const newGeneratedKeyPair = await this.apiKeyStamper?.createKeyPair();
        this.apiKeyStamper?.setPublicKeyOverride(generatedKeyPair!);

        const sessionResponse = await this.httpClient.stampLogin({
          publicKey: newGeneratedKeyPair!,
          organizationId: this.config.organizationId,
          expirationSeconds,
        });

        await this.apiKeyStamper?.deleteKeyPair(generatedKeyPair!);

        await this.storeSession({
          sessionToken: sessionResponse.session,
          sessionKey,
        });

        generatedKeyPair = undefined; // Key pair was successfully used, set to null to prevent cleanup

        return sessionResponse.session;
      },
      {
        errorMessage: "Failed to sign up with wallet",
        errorCode: TurnkeyErrorCodes.WALLET_SIGNUP_AUTH_ERROR,
      },
      {
        finallyFn: async () => {
          // Clean up the generated key pair if it wasn't successfully used
          this.apiKeyStamper?.clearPublicKeyOverride();
          if (generatedKeyPair) {
            try {
              await this.apiKeyStamper?.deleteKeyPair(generatedKeyPair);
            } catch (cleanupError) {
              throw new TurnkeyError(
                "Failed to clean up generated key pair",
                TurnkeyErrorCodes.KEY_PAIR_CLEANUP_ERROR,
                cleanupError
              );
            }
          }
        },
      }
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
   * @param params.createSubOrgParams - optional parameters for creating a sub-organization (e.g., authenticators, user metadata).
   * @param params.sessionKey - session key to use for storing the session (defaults to the default session key).
   * @param params.expirationSeconds - session expiration time in seconds (defaults to the configured default).
   * @returns A promise that resolves to a signed JWT session token for the sub-organization (new or existing).
   * @throws {TurnkeyError} If there is an error during wallet authentication, sub-organization creation, or session storage.
   */
  loginOrSignupWithWallet = async (params: {
    walletProvider: WalletProvider;
    createSubOrgParams?: CreateSubOrgParams;
    sessionKey?: string;
    expirationSeconds?: string;
  }): Promise<string> => {
    const createSubOrgParams = params.createSubOrgParams;
    const sessionKey = params.sessionKey || SessionKey.DefaultSessionkey;
    const walletProvider = params.walletProvider;
    const expirationSeconds =
      params.expirationSeconds || DEFAULT_SESSION_EXPIRATION_IN_SECONDS;

    let generatedKeyPair: string | undefined = undefined;
    return withTurnkeyErrorHandling(
      async () => {
        if (!this.walletManager?.stamper) {
          throw new TurnkeyError(
            "Wallet stamper is not initialized",
            TurnkeyErrorCodes.WALLET_MANAGER_COMPONENT_NOT_INITIALIZED
          );
        }
        generatedKeyPair = await this.apiKeyStamper?.createKeyPair();

        this.walletManager.stamper.setProvider(
          walletProvider.interfaceType,
          walletProvider
        );

        // here we sign the request with the wallet, but we don't send it to the Turnkey yet
        // this is because we need to check if the subOrg exists first, and create one if it doesn't
        // once we have the subOrg for the publicKey, we then can send the request to the Turnkey
        const signedRequest = await withTurnkeyErrorHandling(
          async () => {
            return this.httpClient.stampStampLogin(
              {
                publicKey: generatedKeyPair!,
                organizationId: this.config.organizationId,
                expirationSeconds,
              },
              StamperType.Wallet
            );
          },
          {
            errorMessage: "Failed to create stamped request for wallet login",
            errorCode: TurnkeyErrorCodes.WALLET_LOGIN_OR_SIGNUP_ERROR,
            customMessageByMessages: {
              "Failed to sign the message": {
                message: "Wallet auth was cancelled by the user.",
                code: TurnkeyErrorCodes.CONNECT_WALLET_CANCELLED,
              },
            },
          }
        );

        if (!signedRequest) {
          throw new TurnkeyError(
            "Failed to create stamped request for wallet login",
            TurnkeyErrorCodes.BAD_RESPONSE
          );
        }

        let publicKey: string | undefined;
        switch (walletProvider.chainInfo.namespace) {
          case Chain.Ethereum: {
            // for Ethereum, there is no way to get the public key from the wallet address
            // so we derive it from the signed request
            publicKey = getPublicKeyFromStampHeader(
              signedRequest.stamp.stampHeaderValue
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
              walletProvider
            );
            break;
          }

          default:
            throw new TurnkeyError(
              `Unsupported interface type: ${walletProvider.interfaceType}`,
              TurnkeyErrorCodes.INVALID_REQUEST
            );
        }

        // here we check if the subOrg exists and create one
        // then we send off the stamped request to the Turnkey

        const accountRes = await this.httpClient.proxyGetAccount({
          filterType: FilterType.PublicKey,
          filterValue: publicKey,
        });

        if (!accountRes) {
          throw new TurnkeyError(
            `Account fetch failed`,
            TurnkeyErrorCodes.ACCOUNT_FETCH_ERROR
          );
        }

        const subOrganizationId = accountRes.organizationId;

        // if there is no subOrganizationId, we create one
        if (!subOrganizationId) {
          const signUpBody = buildSignUpBody({
            createSubOrgParams: {
              ...createSubOrgParams,
              apiKeys: [
                {
                  apiKeyName: `wallet-auth:${publicKey}`,
                  publicKey: publicKey,
                  curveType: isEthereumProvider(walletProvider)
                    ? ("API_KEY_CURVE_SECP256K1" as const)
                    : ("API_KEY_CURVE_ED25519" as const),
                },
              ],
            },
          });

          const res = await this.httpClient.proxySignup(signUpBody);

          if (!res) {
            throw new TurnkeyError(
              `Sign up failed`,
              TurnkeyErrorCodes.WALLET_SIGNUP_AUTH_ERROR
            );
          }
        }

        // now we can send the stamped request to the Turnkey
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          [signedRequest.stamp.stampHeaderName]:
            signedRequest.stamp.stampHeaderValue,
        };

        const res = await fetch(signedRequest.url, {
          method: "POST",
          headers,
          body: signedRequest.body,
        });

        if (!res.ok) {
          const errorText = await res.text();
          throw new TurnkeyNetworkError(
            `Stamped request failed`,
            res.status,
            TurnkeyErrorCodes.WALLET_LOGIN_AUTH_ERROR,
            errorText
          );
        }

        const sessionResponse = await res.json();
        const sessionToken =
          sessionResponse.activity.result.stampLoginResult?.session;
        if (!sessionToken) {
          throw new TurnkeyError(
            "Session token not found in the response",
            TurnkeyErrorCodes.BAD_RESPONSE
          );
        }

        await this.storeSession({
          sessionToken: sessionToken,
          sessionKey,
        });

        return sessionToken;
      },
      {
        errorCode: TurnkeyErrorCodes.WALLET_LOGIN_OR_SIGNUP_ERROR,
        errorMessage: "Failed to log in or sign up with wallet",
        catchFn: async () => {
          if (generatedKeyPair) {
            try {
              await this.apiKeyStamper?.deleteKeyPair(generatedKeyPair);
            } catch (cleanupError) {
              throw new TurnkeyError(
                `Failed to clean up generated key pair`,
                TurnkeyErrorCodes.KEY_PAIR_CLEANUP_ERROR,
                cleanupError
              );
            }
          }
        },
      }
    );
  };

  /**
   * Initializes the Fiat Onramp Flow.
   *
   * - This function initiates the OTP flow by sending a one-time password (OTP) code to the user's contact information (email address or phone number) via the auth proxy.
   * - Supports both email and SMS OTP types.
   * - Returns an OTP ID that is required for subsequent OTP verification.
   *
   * @param params.otpType - type of OTP to initialize (OtpType.Email or OtpType.Sms).
   * @param params.contact - contact information for the user (e.g., email address or phone number).
   * @returns A promise that resolves with the onRampUrl and onRampTransactionId.
   * @throws {TurnkeyError} If there is an error during the fiat onramp initialization process.
   */
  initFiatOnramp = async (
    params: TInitFiatOnRampBody,
  ): Promise<{ onRampUrl: string; onRampTransactionId: string }> => {
    return withTurnkeyErrorHandling(
      async () => {
        const initFiatOnRampRes = await this.httpClient.initFiatOnRamp(params);

        if (!initFiatOnRampRes || !initFiatOnRampRes.onRampUrl) {
          throw new TurnkeyError(
            "Failed to initialize fiat onramp: onRampUrl is missing",
            TurnkeyErrorCodes.INIT_FIAT_ONRAMP_ERROR,
          );
        }

        return {
          onRampUrl: initFiatOnRampRes.onRampUrl,
          onRampTransactionId: initFiatOnRampRes.onRampTransactionId,
        };
      },
      {
        errorMessage: "Failed to initialize fiat onramp",
        errorCode: TurnkeyErrorCodes.INIT_FIAT_ONRAMP_ERROR,
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
   * @returns A promise that resolves to the OTP ID required for verification.
   * @throws {TurnkeyError} If there is an error during the OTP initialization process or if the maximum number of OTPs has been reached.
   */
  initOtp = async (params: {
    otpType: OtpType;
    contact: string;
  }): Promise<string> => {
    return withTurnkeyErrorHandling(
      async () => {
        const initOtpRes = await this.httpClient.proxyInitOtp(params);

        if (!initOtpRes || !initOtpRes.otpId) {
          throw new TurnkeyError(
            "Failed to initialize OTP: otpId is missing",
            TurnkeyErrorCodes.INIT_OTP_ERROR
          );
        }

        return initOtpRes.otpId;
      },
      {
        errorMessage: "Failed to initialize OTP",
        errorCode: TurnkeyErrorCodes.INIT_OTP_ERROR,
        customMessageByMessages: {
          "Max number of OTPs have been initiated": {
            message:
              "Maximum number of OTPs has been reached for this contact.",
            code: TurnkeyErrorCodes.MAX_OTP_INITIATED_ERROR,
          },
        },
      }
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
  verifyOtp = async (params: {
    otpId: string;
    otpCode: string;
    contact: string;
    otpType: OtpType;
  }): Promise<{ subOrganizationId: string; verificationToken: string }> => {
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
            TurnkeyErrorCodes.INTERNAL_ERROR
          );
        }
        const accountRes = await this.httpClient.proxyGetAccount({
          filterType: OtpTypeToFilterTypeMap[otpType],
          filterValue: contact,
        });

        if (!accountRes) {
          throw new TurnkeyError(
            `Account fetch failed`,
            TurnkeyErrorCodes.ACCOUNT_FETCH_ERROR
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
        customMessageByMessages: {
          "Invalid OTP code": {
            message: "The provided OTP code is invalid.",
            code: TurnkeyErrorCodes.INVALID_OTP_CODE,
          },
        },
      }
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
   * @param params.invalidateExisting - flag to invalidate existing session for the user.
   * @param params.sessionKey - session key to use for session creation (defaults to the default session key).
   * @returns A promise that resolves to a signed JWT session token.
   * @throws {TurnkeyError} If there is an error during the OTP login process or if key pair cleanup fails.
   */
  loginWithOtp = async (params: {
    verificationToken: string;
    publicKey?: string;
    invalidateExisting?: boolean;
    sessionKey?: string;
  }): Promise<string> => {
    const {
      verificationToken,
      invalidateExisting = false,
      publicKey = await this.apiKeyStamper?.createKeyPair(),
      sessionKey = SessionKey.DefaultSessionkey,
    } = params;

    return withTurnkeyErrorHandling(
      async () => {
        const res = await this.httpClient.proxyOtpLogin({
          verificationToken,
          publicKey: publicKey!,
          invalidateExisting,
        });

        if (!res) {
          throw new TurnkeyError(
            `Auth proxy OTP login failed`,
            TurnkeyErrorCodes.OTP_LOGIN_ERROR
          );
        }

        const loginRes = await res;
        if (!loginRes.session) {
          throw new TurnkeyError(
            "No session returned from OTP login",
            TurnkeyErrorCodes.OTP_LOGIN_ERROR
          );
        }

        await this.storeSession({
          sessionToken: loginRes.session,
          sessionKey,
        });

        return loginRes.session;
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
                cleanupError
              );
            }
          }
        },
      }
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
   * @returns A promise that resolves to a signed JWT session token for the new sub-organization.
   * @throws {TurnkeyError} If there is an error during the OTP sign-up process or session storage.
   */
  signUpWithOtp = async (params: {
    verificationToken: string;
    contact: string;
    otpType: OtpType;
    createSubOrgParams?: CreateSubOrgParams;
    invalidateExisting?: boolean;
    sessionKey?: string;
  }): Promise<string> => {
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
        const generatedKeyPair = await this.apiKeyStamper?.createKeyPair();
        const res = await this.httpClient.proxySignup(signUpBody);

        if (!res) {
          throw new TurnkeyError(
            `Auth proxy OTP sign up failed`,
            TurnkeyErrorCodes.OTP_SIGNUP_ERROR
          );
        }

        return await this.loginWithOtp({
          verificationToken,
          publicKey: generatedKeyPair!,
          ...(invalidateExisting && { invalidateExisting }),
          ...(sessionKey && { sessionKey }),
        });
      },
      {
        errorCode: TurnkeyErrorCodes.OTP_SIGNUP_ERROR,
        errorMessage: "Failed to sign up with OTP",
      }
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
   * @returns A promise that resolves to a signed JWT session token for the user.
   * @throws {TurnkeyError} If there is an error during OTP verification, sign-up, or login.
   */
  completeOtp = async (params: {
    otpId: string;
    otpCode: string;
    contact: string;
    otpType: OtpType;
    publicKey?: string;
    invalidateExisting?: boolean;
    sessionKey?: string;
    createSubOrgParams?: CreateSubOrgParams;
  }): Promise<string> => {
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
            TurnkeyErrorCodes.VERIFY_OTP_ERROR
          );
        }

        if (!subOrganizationId) {
          return await this.signUpWithOtp({
            verificationToken,
            contact: contact,
            otpType: otpType,
            ...(createSubOrgParams && {
              createSubOrgParams,
            }),
            ...(invalidateExisting && { invalidateExisting }),
            ...(sessionKey && { sessionKey }),
          });
        } else {
          return await this.loginWithOtp({
            verificationToken,
            ...(publicKey && { publicKey }),
            ...(invalidateExisting && { invalidateExisting }),
            ...(sessionKey && { sessionKey }),
          });
        }
      },
      {
        errorMessage: "Failed to complete OTP process",
        errorCode: TurnkeyErrorCodes.OTP_COMPLETION_ERROR,
      }
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
   * @param params.publicKey - public key to use for authentication. Must be generated prior to calling this function.
   * @param params.providerName - name of the OAuth provider (defaults to a generated name with a timestamp).
   * @param params.sessionKey - session key to use for session creation (defaults to the default session key).
   * @param params.invalidateExisting - flag to invalidate existing sessions for the user.
   * @param params.createSubOrgParams - parameters for sub-organization creation (e.g., authenticators, user metadata).
   * @returns A promise that resolves to a signed JWT session token for the user.
   * @throws {TurnkeyError} If there is an error during the OAuth completion process, such as account lookup, sign-up, or login.
   */
  completeOauth = async (params: {
    oidcToken: string;
    publicKey: string;
    providerName?: string;
    sessionKey?: string;
    invalidateExisting?: boolean;
    createSubOrgParams?: CreateSubOrgParams;
  }): Promise<string> => {
    const {
      oidcToken,
      publicKey,
      createSubOrgParams,
      providerName = "OpenID Connect Provider" + Date.now(),
      sessionKey = SessionKey.DefaultSessionkey,
      invalidateExisting = false,
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
            TurnkeyErrorCodes.ACCOUNT_FETCH_ERROR
          );
        }
        const subOrganizationId = accountRes.organizationId;

        if (subOrganizationId) {
          return this.loginWithOauth({
            oidcToken,
            publicKey,
            invalidateExisting,
            sessionKey,
          });
        } else {
          return this.signUpWithOauth({
            oidcToken,
            publicKey,
            providerName,
            ...(createSubOrgParams && {
              createSubOrgParams,
            }),
          });
        }
      },
      {
        errorMessage: "Failed to complete OAuth process",
        errorCode: TurnkeyErrorCodes.OAUTH_LOGIN_ERROR,
      }
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
   * @param params.publicKey - public key to use for authentication. Must be generated prior to calling this function.
   * @param params.invalidateExisting - flag to invalidate existing sessions for the user.
   * @param params.sessionKey - session key to use for session creation (defaults to the default session key).
   * @returns A promise that resolves to a signed JWT session token.
   * @throws {TurnkeyError} If there is an error during the OAuth login process or if key pair cleanup fails.
   */
  loginWithOauth = async (params: {
    oidcToken: string;
    publicKey: string;
    invalidateExisting?: boolean;
    sessionKey?: string;
  }): Promise<string> => {
    const {
      oidcToken,
      invalidateExisting = false,
      publicKey,
      sessionKey = SessionKey.DefaultSessionkey,
    } = params;

    return withTurnkeyErrorHandling(
      async () => {
        if (!publicKey) {
          throw new TurnkeyError(
            "Public key must be provided to log in with OAuth. Please create a key pair first.",
            TurnkeyErrorCodes.MISSING_PARAMS
          );
        }

        const loginRes = await this.httpClient.proxyOAuthLogin({
          oidcToken,
          publicKey,
          invalidateExisting,
        });

        if (!loginRes) {
          throw new TurnkeyError(
            `Auth proxy OAuth login failed`,
            TurnkeyErrorCodes.OAUTH_LOGIN_ERROR
          );
        }

        if (!loginRes.session) {
          throw new TurnkeyError(
            "No session returned from oauth login",
            TurnkeyErrorCodes.OAUTH_LOGIN_ERROR
          );
        }

        await this.storeSession({
          sessionToken: loginRes.session,
          sessionKey,
        });

        return loginRes.session;
      },
      {
        errorMessage: "Failed to complete OAuth login",
        errorCode: TurnkeyErrorCodes.OAUTH_LOGIN_ERROR,
        customMessageByMessages: {
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
                cleanupError
              );
            }
          }
        },
      }
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
   * @returns A promise that resolves to a signed JWT session token for the new sub-organization.
   * @throws {TurnkeyError} If there is an error during the OAuth sign-up or login process.
   */
  signUpWithOauth = async (params: {
    oidcToken: string;
    publicKey: string;
    providerName: string;
    createSubOrgParams?: CreateSubOrgParams;
    sessionKey?: string;
  }): Promise<string> => {
    const { oidcToken, publicKey, providerName, createSubOrgParams } = params;

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

        const res = await this.httpClient.proxySignup(signUpBody);

        if (!res) {
          throw new TurnkeyError(
            `Auth proxy OAuth signup failed`,
            TurnkeyErrorCodes.OAUTH_SIGNUP_ERROR
          );
        }

        return await this.loginWithOauth({
          oidcToken,
          publicKey: publicKey!,
        });
      },
      {
        errorMessage: "Failed to sign up with OAuth",
        errorCode: TurnkeyErrorCodes.OAUTH_SIGNUP_ERROR,
      }
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
   * @param params.stampWith - parameter to stamp the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   * @returns A promise that resolves to an array of `Wallet` objects.
   * @throws {TurnkeyError} If no active session is found or if there is an error fetching wallets.
   */
  fetchWallets = async (params?: {
    walletProviders?: WalletProvider[] | undefined;
    stampWith?: StamperType | undefined;
  }): Promise<Wallet[]> => {
    const { stampWith, walletProviders } = params || {};
    const session = await this.storageManager.getActiveSession();

    if (!session) {
      throw new TurnkeyError(
        "No active session found. Please log in first.",
        TurnkeyErrorCodes.NO_SESSION_FOUND
      );
    }

    return withTurnkeyErrorHandling(
      async () => {
        const res = await this.httpClient.getWallets(
          { organizationId: session.organizationId },
          stampWith
        );

        if (!res || !res.wallets) {
          throw new TurnkeyError(
            "No wallets found in the response",
            TurnkeyErrorCodes.BAD_RESPONSE
          );
        }

        const embedded: EmbeddedWallet[] = await Promise.all(
          res.wallets.map(async (wallet) => {
            const embeddedWallet: Wallet = {
              ...wallet,
              source: WalletSource.Embedded,
              accounts: [],
            };

            const accounts = await this.fetchWalletAccounts({
              wallet: embeddedWallet,
              ...(stampWith !== undefined && { stampWith }),
            });

            embeddedWallet.accounts = accounts;
            return embeddedWallet;
          })
        );

        // if wallet connecting is disabled we return only embedded wallets
        if (!this.walletManager?.connector) return embedded;

        const providers = walletProviders ?? (await this.getWalletProviders());

        const groupedProviders = new Map<string, WalletProvider[]>();
        for (const provider of providers) {
          const walletId =
            provider.info?.name?.toLowerCase().replace(/\s+/g, "-") ||
            "unknown";
          const group = groupedProviders.get(walletId) || [];
          group.push(provider);
          groupedProviders.set(walletId, group);
        }

        const connected: ConnectedWallet[] = (
          await Promise.all(
            Array.from(groupedProviders.entries()).map(
              async ([walletId, grouped]) => {
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
                });

                wallet.accounts = accounts;
                return wallet;
              }
            )
          )
        ).filter((wallet) => wallet.accounts.length > 0);

        return [...embedded, ...connected];
      },
      {
        errorMessage: "Failed to fetch wallets",
        errorCode: TurnkeyErrorCodes.FETCH_WALLETS_ERROR,
      }
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
   * @returns A promise that resolves to an array of `v1WalletAccount` objects.
   * @throws {TurnkeyError} If no active session is found or if there is an error fetching wallet accounts.
   */
  fetchWalletAccounts = async (params: {
    wallet: Wallet;
    walletProviders?: WalletProvider[];
    paginationOptions?: v1Pagination;
    stampWith?: StamperType | undefined;
  }): Promise<WalletAccount[]> => {
    const { wallet, stampWith, walletProviders, paginationOptions } = params;
    const session = await this.storageManager.getActiveSession();

    if (!session) {
      throw new TurnkeyError(
        "No active session found. Please log in first.",
        TurnkeyErrorCodes.NO_SESSION_FOUND
      );
    }

    return withTurnkeyErrorHandling(
      async () => {
        // this is an embedded wallet so we fetch accounts from Turnkey
        if (wallet.source === WalletSource.Embedded) {
          const embedded: EmbeddedWalletAccount[] = [];

          const res = await this.httpClient.getWalletAccounts(
            {
              walletId: wallet.walletId,
              organizationId: session.organizationId,
              paginationOptions: paginationOptions || { limit: "100" },
            },
            stampWith
          );

          if (!res || !res.accounts) {
            throw new TurnkeyError(
              "No wallet accounts found in the response",
              TurnkeyErrorCodes.BAD_RESPONSE
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

        const providers = walletProviders ?? (await this.getWalletProviders());
        const matching = providers.filter(
          (p) =>
            p.info?.name?.toLowerCase().replace(/\s+/g, "-") ===
              wallet.walletId && p.connectedAddresses.length > 0
        );

        const sign = this.walletManager!.connector!.sign.bind(
          this.walletManager!.connector
        );

        for (const provider of matching) {
          const timestamp = toExternalTimestamp();

          for (const address of provider.connectedAddresses) {
            if (isEthereumProvider(provider)) {
              const evmAccount: ConnectedEthereumWalletAccount = {
                walletAccountId: `${wallet.walletId}-${provider.interfaceType}-${address}`,
                organizationId: session.organizationId,
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
                organizationId: session.organizationId,
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
                signMessage: (msg: string) =>
                  sign(msg, provider, SignIntent.SignMessage),
                signTransaction: (tx: string) =>
                  sign(tx, provider, SignIntent.SignTransaction),
              };

              connected.push(solAccount);
              continue;
            }

            throw new Error(
              `Unsupported wallet chain: ${provider.chainInfo}. Supported chains are Ethereum and Solana.`
            );
          }
        }

        return connected;
      },
      {
        errorMessage: "Failed to fetch wallet accounts",
        errorCode: TurnkeyErrorCodes.FETCH_WALLET_ACCOUNTS_ERROR,
      }
    );
  };

  /**
   * Signs a message using the specified wallet account.
   *
   * - Supports both embedded and connected wallets.
   * - For **connected wallets**:
   *   - Delegates signing to the wallet provider’s native signing method.
   *   - **Important:** For Ethereum wallets (e.g., MetaMask), signatures follow [EIP-191](https://eips.ethereum.org/EIPS/eip-191).
   *     The message is automatically prefixed with `"\x19Ethereum Signed Message:\n" + message length`
   *     before signing. As a result, this signature **cannot be used as a raw transaction signature**
   *     or broadcast on-chain.
   * - For **embedded wallets**, uses the Turnkey API to sign the message directly.
   * - Automatically handles message encoding and hashing based on the wallet account’s address format,
   *   unless explicitly overridden.
   *
   * @param params.message - message to sign.
   * @param params.walletAccount - wallet account to use for signing.
   * @param params.encoding - override for the payload encoding (defaults to the encoding appropriate for the address type).
   * @param params.hashFunction - override for the hash function (defaults to the hash function appropriate for the address type).
   * @param params.stampWith - stamper to tag the signing request (e.g., Passkey, ApiKey, or Wallet).
   * @param params.addEthereumPrefix - whether to prefix the message with Ethereum's `"\x19Ethereum Signed Message:\n"` string.
   *   - If `true` (default for Ethereum), the message is prefixed before signing.
   *   - If `false`:
   *     - Connected wallets will throw an error because they always prefix automatically.
   *     - Embedded wallets will sign the raw message without any prefix.
   *
   * @returns A promise resolving to a `v1SignRawPayloadResult` containing the signature and metadata.
   * @throws {TurnkeyError} If signing fails, if the wallet account does not support signing, or if the response is invalid.
   */
  signMessage = async (params: {
    message: string;
    walletAccount: WalletAccount;
    encoding?: v1PayloadEncoding;
    hashFunction?: v1HashFunction;
    stampWith?: StamperType | undefined;
    addEthereumPrefix?: boolean;
  }): Promise<v1SignRawPayloadResult> => {
    const { message, walletAccount, stampWith, addEthereumPrefix } = params;

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
              TurnkeyErrorCodes.SIGN_MESSAGE_ERROR
            );
          }

          let encodedMessage = message;
          if (isEthereum) {
            encodedMessage = getEncodedMessage(
              walletAccount.addressFormat,
              message
            );
          }

          const sigHex = await walletAccount.signMessage(encodedMessage);
          return splitSignature(sigHex, walletAccount.addressFormat);
        }

        // this is an embedded wallet
        let messageToEncode = message;

        if (addEthereumPrefix && isEthereum) {
          const prefix = `\x19Ethereum Signed Message:\n${toUtf8Bytes(message).length}`;
          messageToEncode = prefix + message;
        }

        const encodedMessage = getEncodedMessage(
          walletAccount.addressFormat,
          messageToEncode
        );

        const response = await this.httpClient.signRawPayload(
          {
            signWith: walletAccount.address,
            payload: encodedMessage,
            encoding: payloadEncoding,
            hashFunction,
          },
          stampWith
        );

        if (response.activity.failure) {
          throw new TurnkeyError(
            "Failed to sign message, no signed payload returned",
            TurnkeyErrorCodes.SIGN_MESSAGE_ERROR
          );
        }

        return response.activity.result
          .signRawPayloadResult as v1SignRawPayloadResult;
      },
      {
        errorMessage: "Failed to sign message",
        errorCode: TurnkeyErrorCodes.SIGN_MESSAGE_ERROR,
      }
    );
  };

  /**
   * Signs a transaction using the specified wallet account.
   *
   * - This function signs a blockchain transaction using the provided wallet address and transaction data.
   * - Supports all Turnkey-supported blockchain networks (e.g., Ethereum, Solana, Tron).
   * - Automatically determines the appropriate signing method based on the transaction type.
   * - Delegates signing to the Turnkey API, which returns the signed transaction and related metadata.
   * - Optionally allows stamping the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   *
   * @param params.walletAccount - wallet account to use for signing the transaction.
   * @param params.unsignedTransaction - unsigned transaction data (serialized as a string) to be signed.
   * @param params.transactionType - type of transaction (e.g., "TRANSACTION_TYPE_ETHEREUM", "TRANSACTION_TYPE_SOLANA", "TRANSACTION_TYPE_TRON").
   * @param params.stampWith - parameter to stamp the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   * @returns A promise that resolves to a `TSignTransactionResponse` object containing the signed transaction and any additional signing metadata.
   * @throws {TurnkeyError} If there is an error signing the transaction or if the response is invalid.
   */
  signTransaction = async (params: {
    unsignedTransaction: string;
    transactionType: v1TransactionType;
    walletAccount: WalletAccount;
    stampWith?: StamperType | undefined;
  }): Promise<string> => {
    const { walletAccount, unsignedTransaction, transactionType, stampWith } =
      params;

    return withTurnkeyErrorHandling(
      async () => {
        if (walletAccount.source === WalletSource.Connected) {
          switch (walletAccount.chainInfo.namespace) {
            case Chain.Ethereum:
              throw new TurnkeyError(
                "Ethereum connected wallets do not support raw transaction signing. Use signAndSendTransaction instead.",
                TurnkeyErrorCodes.INVALID_REQUEST
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
                TurnkeyErrorCodes.INVALID_REQUEST
              );
          }
        }

        // this is an embedded wallet account
        const signTransaction = await this.httpClient.signTransaction(
          {
            signWith: walletAccount.address,
            unsignedTransaction,
            type: transactionType,
          },
          stampWith
        );

        return signTransaction.signedTransaction;
      },
      {
        errorMessage: "Failed to sign transaction",
        errorCode: TurnkeyErrorCodes.SIGN_TRANSACTION_ERROR,
      }
    );
  };

  /**
   * Signs and broadcasts a transaction using the specified wallet account.
   *
   * - For **connected wallets**:
   *   - Calls the wallet’s native `signAndSendTransaction` method.
   *   - Does **not** require an `rpcUrl`.
   *
   * - For **embedded wallets**:
   *   - Signs the transaction using the Turnkey API.
   *   - Requires an `rpcUrl` to broadcast the transaction.
   *   - Broadcasts the transaction using a JSON-RPC client.
   *
   * @param params.walletAccount - wallet account to use for signing and sending.
   * @param params.unsignedTransaction - unsigned transaction (serialized string).
   * @param params.transactionType - transaction type (e.g., "TRANSACTION_TYPE_SOLANA").
   * @param params.rpcUrl - required for embedded wallets to broadcast the signed transaction.
   * @param params.stampWith - optional stamper to tag the signing request.
   * @returns A promise that resolves to a transaction signature or hash.
   * @throws {TurnkeyError} If signing or broadcasting fails.
   */
  signAndSendTransaction = async (params: {
    unsignedTransaction: string;
    transactionType: v1TransactionType;
    walletAccount: WalletAccount;
    rpcUrl?: string;
    stampWith?: StamperType | undefined;
  }): Promise<string> => {
    const {
      walletAccount,
      unsignedTransaction,
      transactionType,
      rpcUrl,
      stampWith,
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
                  TurnkeyErrorCodes.SIGN_AND_SEND_TRANSACTION_ERROR
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
                TurnkeyErrorCodes.SIGN_AND_SEND_TRANSACTION_ERROR
              );
          }
        }

        // this is an embedded wallet account

        // embedded wallet requires an RPC URL to broadcast
        // since Turnkey does not broadcast transactions directly
        if (!rpcUrl) {
          throw new TurnkeyError(
            "Missing rpcUrl: embedded wallets require an RPC URL to broadcast transactions.",
            TurnkeyErrorCodes.SIGN_AND_SEND_TRANSACTION_ERROR
          );
        }

        const signTransactionResponse = await this.httpClient.signTransaction(
          {
            signWith: walletAccount.address,
            unsignedTransaction,
            type: transactionType,
          },
          stampWith
        );

        const signedTx = signTransactionResponse.signedTransaction;

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
      }
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
  fetchUser = async (params?: {
    organizationId?: string;
    userId?: string;
    stampWith?: StamperType | undefined;
  }): Promise<v1User> => {
    const { stampWith } = params || {};
    const session = await this.storageManager.getActiveSession();
    if (!session) {
      throw new TurnkeyError(
        "No active session found. Please log in first.",
        TurnkeyErrorCodes.NO_SESSION_FOUND
      );
    }

    const userId = params?.userId || session.userId;
    if (!userId) {
      throw new TurnkeyError(
        "User ID must be provided to fetch user",
        TurnkeyErrorCodes.INVALID_REQUEST
      );
    }

    const organizationId = params?.organizationId || session.organizationId;

    return withTurnkeyErrorHandling(
      async () => {
        const userResponse = await this.httpClient.getUser(
          { organizationId, userId },
          stampWith
        );

        if (!userResponse || !userResponse.user) {
          throw new TurnkeyError(
            "No user found in the response",
            TurnkeyErrorCodes.BAD_RESPONSE
          );
        }

        return userResponse.user as v1User;
      },
      {
        errorMessage: "Failed to fetch user",
        errorCode: TurnkeyErrorCodes.FETCH_USER_ERROR,
      }
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
   * @returns A promise that resolves to the userId of the updated user.
   * @throws {TurnkeyError} If there is no active session, if the userId is missing, or if there is an error updating or verifying the user email.
   */
  updateUserEmail = async (params: {
    email: string;
    verificationToken?: string;
    userId?: string;
    stampWith?: StamperType | undefined;
  }): Promise<string> => {
    const { verificationToken, email, stampWith } = params;
    const session = await this.storageManager.getActiveSession();
    if (!session) {
      throw new TurnkeyError(
        "No active session found. Please log in first.",
        TurnkeyErrorCodes.NO_SESSION_FOUND
      );
    }

    const userId = params?.userId || session.userId;

    return withTurnkeyErrorHandling(
      async () => {
        const existingUser = await this.httpClient.proxyGetAccount({
          filterType: FilterType.Email,
          filterValue: email,
        });

        if (existingUser.organizationId) {
          throw new TurnkeyError(
            `Email ${email} is already associated with another user.`,
            TurnkeyErrorCodes.ACCOUNT_ALREADY_EXISTS
          );
        }

        const res = await this.httpClient.updateUserEmail(
          {
            userId: userId,
            userEmail: email,
            ...(verificationToken && { verificationToken }),
          },
          stampWith
        );

        if (!res || !res.userId) {
          throw new TurnkeyError(
            "No user ID found in the update user email response",
            TurnkeyErrorCodes.BAD_RESPONSE
          );
        }

        return res.userId;
      },
      {
        errorMessage: "Failed to update user email",
        errorCode: TurnkeyErrorCodes.UPDATE_USER_EMAIL_ERROR,
      }
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
   * @returns A promise that resolves to the userId of the user whose email was removed.
   * @throws {TurnkeyError} If there is no active session, if the userId is missing, or if there is an error removing the user email.
   */
  removeUserEmail = async (params?: {
    userId?: string;
    stampWith?: StamperType | undefined;
  }): Promise<string> => {
    const { stampWith } = params || {};
    const session = await this.storageManager.getActiveSession();
    if (!session) {
      throw new TurnkeyError(
        "No active session found. Please log in first.",
        TurnkeyErrorCodes.NO_SESSION_FOUND
      );
    }
    return withTurnkeyErrorHandling(
      async () => {
        const userId = params?.userId || session.userId;
        const res = await this.httpClient.updateUserEmail(
          {
            userId: userId,
            userEmail: "",
          },
          stampWith
        );
        if (!res || !res.userId) {
          throw new TurnkeyError(
            "No user ID found in the remove user email response",
            TurnkeyErrorCodes.BAD_RESPONSE
          );
        }
        return res.userId;
      },
      {
        errorMessage: "Failed to remove user email",
        errorCode: TurnkeyErrorCodes.UPDATE_USER_EMAIL_ERROR,
      }
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
   * @returns A promise that resolves to the userId of the updated user.
   * @throws {TurnkeyError} If there is no active session, if the userId is missing, or if there is an error updating or verifying the user phone number.
   */
  updateUserPhoneNumber = async (params: {
    phoneNumber: string;
    verificationToken?: string;
    userId?: string;
    stampWith?: StamperType | undefined;
  }): Promise<string> => {
    const { verificationToken, phoneNumber, stampWith } = params;
    const session = await this.storageManager.getActiveSession();
    if (!session) {
      throw new TurnkeyError(
        "No active session found. Please log in first.",
        TurnkeyErrorCodes.NO_SESSION_FOUND
      );
    }

    const userId = params?.userId || session.userId;
    return withTurnkeyErrorHandling(
      async () => {
        const res = await this.httpClient.updateUserPhoneNumber(
          {
            userId,
            userPhoneNumber: phoneNumber,
            ...(verificationToken && { verificationToken }),
          },
          stampWith
        );

        if (!res || !res.userId) {
          throw new TurnkeyError(
            "Failed to update user phone number",
            TurnkeyErrorCodes.UPDATE_USER_PHONE_NUMBER_ERROR
          );
        }

        return res.userId;
      },
      {
        errorMessage: "Failed to update user phone number",
        errorCode: TurnkeyErrorCodes.UPDATE_USER_PHONE_NUMBER_ERROR,
      }
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
   * @returns A promise that resolves to the userId of the user whose phone number was removed.
   * @throws {TurnkeyError} If there is no active session, if the userId is missing, or if there is an error removing the user phone number.
   */
  removeUserPhoneNumber = async (params?: {
    userId?: string;
    stampWith?: StamperType | undefined;
  }): Promise<string> => {
    const { stampWith } = params || {};
    const session = await this.storageManager.getActiveSession();
    if (!session) {
      throw new TurnkeyError(
        "No active session found. Please log in first.",
        TurnkeyErrorCodes.NO_SESSION_FOUND
      );
    }
    const userId = params?.userId || session.userId;

    return withTurnkeyErrorHandling(
      async () => {
        const res = await this.httpClient.updateUserPhoneNumber(
          {
            userId,
            userPhoneNumber: "",
          },
          stampWith
        );
        if (!res || !res.userId) {
          throw new TurnkeyError(
            "Failed to remove user phone number",
            TurnkeyErrorCodes.UPDATE_USER_PHONE_NUMBER_ERROR
          );
        }
        return res.userId;
      },
      {
        errorMessage: "Failed to remove user phone number",
        errorCode: TurnkeyErrorCodes.UPDATE_USER_PHONE_NUMBER_ERROR,
      }
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
   * @returns A promise that resolves to the userId of the updated user.
   * @throws {TurnkeyError} If there is no active session, if the userId is missing, or if there is an error updating the user name.
   */
  updateUserName = async (params: {
    userName: string;
    userId?: string;
    stampWith?: StamperType | undefined;
  }): Promise<string> => {
    const { userName, stampWith } = params;
    const session = await this.storageManager.getActiveSession();
    if (!session) {
      throw new TurnkeyError(
        "No active session found. Please log in first.",
        TurnkeyErrorCodes.NO_SESSION_FOUND
      );
    }
    const userId = params?.userId || session.userId;

    return withTurnkeyErrorHandling(
      async () => {
        const res = await this.httpClient.updateUserName(
          {
            userId,
            userName,
          },
          stampWith
        );

        if (!res || !res.userId) {
          throw new TurnkeyError(
            "No user ID found in the update user name response",
            TurnkeyErrorCodes.BAD_RESPONSE
          );
        }

        return res.userId;
      },
      {
        errorMessage: "Failed to update user name",
        errorCode: TurnkeyErrorCodes.UPDATE_USER_NAME_ERROR,
      }
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
   * @param params.userId - user ID to add the provider for a specific user (defaults to current session's userId).
   * @param params.stampWith - parameter to stamp the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   * @returns A promise that resolves to an array of provider IDs associated with the user.
   * @throws {TurnkeyError} If there is no active session, if the account already exists, or if there is an error adding the OAuth provider.
   */
  addOauthProvider = async (params: {
    providerName: string;
    oidcToken: string;
    userId?: string;
    stampWith?: StamperType | undefined;
  }): Promise<string[]> => {
    const { providerName, oidcToken, stampWith } = params;
    const session = await this.storageManager.getActiveSession();
    if (!session) {
      throw new TurnkeyError(
        "No active session found. Please log in first.",
        TurnkeyErrorCodes.NO_SESSION_FOUND
      );
    }

    return withTurnkeyErrorHandling(
      async () => {
        const accountRes = await this.httpClient.proxyGetAccount({
          filterType: "OIDC_TOKEN",
          filterValue: oidcToken,
        });

        if (!accountRes) {
          throw new TurnkeyError(
            `Account fetch failed}`,
            TurnkeyErrorCodes.ACCOUNT_FETCH_ERROR
          );
        }

        if (accountRes.organizationId) {
          throw new TurnkeyError(
            "Account already exists with this OIDC token",
            TurnkeyErrorCodes.ACCOUNT_ALREADY_EXISTS
          );
        }

        const userId = params?.userId || session.userId;
        const { email: oidcEmail, iss } = jwtDecode<any>(oidcToken) || {}; // Parse the oidc token so we can get the email. Pass it in to updateUser then call createOauthProviders. This will be verified by Turnkey.

        if (iss === googleISS) {
          const verifiedSuborg = await this.httpClient.proxyGetAccount({
            filterType: "EMAIL",
            filterValue: oidcEmail,
          });
          const isVerified =
            verifiedSuborg.organizationId === session.organizationId;

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
          stampWith
        );

        if (!createProviderRes) {
          throw new TurnkeyError(
            "Failed to create OAuth provider",
            TurnkeyErrorCodes.ADD_OAUTH_PROVIDER_ERROR
          );
        }

        return createProviderRes?.providerIds || [];
      },
      {
        errorMessage: "Failed to add OAuth provider",
        errorCode: TurnkeyErrorCodes.ADD_OAUTH_PROVIDER_ERROR,
      }
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
   * @returns A promise that resolves to an array of provider IDs that were removed.
   * @throws {TurnkeyError} If there is no active session, if the userId is missing, or if there is an error removing the OAuth provider.
   */
  removeOauthProviders = async (params: {
    providerIds: string[];
    userId?: string;
    stampWith?: StamperType | undefined;
  }): Promise<string[]> => {
    const { providerIds, stampWith } = params;
    const session = await this.storageManager.getActiveSession();
    if (!session) {
      throw new TurnkeyError(
        "No active session found. Please log in first.",
        TurnkeyErrorCodes.NO_SESSION_FOUND
      );
    }
    const userId = params?.userId || session.userId;
    return withTurnkeyErrorHandling(
      async () => {
        const res = await this.httpClient.deleteOauthProviders(
          {
            userId,
            providerIds,
          },
          stampWith
        );
        if (!res) {
          throw new TurnkeyError(
            "Failed to remove OAuth provider",
            TurnkeyErrorCodes.REMOVE_OAUTH_PROVIDER_ERROR
          );
        }
        return res.providerIds;
      },
      {
        errorMessage: "Failed to remove OAuth provider",
        errorCode: TurnkeyErrorCodes.REMOVE_OAUTH_PROVIDER_ERROR,
      }
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
   * @returns A promise that resolves to an array of authenticator IDs for the newly added passkey(s).
   * @throws {TurnkeyError} If there is no active session, if passkey creation fails, or if there is an error adding the passkey.
   */
  addPasskey = async (params?: {
    name?: string;
    displayName?: string;
    userId?: string;
    stampWith?: StamperType | undefined;
  }): Promise<string[]> => {
    const { stampWith } = params || {};
    const name = params?.name || `Turnkey Passkey-${Date.now()}`;
    const displayName = params?.displayName || name;

    return withTurnkeyErrorHandling(
      async () => {
        const session = await this.storageManager.getActiveSession();
        if (!session) {
          throw new TurnkeyError(
            "No active session found. Please log in first.",
            TurnkeyErrorCodes.NO_SESSION_FOUND
          );
        }

        const userId = params?.userId || session.userId;

        const { encodedChallenge, attestation } = await this.createPasskey({
          name,
          displayName,
          ...(stampWith && { stampWith }),
        });

        if (!attestation || !encodedChallenge) {
          throw new TurnkeyError(
            "Failed to create passkey challenge and attestation",
            TurnkeyErrorCodes.CREATE_PASSKEY_ERROR
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
          },
          stampWith
        );

        return res?.authenticatorIds || [];
      },
      {
        errorMessage: "Failed to add passkey",
        errorCode: TurnkeyErrorCodes.ADD_PASSKEY_ERROR,
      }
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
   * @returns A promise that resolves to an array of authenticator IDs that were removed.
   * @throws {TurnkeyError} If there is no active session, if the userId is missing, or if there is an error removing the passkeys.
   */
  removePasskeys = async (params: {
    authenticatorIds: string[];
    userId?: string;
    stampWith?: StamperType | undefined;
  }): Promise<string[]> => {
    const { authenticatorIds, stampWith } = params;
    const session = await this.storageManager.getActiveSession();
    if (!session) {
      throw new TurnkeyError(
        "No active session found. Please log in first.",
        TurnkeyErrorCodes.NO_SESSION_FOUND
      );
    }
    const userId = params?.userId || session.userId;

    return withTurnkeyErrorHandling(
      async () => {
        const res = await this.httpClient.deleteAuthenticators(
          {
            userId,
            authenticatorIds,
          },
          stampWith
        );
        if (!res) {
          throw new TurnkeyError(
            "No response found in the remove passkey response",
            TurnkeyErrorCodes.REMOVE_PASSKEY_ERROR
          );
        }
        return res.authenticatorIds;
      },
      {
        errorMessage: "Failed to remove passkey",
        errorCode: TurnkeyErrorCodes.REMOVE_PASSKEY_ERROR,
      }
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
  createWallet = async (params: {
    walletName: string;
    accounts?: v1WalletAccountParams[] | v1AddressFormat[];
    organizationId?: string;
    mnemonicLength?: number;
    stampWith?: StamperType | undefined;
  }): Promise<string> => {
    const { walletName, accounts, organizationId, mnemonicLength, stampWith } =
      params;
    const session = await this.storageManager.getActiveSession();
    if (!session) {
      throw new TurnkeyError(
        "No active session found. Please log in first.",
        TurnkeyErrorCodes.NO_SESSION_FOUND
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
            organizationId: organizationId || session.organizationId,
            walletName,
            accounts: walletAccounts,
            mnemonicLength: mnemonicLength || 12,
          },
          stampWith
        );

        if (!res || !res.walletId) {
          throw new TurnkeyError(
            "No wallet found in the create wallet response",
            TurnkeyErrorCodes.BAD_RESPONSE
          );
        }
        return res.walletId;
      },
      {
        errorMessage: "Failed to create wallet",
        errorCode: TurnkeyErrorCodes.CREATE_WALLET_ERROR,
      }
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
  createWalletAccounts = async (params: {
    accounts: v1WalletAccountParams[] | v1AddressFormat[];
    walletId: string;
    organizationId?: string;
    stampWith?: StamperType | undefined;
  }): Promise<string[]> => {
    const { accounts, walletId, organizationId, stampWith } = params;
    const session = await this.storageManager.getActiveSession();
    if (!session) {
      throw new TurnkeyError(
        "No active session found. Please log in first.",
        TurnkeyErrorCodes.NO_SESSION_FOUND
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
                organizationId: organizationId || session.organizationId,
                paginationOptions: { limit: "100" },
              },
              stampWith
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
            organizationId: organizationId || session.organizationId,
            walletId,
            accounts: walletAccounts,
          },
          stampWith
        );

        if (!res || !res.addresses) {
          throw new TurnkeyError(
            "No account found in the create wallet account response",
            TurnkeyErrorCodes.BAD_RESPONSE
          );
        }
        return res.addresses;
      },
      {
        errorMessage: "Failed to create wallet account",
        errorCode: TurnkeyErrorCodes.CREATE_WALLET_ACCOUNT_ERROR,
      }
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
  exportWallet = async (params: {
    walletId: string;
    targetPublicKey: string;
    organizationId?: string;
    stampWith?: StamperType | undefined;
  }): Promise<ExportBundle> => {
    const { walletId, targetPublicKey, stampWith, organizationId } = params;
    const session = await this.storageManager.getActiveSession();
    if (!session) {
      throw new TurnkeyError(
        "No active session found. Please log in first.",
        TurnkeyErrorCodes.NO_SESSION_FOUND
      );
    }
    return withTurnkeyErrorHandling(
      async () => {
        const res = await this.httpClient.exportWallet(
          {
            walletId,
            targetPublicKey,
            organizationId: organizationId || session.organizationId,
          },
          stampWith
        );

        if (!res.exportBundle) {
          throw new TurnkeyError(
            "No export bundle found in the response",
            TurnkeyErrorCodes.BAD_RESPONSE
          );
        }
        return res.exportBundle as ExportBundle;
      },
      {
        errorMessage: "Failed to export wallet",
        errorCode: TurnkeyErrorCodes.EXPORT_WALLET_ERROR,
      }
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
  exportPrivateKey = async (params: {
    privateKeyId: string;
    targetPublicKey: string;
    organizationId?: string;
    stampWith?: StamperType | undefined;
  }): Promise<ExportBundle> => {
    const { privateKeyId, targetPublicKey, stampWith, organizationId } = params;
    const session = await this.storageManager.getActiveSession();
    if (!session) {
      throw new TurnkeyError(
        "No active session found. Please log in first.",
        TurnkeyErrorCodes.NO_SESSION_FOUND
      );
    }
    return withTurnkeyErrorHandling(
      async () => {
        const res = await this.httpClient.exportPrivateKey(
          {
            privateKeyId,
            targetPublicKey,
            organizationId: organizationId || session.organizationId,
          },
          stampWith
        );
        if (!res.exportBundle) {
          throw new TurnkeyError(
            "No export bundle found in the response",
            TurnkeyErrorCodes.BAD_RESPONSE
          );
        }
        return res.exportBundle as ExportBundle;
      },
      {
        errorMessage: "Failed to export private key",
        errorCode: TurnkeyErrorCodes.EXPORT_PRIVATE_KEY_ERROR,
      }
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
  exportWalletAccount = async (params: {
    address: string;
    targetPublicKey: string;
    organizationId?: string;
    stampWith?: StamperType | undefined;
  }): Promise<ExportBundle> => {
    const { address, targetPublicKey, stampWith, organizationId } = params;
    const session = await this.storageManager.getActiveSession();
    if (!session) {
      throw new TurnkeyError(
        "No active session found. Please log in first.",
        TurnkeyErrorCodes.NO_SESSION_FOUND
      );
    }
    return withTurnkeyErrorHandling(
      async () => {
        const res = await this.httpClient.exportWalletAccount(
          {
            address,
            targetPublicKey,
            organizationId: organizationId || session.organizationId,
          },
          stampWith
        );
        if (!res.exportBundle) {
          throw new TurnkeyError(
            "No export bundle found in the response",
            TurnkeyErrorCodes.BAD_RESPONSE
          );
        }
        return res.exportBundle as ExportBundle;
      },
      {
        errorMessage: "Failed to export wallet account",
        errorCode: TurnkeyErrorCodes.EXPORT_WALLET_ACCOUNT_ERROR,
      }
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
   * @param params.userId - user ID to import the wallet for a specific user (defaults to the current session's userId).
   * @param params.stampWith - parameter to stamp the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   * @returns A promise that resolves to the ID of the imported wallet.
   * @throws {TurnkeyError} If there is no active session, if the encrypted bundle is invalid, or if there is an error importing the wallet.
   */
  importWallet = async (params: {
    encryptedBundle: string;
    walletName: string;
    accounts?: v1WalletAccountParams[];
    userId?: string;
    stampWith?: StamperType | undefined;
  }): Promise<string> => {
    const { encryptedBundle, accounts, walletName, userId, stampWith } = params;

    const session = await this.storageManager.getActiveSession();
    if (!session) {
      throw new TurnkeyError(
        "No active session found. Please log in first.",
        TurnkeyErrorCodes.NO_SESSION_FOUND
      );
    }

    return withTurnkeyErrorHandling(
      async () => {
        const res = await this.httpClient.importWallet(
          {
            organizationId: session.organizationId,
            userId: userId || session.userId,
            encryptedBundle,
            walletName,
            accounts: accounts || [
              ...DEFAULT_ETHEREUM_ACCOUNTS,
              ...DEFAULT_SOLANA_ACCOUNTS,
            ],
          },
          stampWith
        );

        if (!res || !res.walletId) {
          throw new TurnkeyError(
            "No wallet ID found in the import response",
            TurnkeyErrorCodes.BAD_RESPONSE
          );
        }
        return res.walletId;
      },
      {
        errorMessage: "Failed to import wallet",
        errorCode: TurnkeyErrorCodes.IMPORT_WALLET_ERROR,
        customMessageByMessages: {
          "invalid mnemonic": {
            message: "Invalid mnemonic input",
            code: TurnkeyErrorCodes.BAD_REQUEST,
          },
        },
      }
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
   * @param params.userId - user ID to import the wallet for a specific user (defaults to the current session's userId).
   * @param params.stampWith - parameter to stamp the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   * @returns A promise that resolves to the ID of the imported wallet.
   * @throws {TurnkeyError} If there is no active session, if the encrypted bundle is invalid, or if there is an error importing the wallet.
   */
  importPrivateKey = async (params: {
    encryptedBundle: string;
    privateKeyName: string;
    curve: v1Curve;
    addressFormats: v1AddressFormat[];
    userId?: string;
    stampWith?: StamperType | undefined;
  }): Promise<string> => {
    const {
      encryptedBundle,
      privateKeyName,
      addressFormats,
      curve,
      userId,
      stampWith,
    } = params;

    const session = await this.storageManager.getActiveSession();
    if (!session) {
      throw new TurnkeyError(
        "No active session found. Please log in first.",
        TurnkeyErrorCodes.NO_SESSION_FOUND
      );
    }

    return withTurnkeyErrorHandling(
      async () => {
        const res = await this.httpClient.importPrivateKey(
          {
            organizationId: session.organizationId,
            userId: userId || session.userId,
            encryptedBundle,
            privateKeyName,
            curve,
            addressFormats,
          },
          stampWith
        );

        if (!res || !res.privateKeyId) {
          throw new TurnkeyError(
            "No wallet ID found in the import response",
            TurnkeyErrorCodes.BAD_RESPONSE
          );
        }
        return res.privateKeyId;
      },
      {
        errorMessage: "Failed to import wallet",
        errorCode: TurnkeyErrorCodes.IMPORT_WALLET_ERROR,
        customMessageByMessages: {
          "invalid mnemonic": {
            message: "Invalid mnemonic input",
            code: TurnkeyErrorCodes.BAD_REQUEST,
          },
        },
      }
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
   * @param params.stampWith - parameter to stamp the request with a specific stamper.
   * @returns A promise that resolves to a `TDeleteSubOrganizationResponse` object containing the result of the deletion.
   * @throws {TurnkeyError} If there is no active session or if there is an error deleting the sub-organization.
   */
  deleteSubOrganization = async (params?: {
    deleteWithoutExport?: boolean;
    stampWith?: StamperType | undefined;
  }): Promise<TDeleteSubOrganizationResponse> => {
    const { deleteWithoutExport = false, stampWith } = params || {};
    const session = await this.storageManager.getActiveSession();
    if (!session) {
      throw new TurnkeyError(
        "No active session found. Please log in first.",
        TurnkeyErrorCodes.NO_SESSION_FOUND
      );
    }

    return withTurnkeyErrorHandling(
      async () => {
        return await this.httpClient.deleteSubOrganization(
          { deleteWithoutExport },
          stampWith
        );
      },
      {
        errorMessage: "Failed to delete sub-organization",
        errorCode: TurnkeyErrorCodes.DELETE_SUB_ORGANIZATION_ERROR,
      }
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
  storeSession = async (params: {
    sessionToken: string;
    sessionKey?: string;
  }): Promise<void> => {
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
      }
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
  clearSession = async (params?: { sessionKey?: string }): Promise<void> => {
    const { sessionKey = SessionKey.DefaultSessionkey } = params || {};
    withTurnkeyErrorHandling(
      async () => {
        const session = await this.storageManager.getSession(sessionKey);
        if (session) {
          await this.apiKeyStamper?.deleteKeyPair(session.publicKey!);
          await this.storageManager.clearSession(sessionKey);
        } else {
          throw new TurnkeyError(
            `No session found with key: ${sessionKey}`,
            TurnkeyErrorCodes.NOT_FOUND
          );
        }
      },
      {
        errorMessage: "Failed to delete session",
        errorCode: TurnkeyErrorCodes.CLEAR_SESSION_ERROR,
      }
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
        if (sessionKeys.length === 0) {
          throw new TurnkeyError(
            "No sessions found to clear.",
            TurnkeyErrorCodes.NO_SESSION_FOUND
          );
        }
        for (const sessionKey of sessionKeys) {
          this.clearSession({ sessionKey });
        }
      },
      {
        errorMessage: "Failed to clear all sessions",
        errorCode: TurnkeyErrorCodes.CLEAR_ALL_SESSIONS_ERROR,
      }
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
  refreshSession = async (params?: {
    expirationSeconds?: string;
    publicKey?: string;
    sessionKey?: string;
    invalidateExisitng?: boolean;
    stampWith?: StamperType | undefined;
  }): Promise<TStampLoginResponse | undefined> => {
    const {
      sessionKey = await this.storageManager.getActiveSessionKey(),
      expirationSeconds = DEFAULT_SESSION_EXPIRATION_IN_SECONDS,
      publicKey,
      invalidateExisitng = false,
    } = params || {};
    if (!sessionKey) {
      throw new TurnkeyError(
        "No session key provided or active session to refresh session",
        TurnkeyErrorCodes.NO_SESSION_FOUND
      );
    }
    const session = await this.getSession({
      sessionKey: sessionKey,
    });
    if (!session) {
      throw new TurnkeyError(
        `No active session found: ${sessionKey}`,
        TurnkeyErrorCodes.NO_SESSION_FOUND
      );
    }

    if (!this.httpClient) {
      throw new TurnkeyError(
        "HTTP client is not initialized. Please initialize the client before refreshing the session.",
        TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED
      );
    }

    let keyPair: string | undefined;
    return withTurnkeyErrorHandling(
      async () => {
        keyPair = publicKey ?? (await this.apiKeyStamper?.createKeyPair());
        if (!keyPair) {
          throw new TurnkeyError(
            "Failed to create new key pair.",
            TurnkeyErrorCodes.INTERNAL_ERROR
          );
        }
        const res = await this.httpClient.stampLogin(
          {
            publicKey: keyPair,
            expirationSeconds,
            invalidateExisting: invalidateExisitng,
          },
          params?.stampWith
        );

        if (!res || !res.session) {
          throw new TurnkeyError(
            "No session found in the refresh response",
            TurnkeyErrorCodes.BAD_RESPONSE
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
      }
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
  getSession = async (params?: {
    sessionKey?: string;
  }): Promise<Session | undefined> => {
    return withTurnkeyErrorHandling(
      async () => {
        const { sessionKey = await this.storageManager.getActiveSessionKey() } =
          params || {};
        return this.storageManager.getSession(sessionKey);
      },
      {
        errorMessage: "Failed to get session with key " + params?.sessionKey,
        errorCode: TurnkeyErrorCodes.GET_SESSION_ERROR,
      }
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
      }
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
  setActiveSession = async (params: { sessionKey: string }): Promise<void> => {
    const { sessionKey } = params;
    return withTurnkeyErrorHandling(
      async () => {
        await this.storageManager.setActiveSessionKey(sessionKey);
      },
      {
        errorMessage: "Failed to set active session",
        errorCode: TurnkeyErrorCodes.SET_ACTIVE_SESSION_ERROR,
      }
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
      }
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
                error
              );
            }
          }
        }
      },
      {
        errorMessage: "Failed to clear unused key pairs",
        errorCode: TurnkeyErrorCodes.CLEAR_UNUSED_KEY_PAIRS_ERROR,
      }
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
  createApiKeyPair = async (params?: {
    externalKeyPair?: CryptoKeyPair | { publicKey: string; privateKey: string };
    storeOverride?: boolean;
  }): Promise<string> => {
    return withTurnkeyErrorHandling(
      async () => {
        const externalKeyPair = params?.externalKeyPair;
        const storeOverride = params?.storeOverride ?? false;

        if (!this.apiKeyStamper) {
          throw new TurnkeyError(
            "API Key Stamper is not initialized.",
            TurnkeyErrorCodes.INTERNAL_ERROR
          );
        }
        const publicKey = await this.apiKeyStamper.createKeyPair(
          externalKeyPair ? externalKeyPair : undefined
        );

        if (storeOverride && publicKey) {
          await this.apiKeyStamper.setPublicKeyOverride(publicKey);
        }

        return publicKey;
      },
      {
        errorMessage: "Failed to create API key pair",
        errorCode: TurnkeyErrorCodes.CREATE_API_KEY_PAIR_ERROR,
      }
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
            TurnkeyErrorCodes.GET_PROXY_AUTH_CONFIG_ERROR
          );
        }

        return res;
      },
      {
        errorMessage: "Failed to get auth proxy config",
        errorCode: TurnkeyErrorCodes.GET_PROXY_AUTH_CONFIG_ERROR,
      }
    );
  };
}

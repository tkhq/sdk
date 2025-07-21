import { TurnkeySDKClientBase } from "../__generated__/sdk-client-base";
import {
  TCreateSubOrganizationResponse,
  TDeleteSubOrganizationResponse,
  Session,
  TSignTransactionResponse,
  TStampLoginResponse,
  v1AddressFormat,
  v1Attestation,
  v1AuthenticatorParamsV2,
  v1InitOtpResult,
  v1OauthLoginResult,
  v1OtpLoginResult,
  v1Pagination,
  v1SignRawPayloadResult,
  v1TransactionType,
  v1User,
  v1VerifyOtpResult,
  v1WalletAccount,
  TurnkeyError,
  TurnkeyErrorCodes,
  TurnkeyNetworkError,
  ProxyTGetWalletKitConfigResponse,
  SessionType,
  v1WalletAccountParams,
} from "@turnkey/sdk-types";
import {
  DEFAULT_SESSION_EXPIRATION_IN_SECONDS,
  ExportBundle,
  StamperType,
  User,
  TurnkeySDKClientConfig,
  WalletAccount,
  Provider,
  Wallet,
  OtpType,
  OtpTypeToFilterTypeMap,
  CreateSubOrgParams,
  Chain,
  FilterType,
  EmbeddedWallet,
  WalletSource,
  InjectedWallet,
  Curve,
  TurnkeyRequestError,
} from "@types"; // AHHHH, SDK-TYPES
import {
  buildSignUpBody,
  generateWalletAccountsFromAddressFormat,
  getMessageHashAndEncodingType,
  isReactNative,
  isWalletAccountArray,
  isWeb,
  toExternalTimestamp,
  // otpTypeToFilterMap,
} from "@utils";
import {
  createStorageManager,
  StorageBase,
  SessionKey,
} from "../__storage__/base";
import { CrossPlatformApiKeyStamper } from "../__stampers__/api/base";
import { CrossPlatformPasskeyStamper } from "../__stampers__/passkey/base";
import { CrossPlatformWalletManager } from "../__stampers__/wallet/base";
import {
  DEFAULT_ETHEREUM_ACCOUNTS,
  DEFAULT_SOLANA_ACCOUNTS,
} from "../turnkey-helpers";
import {
  getPublicKeyFromStampHeader,
  WalletProvider,
  WalletType,
} from "@turnkey/wallet-stamper";
import { jwtDecode } from "jwt-decode";

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
    : never]: T[K] extends Function ? T[K] : never;
};

export type TurnkeyClientMethods = PublicMethods<TurnkeyClient>;

export class TurnkeyClient {
  config: TurnkeySDKClientConfig; // Type TBD
  httpClient!: TurnkeySDKClientBase;

  private apiKeyStamper?: CrossPlatformApiKeyStamper | undefined; // TODO (Amir): TEMPORARILY PUBLIC, MAKE PRIVATE LATER
  private passkeyStamper?: CrossPlatformPasskeyStamper | undefined;
  private walletManager?: CrossPlatformWalletManager | undefined;
  private storageManager!: StorageBase;

  constructor(
    config: any,

    // Users can pass in their own stampers, or we will create them. Should we remove this?
    apiKeyStamper?: CrossPlatformApiKeyStamper,
    passkeyStamper?: CrossPlatformPasskeyStamper,
    walletManager?: CrossPlatformWalletManager,
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
        this.config.passkeyConfig,
      );
      await this.passkeyStamper.init();
    }

    if (
      this.config.walletConfig?.ethereum ||
      this.config.walletConfig?.solana
    ) {
      this.walletManager = new CrossPlatformWalletManager(
        this.config.walletConfig,
      );
      await this.walletManager.init();
    }

    if (!this.config.apiBaseUrl)
      this.config.apiBaseUrl = "https://api.turnkey.com";
    if (!this.config.exportIframeUrl)
      this.config.exportIframeUrl = "https://export.turnkey.com";
    if (!this.config.importIframeUrl)
      this.config.importIframeUrl = "https://import.turnkey.com";

    // Initialize the HTTP client with the appropriate stampers
    this.httpClient = new TurnkeySDKClientBase({
      apiKeyStamper: this.apiKeyStamper,
      passkeyStamper: this.passkeyStamper!,
      walletStamper: this.walletManager!.stamper,
      storageManager: this.storageManager,
      ...this.config,
    });
  }

  createPasskey = async (params?: {
    name?: string;
    displayName?: string;
  }): Promise<{ attestation: v1Attestation; encodedChallenge: string }> => {
    try {
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
            TurnkeyErrorCodes.INTERNAL_ERROR,
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
    } catch (error: any) {
      if (error?.message?.includes("timed out or was not allowed")) {
        throw new TurnkeyError(
          "Passkey creation was cancelled by the user.",
          TurnkeyErrorCodes.SELECT_PASSKEY_CANCELLED,
          error,
        );
      } else if (error instanceof TurnkeyError) {
        throw error;
      }
      throw new TurnkeyError(
        `Failed to create passkey`,
        TurnkeyErrorCodes.CREATE_PASSKEY_ERROR,
        error,
      );
    }
  };

  logout = async (params?: { sessionKey?: string }): Promise<void> => {
    try {
      if (params?.sessionKey) {
        const session = await this.storageManager.getSession(params.sessionKey);
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
    } catch (error) {
      if (error instanceof TurnkeyError) throw error;
      throw new TurnkeyError(
        `Failed to log out`,
        TurnkeyErrorCodes.LOGOUT_ERROR,
        error,
      );
    }
  };

  loginWithPasskey = async (params?: {
    publicKey?: string;
    sessionKey?: string;
    expirationSeconds?: string;
  }): Promise<string> => {
    let generatedKeyPair = null;
    try {
      const publicKey =
        params?.publicKey || (await this.apiKeyStamper?.createKeyPair());
      const sessionKey = params?.sessionKey || SessionKey.DefaultSessionkey;

      const expirationSeconds =
        params?.expirationSeconds || DEFAULT_SESSION_EXPIRATION_IN_SECONDS;

      if (!publicKey) {
        throw new TurnkeyError(
          "A publickey could not be found or generated.",
          TurnkeyErrorCodes.INTERNAL_ERROR,
        );
      }
      const sessionResponse = await this.httpClient.stampLogin(
        {
          publicKey,
          organizationId: this.config.organizationId,
          expirationSeconds,
        },
        StamperType.Passkey,
      );

      await this.storeSession({
        sessionToken: sessionResponse.session,
        sessionKey,
      });
      // Key pair was successfully used, set to null to prevent cleanup
      generatedKeyPair = null;

      return sessionResponse.session;
    } catch (error: any) {
      if (error?.message?.includes("timed out or was not allowed"))
        throw new TurnkeyError(
          "Passkey login was cancelled by the user.",
          TurnkeyErrorCodes.SELECT_PASSKEY_CANCELLED,
          error,
        );
      if (error instanceof TurnkeyError) throw error;
      throw new TurnkeyError(
        `Unable to log in with the provided passkey`,
        TurnkeyErrorCodes.PASSKEY_LOGIN_AUTH_ERROR,
        error,
      );
    } finally {
      // Clean up the generated key pair if it wasn't successfully used
      if (generatedKeyPair) {
        try {
          await this.apiKeyStamper?.deleteKeyPair(generatedKeyPair);
        } catch (cleanupError) {
          throw new TurnkeyError(
            `Failed to clean up generated key pair`,
            TurnkeyErrorCodes.KEY_PAIR_CLEANUP_ERROR,
            cleanupError,
          );
        }
      }
    }
  };

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

    let generatedKeyPair = null;
    try {
      generatedKeyPair = await this.apiKeyStamper?.createKeyPair();
      const passkeyName = passkeyDisplayName || `passkey-${Date.now()}`;

      const passkey = await this.createPasskey({
        name: passkeyName,
        displayName: passkeyName,
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
            {
              authenticatorName: passkeyName,
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
          TurnkeyErrorCodes.PASSKEY_SIGNUP_AUTH_ERROR,
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

      generatedKeyPair = null; // Key pair was successfully used, set to null to prevent cleanup

      return sessionResponse.session;
    } catch (error: unknown) {
      if (error instanceof TurnkeyError) throw error;
      throw new TurnkeyError(
        `Failed to sign up with passkey`,
        TurnkeyErrorCodes.PASSKEY_SIGNUP_AUTH_ERROR,
        error,
      );
    } finally {
      // Clean up the generated key pair if it wasn't successfully used
      this.apiKeyStamper?.clearOverridePublicKey();
      if (generatedKeyPair) {
        try {
          await this.apiKeyStamper?.deleteKeyPair(generatedKeyPair);
        } catch (cleanupError) {
          throw new TurnkeyError(
            `Failed to clean up generated key pair`,
            TurnkeyErrorCodes.KEY_PAIR_CLEANUP_ERROR,
            cleanupError,
          );
        }
      }
    }
  };

  getWalletProviders = async (chain?: Chain): Promise<WalletProvider[]> => {
    try {
      if (!this.walletManager) {
        throw new Error("Wallet manager is not initialized");
      }

      return await this.walletManager.getProviders(chain);
    } catch (error) {
      throw new Error(`Unable to get wallet providers: ${error}`);
    }
  };

  connectWalletAccount = async (walletProvider: WalletProvider) => {
    if (!this.walletManager) {
      throw new Error("Wallet manager is not initialized");
    }

    try {
      await this.walletManager.signer.connectWalletAccount(walletProvider);
    } catch (error) {
      throw new Error(`Unable to connect wallet account: ${error}`);
    }
  };

  loginWithWallet = async (params: {
    walletProvider: WalletProvider;
    publicKey?: string;
    sessionKey?: string;
    expirationSeconds?: string;
  }): Promise<string> => {
    if (!this.walletManager) {
      throw new Error("Wallet stamper is not initialized");
    }

    try {
      const publicKey =
        params.publicKey || (await this.apiKeyStamper?.createKeyPair());
      const sessionKey = params.sessionKey || SessionKey.DefaultSessionkey;
      const walletProvider = params.walletProvider;

      const expirationSeconds =
        params?.expirationSeconds || DEFAULT_SESSION_EXPIRATION_IN_SECONDS;

      if (!publicKey) {
        throw new TurnkeyError(
          "A publickey could not be found or generated.",
          TurnkeyErrorCodes.INTERNAL_ERROR,
        );
      }

      this.walletManager.stamper.setProvider(
        walletProvider.type,
        walletProvider.provider,
      );

      const sessionResponse = await this.httpClient.stampLogin(
        {
          publicKey,
          organizationId: this.config.organizationId,
          expirationSeconds,
        },
        StamperType.Wallet,
      );

      await this.storeSession({
        sessionToken: sessionResponse.session,
        sessionKey,
      });

      return sessionResponse.session;
    } catch (error) {
      if (error instanceof TurnkeyError) throw error;
      throw new TurnkeyError(
        `Unable to log in with the provided wallet`,
        TurnkeyErrorCodes.WALLET_LOGIN_AUTH_ERROR,
        error,
      );
    }
  };

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

    if (!this.walletManager) {
      throw new TurnkeyError(
        "Wallet manager is not initialized",
        TurnkeyErrorCodes.INTERNAL_ERROR,
      );
    }

    let generatedKeyPair = null;
    try {
      generatedKeyPair = await this.apiKeyStamper?.createKeyPair();

      this.walletManager.stamper.setProvider(
        walletProvider.type,
        walletProvider.provider,
      );

      const publicKey = await this.walletManager.stamper.getPublicKey(
        walletProvider.type,
        walletProvider.provider,
      );

      if (!publicKey) {
        throw new Error("Failed to get publicKey from wallet");
      }

      const { type } = this.walletManager.stamper.getWalletInterface(
        walletProvider?.type,
      );

      const signUpBody = buildSignUpBody({
        createSubOrgParams: {
          ...createSubOrgParams,
          apiKeys: [
            {
              apiKeyName: `wallet-auth:${publicKey}`,
              publicKey: publicKey,
              curveType:
                type === WalletType.Ethereum
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
          TurnkeyErrorCodes.WALLET_SIGNUP_AUTH_ERROR,
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

      generatedKeyPair = null; // Key pair was successfully used, set to null to prevent cleanup

      return sessionResponse.session;
    } catch (error) {
      throw new Error(`Failed to sign up with wallet: ${error}`);
    } finally {
      // Clean up the generated key pair if it wasn't successfully used
      console.log("Cleaning up generated key pair if any");
      this.apiKeyStamper?.clearOverridePublicKey();
      if (generatedKeyPair) {
        try {
          await this.apiKeyStamper?.deleteKeyPair(generatedKeyPair);
        } catch (cleanupError) {
          throw new Error(
            `Failed to clean up generated key pair: ${cleanupError}`,
          );
        }
      }
    }
  };

  loginOrSignupWithWallet = async (params: {
    walletProvider: WalletProvider;
    createSubOrgParams?: CreateSubOrgParams;
    sessionKey?: string;
    expirationSeconds?: string;
  }): Promise<string> => {
    if (!this.walletManager) {
      throw new Error("Wallet manager is not initialized");
    }

    const createSubOrgParams = params.createSubOrgParams;
    const sessionKey = params.sessionKey || SessionKey.DefaultSessionkey;
    const walletProvider = params.walletProvider;
    const expirationSeconds =
      params.expirationSeconds || DEFAULT_SESSION_EXPIRATION_IN_SECONDS;

    let generatedKeyPair = null;
    try {
      generatedKeyPair = await this.apiKeyStamper?.createKeyPair();

      this.walletManager.stamper.setProvider(
        walletProvider.type,
        walletProvider.provider,
      );

      // here we sign the request with the wallet, but we don't send it to the Turnkey yet
      // this is because we need to check if the subOrg exists first, and create one if it doesn't
      // once we have the subOrg for the publicKey, we then can send the request to the Turnkey
      const signedRequest = await this.httpClient.stampStampLogin(
        {
          publicKey: generatedKeyPair!,
          organizationId: this.config.organizationId,
          expirationSeconds,
        },
        StamperType.Wallet,
      );

      if (!signedRequest) {
        throw new TurnkeyError(
          "Failed to create stamped request for wallet login",
          TurnkeyErrorCodes.BAD_RESPONSE,
        );
      }

      let publicKey: string | undefined;
      switch (walletProvider.type) {
        case WalletType.Ethereum: {
          // for Ethereum, there is no way to get the public key from the wallet address
          // so we derive it from the signed request
          publicKey = getPublicKeyFromStampHeader(
            signedRequest.stamp.stampHeaderValue,
          );

          break;
        }

        case WalletType.Solana: {
          // for Solana, we can get the public key from the wallet address
          // since the wallet address is the public key
          // this doesn't require any action from the user as long as the wallet is connected
          // which it has to be since they just called stampStampLogin()
          publicKey = await this.walletManager.stamper.getPublicKey(
            walletProvider.type,
            walletProvider.provider,
          );
          break;
        }

        default:
          throw new TurnkeyError(
            `Unsupported wallet type: ${walletProvider.type}`,
            TurnkeyErrorCodes.INVALID_REQUEST,
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
          TurnkeyErrorCodes.ACCOUNT_FETCH_ERROR,
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
                curveType:
                  walletProvider.type === WalletType.Ethereum
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
            TurnkeyErrorCodes.WALLET_SIGNUP_AUTH_ERROR,
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
          errorText,
        );
      }

      const sessionResponse = await res.json();
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

      return sessionToken;
    } catch (error) {
      throw new TurnkeyError(
        `Unable to log in or signup with the provided wallet`,
        TurnkeyErrorCodes.WALLET_LOGIN_OR_SIGNUP_ERROR,
        error,
      );
    }
  };

  initOtp = async (params: {
    otpType: OtpType;
    contact: string;
  }): Promise<string> => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.config.authProxyId) {
      headers["X-Proxy-ID"] = this.config.authProxyId;
    }
    try {
      const initOtpRes = await this.httpClient.proxyInitOtp(params);

      if (!initOtpRes || !initOtpRes.otpId) {
        throw new TurnkeyError(
          "Failed to initialize OTP: otpId is missing",
          TurnkeyErrorCodes.INIT_OTP_ERROR,
        );
      }

      return initOtpRes.otpId;
    } catch (error) {
      if (error instanceof TurnkeyNetworkError) {
        if (error.message.includes("Max number of OTPs have been initiated")) {
          throw new TurnkeyError(
            "Max number of OTPs have been initiated",
            TurnkeyErrorCodes.MAX_OTP_INITIATED_ERROR,
          );
        }
      }
      if (error instanceof TurnkeyError) throw error;
      throw new TurnkeyError(
        `Failed to initialize OTP`,
        TurnkeyErrorCodes.INIT_OTP_ERROR,
        error,
      );
    }
  };

  verifyOtp = async (params: {
    otpId: string;
    otpCode: string;
    contact: string;
    otpType: OtpType;
  }): Promise<{ subOrganizationId: string; verificationToken: string }> => {
    const { otpId, otpCode, contact, otpType } = params;

    try {
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
    } catch (error) {
      if (
        error instanceof TurnkeyRequestError &&
        error.message.includes("Invalid OTP code")
      ) {
        throw new TurnkeyError(
          "Invalid OTP code provided",
          TurnkeyErrorCodes.INVALID_OTP_CODE,
          error.message,
        );
      } else if (error instanceof TurnkeyError) throw error;
      throw new TurnkeyError(
        `Failed to verify OTP`,
        TurnkeyErrorCodes.VERIFY_OTP_ERROR,
        error,
      );
    }
  };

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

    try {
      const res = await this.httpClient.proxyOtpLogin({
        verificationToken,
        publicKey: publicKey!,
        invalidateExisting,
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

      return loginRes.session;
    } catch (error) {
      if (error instanceof TurnkeyError) throw error;
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
      throw new TurnkeyError(
        `Failed to log in with OTP`,
        TurnkeyErrorCodes.OTP_LOGIN_ERROR,
        error,
      );
    }
  };

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

    const generatedKeyPair = await this.apiKeyStamper?.createKeyPair();
    try {
      const res = await this.httpClient.proxySignup(signUpBody);

      if (!res) {
        throw new TurnkeyError(
          `Auth proxy OTP sign up failed`,
          TurnkeyErrorCodes.OTP_SIGNUP_ERROR,
        );
      }

      return await this.loginWithOtp({
        verificationToken,
        publicKey: generatedKeyPair!,
        ...(invalidateExisting && { invalidateExisting }),
        ...(sessionKey && { sessionKey }),
      });
    } catch (error) {
      if (error instanceof TurnkeyError) throw error;
      throw new TurnkeyError(
        `Failed to sign up with OTP`,
        TurnkeyErrorCodes.OTP_SIGNUP_ERROR,
        error,
      );
    }
  };

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

    try {
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
    } catch (error) {
      if (error instanceof TurnkeyError) throw error;
      throw new TurnkeyError(
        `Failed to complete OTP process`,
        TurnkeyErrorCodes.OTP_COMPLETION_ERROR,
        error,
      );
    }
  };

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

    try {
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
    } catch (error) {
      if (error instanceof TurnkeyError) throw error;
      throw new TurnkeyError(
        `Failed to handle Google OAuth login`,
        TurnkeyErrorCodes.OAUTH_LOGIN_ERROR,
        error,
      );
    }
  };

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

    if (!publicKey) {
      throw new TurnkeyError(
        "Public key must be provided to log in with OAuth. Please create a key pair first.",
        TurnkeyErrorCodes.MISSING_PARAMS,
      );
    }

    try {
      // const res = await fetch(`${this.config.authProxyUrl}/v1/oauth_login`, {
      //   method: "POST",
      //   headers,
      //   body: JSON.stringify({
      //     oidcToken,
      //     publicKey,
      //     invalidateExisting,
      //   }),
      // });
      const loginRes = await this.httpClient.proxyOAuthLogin({
        oidcToken,
        publicKey,
        invalidateExisting,
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

      return loginRes.session;
    } catch (error) {
      if (error instanceof TurnkeyError) throw error;
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
      throw new TurnkeyError(
        `Failed to log in with oauth`,
        TurnkeyErrorCodes.OAUTH_LOGIN_ERROR,
        error,
      );
    }
  };

  signUpWithOauth = async (params: {
    oidcToken: string;
    publicKey: string;
    providerName: string;
    createSubOrgParams?: CreateSubOrgParams;
    sessionKey?: string;
  }): Promise<string> => {
    const { oidcToken, publicKey, providerName, createSubOrgParams } = params;

    try {
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
          TurnkeyErrorCodes.OAUTH_SIGNUP_ERROR,
        );
      }

      return await this.loginWithOauth({
        oidcToken,
        publicKey: publicKey!,
      });
    } catch (error) {
      if (error instanceof TurnkeyError) throw error;
      throw new TurnkeyError(
        `Failed to sign up with OAuth`,
        TurnkeyErrorCodes.OAUTH_SIGNUP_ERROR,
        error,
      );
    }
  };

  fetchWallets = async (params?: {
    stamperType?: StamperType;
  }): Promise<Wallet[]> => {
    const { stamperType } = params || {};
    const session = await this.storageManager.getActiveSession();

    if (!session) {
      throw new TurnkeyError(
        "No active session found. Please log in first.",
        TurnkeyErrorCodes.NO_SESSION_FOUND,
      );
    }

    try {
      const res = await this.httpClient.getWallets(
        { organizationId: session.organizationId },
        stamperType,
      );

      if (!res || !res.wallets) {
        throw new TurnkeyError(
          "No wallets found in the response",
          TurnkeyErrorCodes.BAD_RESPONSE,
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
            ...(stamperType !== undefined && { stamperType }),
          });

          embeddedWallet.accounts = accounts;
          return embeddedWallet;
        }),
      );

      if (!this.walletManager) return embedded;

      const providers = await this.getWalletProviders();

      const groupedProviders = new Map<string, WalletProvider[]>();
      for (const provider of providers) {
        const walletId =
          provider.info?.name?.toLowerCase().replace(/\s+/g, "-") || "unknown";
        const group = groupedProviders.get(walletId) || [];
        group.push(provider);
        groupedProviders.set(walletId, group);
      }

      const injected: InjectedWallet[] = (
        await Promise.all(
          Array.from(groupedProviders.entries()).map(
            async ([walletId, grouped]) => {
              const timestamp = toExternalTimestamp();

              const wallet: Wallet = {
                source: WalletSource.Injected,
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
                ...(stamperType !== undefined && { stamperType }),
              });

              wallet.accounts = accounts;
              return wallet;
            },
          ),
        )
      ).filter((wallet) => wallet.accounts.length > 0);

      return [...embedded, ...injected];
    } catch (error) {
      if (error instanceof TurnkeyError) throw error;

      throw new TurnkeyError(
        "Failed to fetch wallets",
        TurnkeyErrorCodes.FETCH_WALLETS_ERROR,
        error,
      );
    }
  };

  fetchWalletAccounts = async (params: {
    wallet: Wallet;
    stamperType?: StamperType;
    walletProviders?: WalletProvider[];
    paginationOptions?: v1Pagination;
  }): Promise<v1WalletAccount[]> => {
    const { wallet, stamperType, walletProviders, paginationOptions } = params;
    const session = await this.storageManager.getActiveSession();

    if (!session) {
      throw new TurnkeyError(
        "No active session found. Please log in first.",
        TurnkeyErrorCodes.NO_SESSION_FOUND,
      );
    }

    if (wallet.source === WalletSource.Embedded) {
      const res = await this.httpClient.getWalletAccounts(
        {
          walletId: wallet.walletId,
          organizationId: session.organizationId,
          paginationOptions: paginationOptions || { limit: "100" },
        },
        stamperType,
      );

      if (!res || !res.accounts) {
        throw new TurnkeyError(
          "No wallet accounts found in the response",
          TurnkeyErrorCodes.BAD_RESPONSE,
        );
      }

      return res.accounts;
    }

    const providers = walletProviders ?? (await this.getWalletProviders());
    const matching = providers.filter(
      (p) =>
        p.info?.name?.toLowerCase().replace(/\s+/g, "-") === wallet.walletId &&
        p.connectedAddresses.length > 0,
    );

    if (matching.length === 0) return [];

    const accounts: v1WalletAccount[] = [];

    for (const provider of matching) {
      const timestamp = toExternalTimestamp();

      for (const address of provider.connectedAddresses) {
        const account: WalletAccount = {
          walletAccountId: `${wallet.walletId}-${provider.type}-${address}`,
          organizationId: session.organizationId,
          walletId: wallet.walletId,
          curve:
            provider.type === WalletType.Ethereum
              ? Curve.SECP256K1
              : Curve.ED25519,
          pathFormat: "PATH_FORMAT_BIP32",
          path: "injected",
          addressFormat:
            provider.type === WalletType.Ethereum
              ? "ADDRESS_FORMAT_ETHEREUM"
              : "ADDRESS_FORMAT_SOLANA",
          address,
          createdAt: timestamp,
          updatedAt: timestamp,
          provider,
          ...(provider.type === WalletType.Solana && { publicKey: address }),
        };

        accounts.push(account);
      }
    }

    return accounts;
  };

  signMessage = async (params: {
    message: string;
    wallet: v1WalletAccount;
    stampWith?: StamperType;
  }): Promise<v1SignRawPayloadResult> => {
    const { message, wallet, stampWith } = params;
    if (!wallet) {
      throw new TurnkeyError(
        "A wallet account must be provided for signing",
        TurnkeyErrorCodes.MISSING_PARAMS,
      );
    }

    if (!wallet.address || !wallet.addressFormat) {
      throw new TurnkeyError(
        "Wallet must have an address and addressFormat",
        TurnkeyErrorCodes.INVALID_REQUEST,
      );
    }

    try {
      // Get the proper encoding and hash function for the address format
      const { hashFunction, payloadEncoding, encodedMessage } =
        getMessageHashAndEncodingType(wallet.addressFormat, message);

      const response = await this.httpClient.signRawPayload(
        {
          signWith: wallet.address,
          payload: encodedMessage,
          encoding: payloadEncoding,
          hashFunction,
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
    } catch (error) {
      if (error instanceof TurnkeyError) throw error;
      throw new TurnkeyError(
        `Failed to sign message: ${error}`,
        TurnkeyErrorCodes.SIGN_MESSAGE_ERROR,
        error,
      );
    }
  };

  signTransaction = async (params: {
    signWith: string;
    unsignedTransaction: string;
    type: v1TransactionType;
    stampWith?: StamperType;
  }): Promise<TSignTransactionResponse> => {
    const { signWith, unsignedTransaction, type, stampWith } = params;

    try {
      return await this.httpClient.signTransaction(
        {
          signWith,
          unsignedTransaction,
          type,
        },
        stampWith,
      );
    } catch (error) {
      if (error instanceof TurnkeyError) throw error;
      throw new TurnkeyError(
        `Failed to sign transaction`,
        TurnkeyErrorCodes.SIGN_TRANSACTION_ERROR,
        error,
      );
    }
  };

  fetchUser = async (params?: {
    organizationId?: string;
    userId?: string;
  }): Promise<v1User> => {
    const session = await this.storageManager.getActiveSession();
    if (!session) {
      throw new TurnkeyError(
        "No active session found. Please log in first.",
        TurnkeyErrorCodes.NO_SESSION_FOUND,
      );
    }

    const userId = params?.userId || session.userId;
    if (!userId) {
      throw new TurnkeyError(
        "User ID must be provided to fetch user",
        TurnkeyErrorCodes.INVALID_REQUEST,
      );
    }

    const organizationId = params?.organizationId || session.organizationId;

    try {
      const userResponse = await this.httpClient.getUser(
        { organizationId, userId },
        StamperType.ApiKey,
      );

      if (!userResponse || !userResponse.user) {
        throw new TurnkeyError(
          "No user found in the response",
          TurnkeyErrorCodes.BAD_RESPONSE,
        );
      }

      return userResponse.user as User;
    } catch (error) {
      if (error instanceof TurnkeyError) throw error;
      throw new TurnkeyError(
        `Failed to fetch user`,
        TurnkeyErrorCodes.FETCH_USER_ERROR,
        error,
      );
    }
  };

  updateUserEmail = async (params: {
    email: string;
    verificationToken?: string;
    userId?: string;
  }): Promise<string> => {
    const { verificationToken, email } = params;
    const session = await this.storageManager.getActiveSession();
    if (!session) {
      throw new TurnkeyError(
        "No active session found. Please log in first.",
        TurnkeyErrorCodes.NO_SESSION_FOUND,
      );
    }

    const userId = params?.userId || session.userId;
    try {
      const res = await this.httpClient.updateUserEmail({
        userId: userId,
        userEmail: email,
        ...(verificationToken && { verificationToken }),
      });

      if (!res || !res.userId) {
        throw new TurnkeyError(
          "No user ID found in the update user email response",
          TurnkeyErrorCodes.BAD_RESPONSE,
        );
      }

      return res.userId;
    } catch (error) {
      if (error instanceof TurnkeyError) throw error;
      throw new TurnkeyError(
        `Failed to update user email`,
        TurnkeyErrorCodes.UPDATE_USER_EMAIL_ERROR,
        error,
      );
    }
  };

  removeUserEmail = async (params: { userId?: string }): Promise<string> => {
    const session = await this.storageManager.getActiveSession();
    if (!session) {
      throw new TurnkeyError(
        "No active session found. Please log in first.",
        TurnkeyErrorCodes.NO_SESSION_FOUND,
      );
    }
    const userId = params?.userId || session.userId;
    const res = await this.httpClient.updateUserEmail({
      userId: userId,
      userEmail: "",
    });
    if (!res || !res.userId) {
      throw new TurnkeyError(
        "No user ID found in the remove user email response",
        TurnkeyErrorCodes.BAD_RESPONSE,
      );
    }
    return res.userId;
  };

  updateUserPhoneNumber = async (params: {
    phoneNumber: string;
    verificationToken?: string;
    userId?: string;
  }): Promise<string> => {
    const { verificationToken, phoneNumber } = params;
    const session = await this.storageManager.getActiveSession();
    if (!session) {
      throw new TurnkeyError(
        "No active session found. Please log in first.",
        TurnkeyErrorCodes.NO_SESSION_FOUND,
      );
    }

    const userId = params?.userId || session.userId;
    try {
      const res = await this.httpClient.updateUserPhoneNumber({
        userId,
        userPhoneNumber: phoneNumber,
        ...(verificationToken && { verificationToken }),
      });

      if (!res || !res.userId) {
        throw new TurnkeyError(
          "Failed to update user phone number",
          TurnkeyErrorCodes.UPDATE_USER_PHONE_NUMBER_ERROR,
        );
      }

      return res.userId;
    } catch (error) {
      if (error instanceof TurnkeyError) throw error;
      throw new TurnkeyError(
        `Failed to update user phone number`,
        TurnkeyErrorCodes.UPDATE_USER_PHONE_NUMBER_ERROR,
        error,
      );
    }
  };

  removeUserPhoneNumber = async (params: {
    userId?: string;
  }): Promise<string> => {
    const session = await this.storageManager.getActiveSession();
    if (!session) {
      throw new TurnkeyError(
        "No active session found. Please log in first.",
        TurnkeyErrorCodes.NO_SESSION_FOUND,
      );
    }
    const userId = params?.userId || session.userId;
    const res = await this.httpClient.updateUserPhoneNumber({
      userId,
      userPhoneNumber: "",
    });
    if (!res || !res.userId) {
      throw new TurnkeyError(
        "Failed to remove user phone number",
        TurnkeyErrorCodes.UPDATE_USER_PHONE_NUMBER_ERROR,
      );
    }
    return res.userId;
  };

  updateUserName = async (params: {
    userName: string;
    userId?: string;
  }): Promise<string> => {
    const { userName } = params;
    const session = await this.storageManager.getActiveSession();
    if (!session) {
      throw new TurnkeyError(
        "No active session found. Please log in first.",
        TurnkeyErrorCodes.NO_SESSION_FOUND,
      );
    }
    const userId = params?.userId || session.userId;

    try {
      const res = await this.httpClient.updateUserName({
        userId,
        userName,
      });

      if (!res || !res.userId) {
        throw new TurnkeyError(
          "No user ID found in the update user name response",
          TurnkeyErrorCodes.BAD_RESPONSE,
        );
      }

      return res.userId;
    } catch (error) {
      if (error instanceof TurnkeyError) throw error;
      throw new TurnkeyError(
        `Failed to update user name`,
        TurnkeyErrorCodes.UPDATE_USER_NAME_ERROR,
        error,
      );
    }
  };

  addOAuthProvider = async (params: {
    providerName: string;
    oidcToken: string;
    userId?: string;
  }): Promise<string[]> => {
    const { providerName, oidcToken } = params;
    const session = await this.storageManager.getActiveSession();
    if (!session) {
      throw new TurnkeyError(
        "No active session found. Please log in first.",
        TurnkeyErrorCodes.NO_SESSION_FOUND,
      );
    }

    try {
      const accountRes = await this.httpClient.proxyGetAccount({
        filterType: "OIDC_TOKEN",
        filterValue: oidcToken,
      });

      if (!accountRes) {
        throw new TurnkeyError(
          `Account fetch failed}`,
          TurnkeyErrorCodes.ACCOUNT_FETCH_ERROR,
        );
      }

      if (accountRes.organizationId) {
        throw new TurnkeyError(
          "Account already exists with this OIDC token",
          TurnkeyErrorCodes.ACCOUNT_ALREADY_EXISTS,
        );
      }

      const userId = params?.userId || session.userId;
      const { email: oidcEmail } = jwtDecode<any>(oidcToken) || {}; // Parse the oidc token so we can get the email. Pass it in to updateUser then call createOauthProviders. This will be verified by Turnkey.

      const verifiedSuborgs = await this.httpClient.getVerifiedSubOrgIds({
        filterType: "EMAIL",
        filterValue: oidcEmail,
      });
      const isVerified = verifiedSuborgs.organizationIds.some(
        (orgId) => orgId === session.organizationId,
      );

      const user = await this.fetchUser({
        userId,
      });

      if (!user?.userEmail && !isVerified) {
        await this.updateUserEmail({
          email: oidcEmail,
          userId,
        });
      }

      const createProviderRes = await this.httpClient.createOauthProviders({
        userId,
        oauthProviders: [
          {
            providerName,
            oidcToken,
          },
        ],
      });

      if (!createProviderRes) {
        throw new TurnkeyError(
          "Failed to create OAuth provider",
          TurnkeyErrorCodes.ADD_OAUTH_PROVIDER_ERROR,
        );
      }

      return createProviderRes?.providerIds || [];
    } catch (error) {
      if (error instanceof TurnkeyError) throw error;
      throw new TurnkeyError(
        `Failed to fetch account for OAuth provider`,
        TurnkeyErrorCodes.ACCOUNT_FETCH_ERROR,
        error,
      );
    }
  };

  removeOAuthProvider = async (params: {
    providerId: string;
    userId?: string;
  }): Promise<string[]> => {
    const { providerId } = params;
    const session = await this.storageManager.getActiveSession();
    if (!session) {
      throw new TurnkeyError(
        "No active session found. Please log in first.",
        TurnkeyErrorCodes.NO_SESSION_FOUND,
      );
    }
    const userId = params?.userId || session.userId;
    const res = await this.httpClient.deleteOauthProviders({
      userId,
      providerIds: [providerId],
    });
    if (!res) {
      throw new TurnkeyError(
        "Failed to remove OAuth provider",
        TurnkeyErrorCodes.REMOVE_OAUTH_PROVIDER_ERROR,
      );
    }
    return res.providerIds;
  };

  addPasskey = async (params?: {
    name?: string;
    displayName?: string;
    userId?: string;
  }): Promise<string[]> => {
    const name = params?.name || `Turnkey Passkey-${Date.now()}`;
    const displayName = params?.displayName || name;

    try {
      const session = await this.storageManager.getActiveSession();
      if (!session) {
        throw new TurnkeyError(
          "No active session found. Please log in first.",
          TurnkeyErrorCodes.NO_SESSION_FOUND,
        );
      }

      const userId = params?.userId || session.userId;

      const { encodedChallenge, attestation } = await this.createPasskey({
        name,
        displayName,
      });

      if (!attestation || !encodedChallenge) {
        throw new TurnkeyError(
          "Failed to create passkey challenge and attestation",
          TurnkeyErrorCodes.CREATE_PASSKEY_ERROR,
        );
      }

      const res = await this.httpClient.createAuthenticators({
        userId,
        authenticators: [
          {
            authenticatorName: name,
            challenge: encodedChallenge,
            attestation,
          },
        ],
      });

      return res?.authenticatorIds || [];
    } catch (error) {
      if (error instanceof TurnkeyError) throw error;
      throw new TurnkeyError(
        `Failed to add passkey`,
        TurnkeyErrorCodes.ADD_PASSKEY_ERROR,
        error,
      );
    }
  };

  removePasskey = async (params: {
    authenticatorId: string;
    userId?: string;
  }): Promise<string[]> => {
    const { authenticatorId } = params;
    const session = await this.storageManager.getActiveSession();
    if (!session) {
      throw new TurnkeyError(
        "No active session found. Please log in first.",
        TurnkeyErrorCodes.NO_SESSION_FOUND,
      );
    }
    const userId = params?.userId || session.userId;

    const res = await this.httpClient.deleteAuthenticators({
      userId,
      authenticatorIds: [authenticatorId],
    });
    if (!res) {
      throw new TurnkeyError(
        "Failed to remove passkey",
        TurnkeyErrorCodes.REMOVE_PASSKEY_ERROR,
      );
    }
    return res.authenticatorIds;
  };

  createWallet = async (params: {
    walletName: string;
    accounts?: v1WalletAccountParams[] | v1AddressFormat[];
    organizationId?: string;
    mnemonicLength?: number;
    stampWith?: StamperType;
  }) => {
    const { walletName, accounts, organizationId, mnemonicLength, stampWith } =
      params;
    const session = await this.storageManager.getActiveSession();
    if (!session) {
      throw new TurnkeyError(
        "No active session found. Please log in first.",
        TurnkeyErrorCodes.NO_SESSION_FOUND,
      );
    }

    let walletAccounts: v1WalletAccountParams[] = [];
    if (accounts && !isWalletAccountArray(accounts)) {
      walletAccounts = generateWalletAccountsFromAddressFormat(accounts);
    } else {
      walletAccounts = (accounts as v1WalletAccountParams[]) || [
        ...DEFAULT_ETHEREUM_ACCOUNTS,
        ...DEFAULT_SOLANA_ACCOUNTS,
      ];
    }

    try {
      const res = await this.httpClient.createWallet(
        {
          organizationId: organizationId || session.organizationId,
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
    } catch (error) {
      if (error instanceof TurnkeyError) throw error;
      throw new TurnkeyError(
        `Failed to create wallet`,
        TurnkeyErrorCodes.CREATE_WALLET_ERROR,
        error,
      );
    }
  };

  createWalletAccounts = async (params: {
    accounts: v1WalletAccountParams[];
    walletId: string;
    organizationId?: string;
    stampWith?: StamperType;
  }): Promise<string[]> => {
    const { accounts, walletId, organizationId, stampWith } = params;
    const session = await this.storageManager.getActiveSession();
    if (!session) {
      throw new TurnkeyError(
        "No active session found. Please log in first.",
        TurnkeyErrorCodes.NO_SESSION_FOUND,
      );
    }
    try {
      const res = await this.httpClient.createWalletAccounts(
        {
          organizationId: organizationId || session.organizationId,
          walletId,
          accounts: accounts,
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
    } catch (error) {
      if (error instanceof TurnkeyError) throw error;
      throw new TurnkeyError(
        `Failed to create wallet account`,
        TurnkeyErrorCodes.CREATE_WALLET_ACCOUNT_ERROR,
        error,
      );
    }
  };

  exportWallet = async (params: {
    walletId: string;
    targetPublicKey: string;
    organizationId?: string;
    stamperType?: StamperType;
  }): Promise<ExportBundle> => {
    const { walletId, targetPublicKey, stamperType, organizationId } = params;
    const session = await this.storageManager.getActiveSession();
    if (!session) {
      throw new TurnkeyError(
        "No active session found. Please log in first.",
        TurnkeyErrorCodes.NO_SESSION_FOUND,
      );
    }
    try {
      const res = await this.httpClient.exportWallet(
        {
          walletId,
          targetPublicKey,
          organizationId: organizationId || session.organizationId,
        },
        stamperType,
      );

      if (!res.exportBundle) {
        throw new TurnkeyError(
          "No export bundle found in the response",
          TurnkeyErrorCodes.BAD_RESPONSE,
        );
      }
      return res.exportBundle as ExportBundle;
    } catch (error) {
      if (error instanceof TurnkeyError) throw error;
      throw new TurnkeyError(
        `Failed to export wallet`,
        TurnkeyErrorCodes.EXPORT_WALLET_ERROR,
        error,
      );
    }
  };

  importWallet = async (params: {
    encryptedBundle: string;
    walletName: string;
    accounts?: v1WalletAccountParams[];
    userId?: string;
  }): Promise<string> => {
    const { encryptedBundle, accounts, walletName, userId } = params;

    const session = await this.storageManager.getActiveSession();
    if (!session) {
      throw new TurnkeyError(
        "No active session found. Please log in first.",
        TurnkeyErrorCodes.NO_SESSION_FOUND,
      );
    }

    try {
      const res = await this.httpClient.importWallet({
        organizationId: session.organizationId,
        userId: userId || session.userId,
        encryptedBundle,
        walletName,
        accounts: accounts || [
          ...DEFAULT_ETHEREUM_ACCOUNTS,
          ...DEFAULT_SOLANA_ACCOUNTS,
        ],
      });

      if (!res || !res.walletId) {
        throw new TurnkeyError(
          "No wallet ID found in the import response",
          TurnkeyErrorCodes.BAD_RESPONSE,
        );
      }
      return res.walletId;
    } catch (error) {
      if (error instanceof TurnkeyError) throw error;
      throw new TurnkeyError(
        `Failed to import wallet`,
        TurnkeyErrorCodes.IMPORT_WALLET_ERROR,
        error,
      );
    }
  };

  deleteSubOrganization = async (params?: {
    deleteWithoutExport?: boolean;
    stamperWith?: StamperType;
  }): Promise<TDeleteSubOrganizationResponse> => {
    const { deleteWithoutExport = false, stamperWith } = params || {};
    const session = await this.storageManager.getActiveSession();
    if (!session) {
      throw new TurnkeyError(
        "No active session found. Please log in first.",
        TurnkeyErrorCodes.NO_SESSION_FOUND,
      );
    }

    try {
      return await this.httpClient.deleteSubOrganization(
        { deleteWithoutExport },
        stamperWith,
      );
    } catch (error) {
      if (error instanceof TurnkeyError) throw error;
      throw new TurnkeyError(
        `Failed to delete sub-organization`,
        TurnkeyErrorCodes.DELETE_SUB_ORGANIZATION_ERROR,
        error,
      );
    }
  };

  createSubOrganization = async (params?: {
    oauthProviders?: Provider[];
    userEmail?: string;
    userPhoneNumber?: string;
    userName?: string;
    subOrgName?: string;
    passkey?: v1AuthenticatorParamsV2;
    customAccounts?: v1WalletAccountParams[];
    wallet?: {
      publicKey: string;
      type: Chain;
    };
  }): Promise<TCreateSubOrganizationResponse> => {
    const {
      oauthProviders,
      passkey,
      customAccounts,
      wallet,
      subOrgName,
      userName,
      userEmail,
      userPhoneNumber,
    } = params || {};

    try {
      const response = await this.httpClient.createSubOrganization({
        subOrganizationName: subOrgName || `sub-org-${Date.now()}`,
        rootQuorumThreshold: 1,
        rootUsers: [
          {
            userName: userName ?? userEmail ?? "",
            userEmail: userEmail ?? "",
            ...(userPhoneNumber ? { userPhoneNumber } : {}),
            apiKeys: wallet
              ? [
                  {
                    apiKeyName: `wallet-auth:${wallet.publicKey}`,
                    publicKey: wallet.publicKey,
                    curveType:
                      wallet.type === WalletType.Ethereum
                        ? ("API_KEY_CURVE_SECP256K1" as const)
                        : ("API_KEY_CURVE_ED25519" as const),
                  },
                ]
              : [],
            authenticators: passkey ? [passkey] : [],
            oauthProviders: oauthProviders || [],
          },
        ],
        wallet: {
          walletName: `Wallet 1`,
          accounts: customAccounts ?? [
            ...DEFAULT_ETHEREUM_ACCOUNTS,
            ...DEFAULT_SOLANA_ACCOUNTS,
          ],
        },
      });

      if (!response.subOrganizationId) {
        throw new TurnkeyError(
          "Expected a non-null subOrganizationId in response",
          TurnkeyErrorCodes.BAD_RESPONSE,
        );
      }
      return response as TCreateSubOrganizationResponse;
    } catch (error) {
      if (error instanceof TurnkeyError) throw error;
      throw new TurnkeyError(
        `Failed to create sub-organization`,
        TurnkeyErrorCodes.CREATE_SUB_ORGANIZATION_ERROR,
        error,
      );
    }
  };

  storeSession = async (params: {
    sessionToken: string;
    sessionKey?: string;
  }): Promise<void> => {
    const { sessionToken, sessionKey = SessionKey.DefaultSessionkey } = params;
    try {
      // TODO (Amir): This should be done in a helper or something. It's very strange that we have to delete the key pair here
      const sessionToReplace = await this.storageManager.getSession(sessionKey);
      if (sessionToReplace) {
        await this.apiKeyStamper?.deleteKeyPair(sessionToReplace.publicKey);
      }

      await this.storageManager.storeSession(sessionToken, sessionKey);
    } catch (error) {
      if (error instanceof TurnkeyError) throw error;
      throw new TurnkeyError(
        `Failed to store session`,
        TurnkeyErrorCodes.STORE_SESSION_ERROR,
        error,
      );
    } finally {
      await this.clearUnusedKeyPairs();
    }
  };

  clearSession = async (params?: { sessionKey?: string }): Promise<void> => {
    const { sessionKey = SessionKey.DefaultSessionkey } = params || {};
    try {
      const session = await this.storageManager.getSession(sessionKey);
      if (session) {
        await this.apiKeyStamper?.deleteKeyPair(session.publicKey);
        await this.storageManager.clearSession(sessionKey);
      } else {
        throw new TurnkeyError(
          `No session found with key: ${sessionKey}`,
          TurnkeyErrorCodes.NOT_FOUND,
        );
      }
    } catch (error) {
      if (error instanceof TurnkeyError) throw error;
      throw new TurnkeyError(
        `Failed to delete session`,
        TurnkeyErrorCodes.CLEAR_SESSION_ERROR,
        error,
      );
    }
  };

  clearAllSessions = async (): Promise<void> => {
    try {
      const sessionKeys = await this.storageManager.listSessionKeys();
      if (sessionKeys.length === 0) {
        throw new TurnkeyError(
          "No sessions found to clear.",
          TurnkeyErrorCodes.NO_SESSION_FOUND,
        );
      }
      for (const sessionKey of sessionKeys) {
        this.clearSession({ sessionKey });
      }
    } catch (error) {
      if (error instanceof TurnkeyError) throw error;
      throw new TurnkeyError(
        `Failed to clear all sessions`,
        TurnkeyErrorCodes.CLEAR_ALL_SESSIONS_ERROR,
        error,
      );
    }
  };

  refreshSession = async (params?: {
    expirationSeconds?: string;
    publicKey?: string;
    sessionKey?: string;
    invalidateExisitng?: boolean;
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

    try {
      const keyPair = publicKey ?? (await this.apiKeyStamper?.createKeyPair());
      if (!keyPair) {
        throw new TurnkeyError(
          "Failed to create new key pair.",
          TurnkeyErrorCodes.INTERNAL_ERROR,
        );
      }
      const res = await this.httpClient.stampLogin({
        publicKey: keyPair!,
        expirationSeconds,
        invalidateExisting: invalidateExisitng,
      });
      await this.storeSession({
        sessionToken: res.session,
        ...(sessionKey && { sessionKey }),
      });
      return res;
    } catch (error) {
      if (error instanceof TurnkeyError) throw error;
      throw new TurnkeyError(
        `Failed to refresh session`,
        TurnkeyErrorCodes.REFRESH_SESSION_ERROR,
        error,
      );
    }
  };

  getSession = async (params?: {
    sessionKey?: string;
  }): Promise<Session | undefined> => {
    try {
      const { sessionKey = await this.storageManager.getActiveSessionKey() } =
        params || {};
      return this.storageManager.getSession(sessionKey);
    } catch (error) {
      if (error instanceof TurnkeyError) throw error;
      throw new TurnkeyError(
        `Failed to get session with key`,
        TurnkeyErrorCodes.GET_SESSION_ERROR,
        error,
      );
    }
  };

  getAllSessions = async (): Promise<Record<string, Session> | undefined> => {
    try {
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
      return sessions;
    } catch (error) {
      if (error instanceof TurnkeyError) throw error;
      throw new TurnkeyError(
        `Failed to get all sessions`,
        TurnkeyErrorCodes.GET_ALL_SESSIONS_ERROR,
        error,
      );
    }
  };

  setActiveSession = async (params: { sessionKey: string }): Promise<void> => {
    const { sessionKey } = params;
    try {
      await this.storageManager.setActiveSessionKey(sessionKey);
    } catch (error) {
      if (error instanceof TurnkeyError) throw error;
      throw new TurnkeyError(
        `Failed to set active session`,
        TurnkeyErrorCodes.SET_ACTIVE_SESSION_ERROR,
        error,
      );
    }
  };

  getActiveSessionKey = async (): Promise<string | undefined> => {
    try {
      return await this.storageManager.getActiveSessionKey();
    } catch (error) {
      if (error instanceof TurnkeyError) throw error;
      throw new TurnkeyError(
        `Failed to get active session key`,
        TurnkeyErrorCodes.GET_ACTIVE_SESSION_KEY_ERROR,
        error,
      );
    }
  };

  clearUnusedKeyPairs = async (): Promise<void> => {
    try {
      const publicKeys = await this.apiKeyStamper?.listKeyPairs();
      if (!publicKeys || publicKeys.length === 0) {
        return;
      }
      const sessionKeys = await this.storageManager?.listSessionKeys();

      const sessionTokensMap: Record<string, string> = {};
      for (const sessionKey of sessionKeys) {
        const session = await this.storageManager.getSession(sessionKey);
        if (session) {
          sessionTokensMap[session.publicKey] = sessionKey;
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
    } catch (error) {
      if (error instanceof TurnkeyError) throw error;
      throw new TurnkeyError(
        `Failed to clear unused key pairs`,
        TurnkeyErrorCodes.CLEAR_UNUSED_KEY_PAIRS_ERROR,
        error,
      );
    }
  };

  createApiKeyPair = async (params?: {
    externalKeyPair?: CryptoKeyPair | { publicKey: string; privateKey: string };
    storeOverride?: boolean;
  }): Promise<string> => {
    if (!this.apiKeyStamper) {
      throw new TurnkeyError(
        "API Key Stamper is not initialized.",
        TurnkeyErrorCodes.INTERNAL_ERROR,
      );
    }
    const externalKeyPair = params?.externalKeyPair;
    const storeOverride = params?.storeOverride ?? false;

    try {
      const publicKey = await this.apiKeyStamper.createKeyPair(
        externalKeyPair ? externalKeyPair : undefined,
      );

      if (storeOverride && publicKey) {
        await this.apiKeyStamper.setPublicKeyOverride(publicKey);
      }

      return publicKey;
    } catch (error) {
      if (error instanceof TurnkeyError) throw error;
      throw new TurnkeyError(
        `Failed to create API key pair`,
        TurnkeyErrorCodes.CREATE_API_KEY_PAIR_ERROR,
        error,
      );
    }
  };

  getProxyAuthConfig = async (): Promise<ProxyTGetWalletKitConfigResponse> => {
    try {
      const res = await this.httpClient.proxyGetWalletKitConfig({});

      if (!res) {
        throw new TurnkeyError(
          `Failed to fetch auth proxy config`,
          TurnkeyErrorCodes.GET_PROXY_AUTH_CONFIG_ERROR,
        );
      }

      return res;
    } catch (error) {
      if (error instanceof TurnkeyError) throw error;
      throw new TurnkeyError(
        `Failed to get auth proxy config`,
        TurnkeyErrorCodes.GET_PROXY_AUTH_CONFIG_ERROR,
        error,
      );
    }
  };
}

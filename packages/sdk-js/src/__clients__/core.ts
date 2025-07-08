import { TurnkeySDKClientBase } from "../__generated__/sdk-client-base";
import {
  TCreateSubOrganizationResponse,
  TDeleteSubOrganizationResponse,
  TGetWalletAccountsResponse,
  Session,
  SessionType,
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
  v1GetWalletKitConfigResponse,
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
} from "@types"; // AHHHH, SDK-TYPES
import {
  generateWalletAccountsFromAddressFormat,
  getMessageHashAndEncodingType,
  isReactNative,
  isWalletAccountArray,
  isWeb,
  // otpTypeToFilterMap,
} from "@utils";
import {
  createStorageManager,
  StorageBase,
  SessionKey,
} from "../__storage__/base";
import { CrossPlatformApiKeyStamper } from "../__stampers__/api/base";
import { CrossPlatformPasskeyStamper } from "../__stampers__/passkey/base";
import { CrossPlatformWalletStamper } from "../__stampers__/wallet/base";
import {
  DEFAULT_ETHEREUM_ACCOUNTS,
  DEFAULT_SOLANA_ACCOUNTS,
} from "../turnkey-helpers";
import { WalletProvider, WalletType } from "@turnkey/wallet-stamper";

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

  // public session?: Session | undefined;  // TODO (Amir): Define session type. Or not maybe???
  public user?: User; // TO IMPLEMENT: fetchUser
  public wallets?: Wallet[];

  private apiKeyStamper?: CrossPlatformApiKeyStamper | undefined; // TODO (Amir): TEMPORARILY PUBLIC, MAKE PRIVATE LATER
  private passkeyStamper?: CrossPlatformPasskeyStamper | undefined;
  private walletStamper?: CrossPlatformWalletStamper | undefined;
  private storageManager!: StorageBase;

  constructor(
    config: any,

    // Users can pass in their own stampers, or we will create them. Should we remove this?
    apiKeyStamper?: CrossPlatformApiKeyStamper,
    passkeyStamper?: CrossPlatformPasskeyStamper,
    walletStamper?: CrossPlatformWalletStamper,
  ) {
    this.config = config;

    // Just store any explicitly provided stampers
    this.apiKeyStamper = apiKeyStamper;
    this.passkeyStamper = passkeyStamper;
    this.walletStamper = walletStamper;

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
      this.walletStamper = new CrossPlatformWalletStamper(
        this.config.walletConfig,
      );
      await this.walletStamper.init();
    }

    // Initialize the HTTP client with the appropriate stampers
    this.httpClient = new TurnkeySDKClientBase({
      apiKeyStamper: this.apiKeyStamper,
      passkeyStamper: this.passkeyStamper!,
      walletStamper: this.walletStamper!,
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
    sessionType?: SessionType;
    publicKey?: string;
    sessionKey?: string;
    expirationSeconds?: string;
  }): Promise<string> => {
    let generatedKeyPair = null;
    try {
      const sessionType = params?.sessionType || SessionType.READ_WRITE;
      const publicKey =
        params?.publicKey || (await this.apiKeyStamper?.createKeyPair());
      const sessionKey = params?.sessionKey || SessionKey.DefaultSessionkey;

      const expirationSeconds =
        params?.expirationSeconds || DEFAULT_SESSION_EXPIRATION_IN_SECONDS;

      // Create a read-only session
      if (sessionType === SessionType.READ_ONLY) {
        const readOnlySessionResult =
          await this.httpClient.createReadOnlySession({}, StamperType.Passkey);

        await this.storeSession({
          sessionToken: readOnlySessionResult.session,
          sessionKey,
        });
        // Key pair was successfully used, set to null to prevent cleanup
        generatedKeyPair = null;

        // Create a read-write session
        return readOnlySessionResult.session;
      } else if (sessionType === SessionType.READ_WRITE) {
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
      } else {
        throw new TurnkeyError(
          `Invalid session type passed: ${sessionType}`,
          TurnkeyErrorCodes.INVALID_REQUEST,
        );
      }
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
    sessionType?: SessionType;
    sessionKey?: string;
    passkeyDisplayName?: string;
    expirationSeconds?: string;
  }): Promise<string> => {
    const {
      createSubOrgParams,
      passkeyDisplayName,
      sessionType = SessionType.READ_WRITE,
      sessionKey = SessionKey.DefaultSessionkey,
      expirationSeconds = DEFAULT_SESSION_EXPIRATION_IN_SECONDS,
    } = params || {};

    let generatedKeyPair = null;
    try {
      generatedKeyPair = await this.apiKeyStamper?.createKeyPair();
      const passkey = await this.createPasskey({
        ...(passkeyDisplayName && {
          name: passkeyDisplayName,
          displayName: passkeyDisplayName,
        }),
      });

      if (!passkey) {
        throw new TurnkeyError(
          "Failed to create passkey: encoded challenge or attestation is missing",
          TurnkeyErrorCodes.INTERNAL_ERROR,
        );
      }

      // Build the request body for OTP init
      const signUpBody = {
        userName:
          createSubOrgParams?.userName ||
          createSubOrgParams?.userEmail ||
          `user-${Date.now()}`,
        userEmail: createSubOrgParams?.userEmail,
        authenticators: [
          {
            authenticatorName:
              createSubOrgParams?.passkeyName || "Default Passkey",
            challenge: passkey.encodedChallenge,
            attestation: passkey.attestation,
          },
        ],
        userPhoneNumber: createSubOrgParams?.userPhoneNumber,
        userTag: createSubOrgParams?.userTag,
        subOrgName: createSubOrgParams?.subOrgName || `sub-org-${Date.now()}`,
        apiKeys: [
          {
            apiKeyName: `passkey-auth-${generatedKeyPair}`,
            publicKey: generatedKeyPair,
            curveType: "API_KEY_CURVE_P256",
            expirationSeconds: "60",
          },
        ],
        oauthProviders: createSubOrgParams?.oauthProviders,
        ...(createSubOrgParams?.customWallet && {
          wallet: {
            walletName: createSubOrgParams?.customWallet.walletName,
            accounts: createSubOrgParams?.customWallet.walletAccounts,
          },
        }),
      };

      // Set up headers, including X-Proxy-ID if needed
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (this.config.authProxyId) {
        headers["X-Proxy-ID"] = this.config.authProxyId;
      }

      const res = await fetch(`${this.config.authProxyUrl}/v1/signup`, {
        method: "POST",
        headers,
        body: JSON.stringify(signUpBody),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new TurnkeyNetworkError(
          `Sign up failed`,
          res.status,
          TurnkeyErrorCodes.PASSKEY_SIGNUP_AUTH_ERROR,
          errorText,
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

  getWalletProviders = (chain?: Chain): WalletProvider[] => {
    try {
      if (!this.walletStamper) {
        throw new Error("Wallet stamper is not initialized");
      }

      return this.walletStamper.getProviders(chain);
    } catch (error) {
      throw new Error(`Unable to get wallet providers: ${error}`);
    }
  };

  loginWithWallet = async (params: {
    walletProvider: WalletProvider;
    sessionType?: SessionType;
    publicKey?: string;
    sessionKey?: string;
    expirationSeconds?: string;
  }): Promise<string> => {
    if (!this.walletStamper) {
      throw new Error("Wallet stamper is not initialized");
    }

    try {
      const sessionType = params.sessionType || SessionType.READ_WRITE;
      const publicKey =
        params.publicKey || (await this.apiKeyStamper?.createKeyPair());
      const sessionKey = params.sessionKey || SessionKey.DefaultSessionkey;
      const walletProvider = params.walletProvider;

      const expirationSeconds =
        params?.expirationSeconds || DEFAULT_SESSION_EXPIRATION_IN_SECONDS;

      if (sessionType === SessionType.READ_WRITE) {
        if (!publicKey) {
          throw new Error(
            "You must provide a publicKey to create a wallet read write session.",
          );
        }

        this.walletStamper?.setProvider(
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
      } else {
        throw new Error(`Invalid session type passed: ${sessionType}`);
      }
    } catch (error) {
      throw new Error(`Unable to log in with the provided wallet: ${error}`);
    }
  };

  signUpWithWallet = async (params: {
    walletProvider: WalletProvider;
    createSubOrgParams?: CreateSubOrgParams;
    sessionType?: SessionType;
    sessionKey?: string;
    expirationSeconds?: string;
  }): Promise<string> => {
    const {
      walletProvider,
      createSubOrgParams,
      sessionType = SessionType.READ_WRITE,
      sessionKey = SessionKey.DefaultSessionkey,
      expirationSeconds = DEFAULT_SESSION_EXPIRATION_IN_SECONDS,
    } = params;

    if (!this.walletStamper) {
      throw new Error("Wallet stamper is not initialized");
    }

    let generatedKeyPair = null;
    try {
      generatedKeyPair = await this.apiKeyStamper?.createKeyPair();

      this.walletStamper?.setProvider(
        walletProvider.type,
        walletProvider.provider,
      );

      const publicKey = await this.walletStamper?.getPublicKey(
        walletProvider.type,
        walletProvider.provider,
      );

      if (!publicKey) {
        throw new Error("Failed to get publicKey from wallet");
      }

      const { type } = this.walletStamper!.getWalletInterface(
        walletProvider?.type,
      );

      // Build the request body for OTP init
      const signUpBody = {
        userName:
          createSubOrgParams?.userName ||
          createSubOrgParams?.userEmail ||
          `user-${Date.now()}`,
        userEmail: createSubOrgParams?.userEmail,
        userPhoneNumber: createSubOrgParams?.userPhoneNumber,
        userTag: createSubOrgParams?.userTag,
        subOrgName: createSubOrgParams?.subOrgName || `sub-org-${Date.now()}`,
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
            publicKey: generatedKeyPair,
            curveType: "API_KEY_CURVE_P256",
            expirationSeconds: "60",
          },
        ],
        oauthProviders: createSubOrgParams?.oauthProviders,
        ...(createSubOrgParams?.customWallet && {
          wallet: {
            walletName: createSubOrgParams?.customWallet.walletName,
            accounts: createSubOrgParams?.customWallet.walletAccounts,
          },
        }),
      };

      // Set up headers, including X-Proxy-ID if needed
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (this.config.authProxyId) {
        headers["X-Proxy-ID"] = this.config.authProxyId;
      }

      const res = await fetch(`${this.config.authProxyUrl}/v1/signup`, {
        method: "POST",
        headers,
        body: JSON.stringify(signUpBody),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Sign up failed: ${res.status} ${errorText}`);
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
      const otpRes = await fetch(`${this.config.authProxyUrl}/v1/otp_init`, {
        method: "POST",
        headers,
        body: JSON.stringify(params),
      });

      if (!otpRes.ok) {
        const errorText = await otpRes.text();
        if (errorText.includes("Max number of OTPs have been initiated")) {
          throw new TurnkeyNetworkError(
            "Max number of OTPs have been initiated",
            otpRes.status,
            TurnkeyErrorCodes.MAX_OTP_INITIATED_ERROR,
            errorText,
          );
        }
        throw new TurnkeyNetworkError(
          `OTP initialization failed`,
          otpRes.status,
          TurnkeyErrorCodes.INIT_OTP_ERROR,
          errorText,
        );
      }
      const initOtpRes: v1InitOtpResult = await otpRes.json();

      return initOtpRes.otpId;
    } catch (error) {
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

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.config.authProxyId) {
      headers["X-Proxy-ID"] = this.config.authProxyId;
    }
    try {
      const url = new URL(`${this.config.authProxyUrl}/v1/account`);
      url.searchParams.append("filterType", OtpTypeToFilterTypeMap[otpType]);
      url.searchParams.append("filterValue", contact);

      const accountRes = await fetch(url.toString(), {
        method: "GET",
        headers,
      });

      if (!accountRes.ok && accountRes.status !== 404) {
        throw new TurnkeyNetworkError(
          `Account fetch failed`,
          accountRes.status,
          TurnkeyErrorCodes.ACCOUNT_FETCH_ERROR,
          await accountRes.text(),
        );
      }

      const verifyRes = await fetch(
        `${this.config.authProxyUrl}/v1/otp_verify`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            otpId: otpId,
            otpCode: otpCode,
          }),
        },
      );
      if (!verifyRes.ok) {
        const error = await verifyRes.text();
        console.log(error);
        if (error.includes("Invalid OTP code")) {
          throw new TurnkeyNetworkError(
            "Invalid OTP code provided",
            verifyRes.status,
            TurnkeyErrorCodes.INVALID_OTP_CODE,
            error,
          );
        } else {
          throw new TurnkeyNetworkError(
            `OTP verification failed`,
            verifyRes.status,
            TurnkeyErrorCodes.VERIFY_OTP_ERROR,
            error,
          );
        }
      }
      const verifyOtpRes: v1VerifyOtpResult = await verifyRes.json();

      let subOrganizationId: string | undefined = undefined;
      const accountText = (await accountRes.text()).trim();
      if (accountText != "account not found") {
        const res = await JSON.parse(accountText);
        subOrganizationId = res.organizationId;
      }

      return {
        subOrganizationId: subOrganizationId || "",
        verificationToken: verifyOtpRes.verificationToken,
      };
    } catch (error) {
      if (error instanceof TurnkeyError) throw error;
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
    sessionType?: SessionType;
    sessionKey?: string;
  }): Promise<string> => {
    const {
      verificationToken,
      invalidateExisting = false,
      publicKey = await this.apiKeyStamper?.createKeyPair(),
      sessionKey = SessionKey.DefaultSessionkey,
      sessionType = SessionType.READ_WRITE,
    } = params;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.config.authProxyId) {
      headers["X-Proxy-ID"] = this.config.authProxyId;
    }

    try {
      const res = await fetch(`${this.config.authProxyUrl}/v1/otp_login`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          verificationToken,
          publicKey,
          invalidateExisting,
        }),
      });

      if (!res.ok) {
        throw new TurnkeyNetworkError(
          `Auth proxy OTP login failed`,
          res.status,
          TurnkeyErrorCodes.OTP_LOGIN_ERROR,
          await res.text(),
        );
      }

      const loginRes: v1OtpLoginResult = await res.json();
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
    sessionType?: SessionType;
    sessionKey?: string;
  }): Promise<string> => {
    const {
      verificationToken,
      contact,
      otpType,
      createSubOrgParams,
      invalidateExisting,
      sessionType,
      sessionKey,
    } = params;

    const signUpBody = {
      userName:
        createSubOrgParams?.userName ||
        createSubOrgParams?.userEmail ||
        `user-${Date.now()}`,
      ...(otpType === OtpType.Email
        ? { userEmail: contact }
        : { userPhoneNumber: contact }),
      userTag: createSubOrgParams?.userTag,
      subOrgName: createSubOrgParams?.subOrgName || `sub-org-${Date.now()}`,
      verificationToken,
      oauthProviders: createSubOrgParams?.oauthProviders,
    };

    // Set up headers, including X-Proxy-ID if needed
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.config.authProxyId) {
      headers["X-Proxy-ID"] = this.config.authProxyId;
    }
    const generatedKeyPair = await this.apiKeyStamper?.createKeyPair();
    try {
      const res = await fetch(`${this.config.authProxyUrl}/v1/signup`, {
        method: "POST",
        headers,
        body: JSON.stringify(signUpBody),
      });

      if (!res.ok) {
        throw new TurnkeyNetworkError(
          `Auth proxy OTP sign up failed`,
          res.status,
          TurnkeyErrorCodes.OTP_SIGNUP_ERROR,
          await res.text(),
        );
      }

      return await this.loginWithOtp({
        verificationToken,
        publicKey: generatedKeyPair!,
        ...(invalidateExisting && { invalidateExisting }),
        ...(sessionType && { sessionType }),
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
    sessionType?: SessionType;
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
      sessionType,
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
          ...(sessionType && { sessionType }),
          ...(sessionKey && { sessionKey }),
        });
      } else {
        return await this.loginWithOtp({
          verificationToken,
          ...(publicKey && { publicKey }),
          ...(invalidateExisting && { invalidateExisting }),
          ...(sessionType && { sessionType }),
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

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.config.authProxyId) {
      headers["X-Proxy-ID"] = this.config.authProxyId;
    }
    try {
      const url = new URL(`${this.config.authProxyUrl}/v1/account`);
      url.searchParams.append("filterType", "OIDC_TOKEN");
      url.searchParams.append("filterValue", oidcToken);

      const accountRes = await fetch(url.toString(), {
        method: "GET",
        headers,
      });

      if (!accountRes.ok && accountRes.status !== 404) {
        const error = await accountRes.text();
        throw new Error(`Account fetch failed: ${accountRes.status} ${error}`);
      }

      let subOrganizationId: string | undefined = undefined;
      const accountText = (await accountRes.text()).trim();
      if (accountText != "account not found") {
        const res = await JSON.parse(accountText);
        subOrganizationId = res.organizationId;
      }

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

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.config.authProxyId) {
      headers["X-Proxy-ID"] = this.config.authProxyId;
    }

    if (!publicKey) {
      throw new TurnkeyError(
        "Public key must be provided to log in with OAuth. Please create a key pair first.",
        TurnkeyErrorCodes.MISSING_PARAMS,
      );
    }

    try {
      const res = await fetch(`${this.config.authProxyUrl}/v1/oauth_login`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          oidcToken,
          publicKey,
          invalidateExisting,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new TurnkeyNetworkError(
          `Auth proxy OAuth login failed`,
          res.status,
          TurnkeyErrorCodes.OAUTH_LOGIN_ERROR,
          errorText,
        );
      }

      const loginRes: v1OauthLoginResult = await res.json();
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
    sessionType?: SessionType;
    sessionKey?: string;
  }): Promise<string> => {
    const { oidcToken, publicKey, providerName, createSubOrgParams } = params;

    try {
      const signUpBody = {
        userName:
          createSubOrgParams?.userName ||
          createSubOrgParams?.userEmail ||
          `user-${Date.now()}`,
        userTag: createSubOrgParams?.userTag,
        subOrgName: createSubOrgParams?.subOrgName || `sub-org-${Date.now()}`,
        oauthProviders: [
          {
            providerName: providerName,
            oidcToken,
          },
          ...(createSubOrgParams?.oauthProviders || []),
        ],
      };

      // Set up headers, including X-Proxy-ID if needed
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (this.config.authProxyId) {
        headers["X-Proxy-ID"] = this.config.authProxyId;
      }

      const res = await fetch(`${this.config.authProxyUrl}/v1/signup`, {
        method: "POST",
        headers,
        body: JSON.stringify(signUpBody),
      });

      if (!res.ok) {
        throw new TurnkeyNetworkError(
          `Auth proxy OAuth signup failed`,
          res.status,
          TurnkeyErrorCodes.OAUTH_SIGNUP_ERROR,
          await res.text(),
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
    saveInClient?: boolean;
  }): Promise<Wallet[]> => {
    const { stamperType, saveInClient = true } = params || {};
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

      const wallets: Wallet[] = res.wallets;
      let i = 0;
      for (const wallet of wallets) {
        const walletAccounts = await this.fetchWalletAccounts({
          walletId: wallet.walletId,
        });

        if (walletAccounts.accounts.length > 0) {
          wallets[i]!.accounts = walletAccounts.accounts;
        }

        i++;
      }

      if (saveInClient) {
        this.wallets = wallets;
      }
      return wallets;
    } catch (error) {
      if (error instanceof TurnkeyError) throw error;
      throw new TurnkeyError(
        `Failed to fetch wallets`,
        TurnkeyErrorCodes.FETCH_WALLETS_ERROR,
        error,
      );
    }
  };

  fetchWalletAccounts = async (params: {
    walletId: string;
    stamperType?: StamperType;
    paginationOptions?: v1Pagination;
  }): Promise<TGetWalletAccountsResponse> => {
    const { walletId, stamperType, paginationOptions } = params;
    const session = await this.storageManager.getActiveSession();
    if (!session) {
      throw new TurnkeyError(
        "No active session found. Please log in first.",
        TurnkeyErrorCodes.NO_SESSION_FOUND,
      );
    }

    try {
      const walletAccountRes = await this.httpClient.getWalletAccounts(
        {
          walletId,
          organizationId: session.organizationId,
          paginationOptions: paginationOptions || { limit: "100" },
        },
        stamperType,
      );

      if (!walletAccountRes || !walletAccountRes.accounts) {
        throw new TurnkeyError(
          "No wallet accounts found in the response",
          TurnkeyErrorCodes.BAD_RESPONSE,
        );
      }

      return walletAccountRes as TGetWalletAccountsResponse;
    } catch (error) {
      if (error instanceof TurnkeyError) throw error;
      throw new TurnkeyError(
        `Failed to fetch wallet accounts`,
        TurnkeyErrorCodes.FETCH_WALLET_ACCOUNTS_ERROR,
        error,
      );
    }
  };

  signMessage = async (params: {
    message: string;
    wallet?: v1WalletAccount;
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

  updateUser = async (params: {
    userId?: string;
    userName?: string;
    userEmail?: string;
    userTagIds?: string[];
    userPhoneNumber?: string;
  }): Promise<v1User> => {
    const session = await this.storageManager.getActiveSession();
    if (!session) {
      throw new TurnkeyError(
        "No active session found. Please log in first.",
        TurnkeyErrorCodes.NO_SESSION_FOUND,
      );
    }

    const { userId = session.userId, ...updateFields } = params;
    const organizationId = session.organizationId;

    try {
      const updatedUser = await this.httpClient.updateUser({
        organizationId: organizationId || session.organizationId,
        userId,
        ...updateFields,
      });

      if (!updatedUser || !updatedUser.userId) {
        throw new TurnkeyError(
          "No updated user found in the response",
          TurnkeyErrorCodes.BAD_RESPONSE,
        );
      }

      const user = await this.fetchUser();
      return user;
    } catch (error) {
      if (error instanceof TurnkeyError) throw error;
      throw new TurnkeyError(
        `Failed to update user`,
        TurnkeyErrorCodes.UPDATE_USER_ERROR,
        error,
      );
    }
  };

  createWallet = async (params: {
    walletName: string;
    accounts?: WalletAccount[] | v1AddressFormat[];
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

    let walletAccounts: WalletAccount[] = [];
    if (accounts && !isWalletAccountArray(accounts)) {
      walletAccounts = generateWalletAccountsFromAddressFormat(accounts);
    } else {
      walletAccounts = (accounts as WalletAccount[]) || [
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
    accounts: WalletAccount[];
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
    accounts?: WalletAccount[];
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
    customAccounts?: WalletAccount[];
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
    sessionType?: SessionType;
    expirationSeconds?: string;
    publicKey?: string;
    sessionKey?: string;
    invalidateExisitng?: boolean;
  }): Promise<TStampLoginResponse | undefined> => {
    const {
      sessionKey = await this.storageManager.getActiveSessionKey(),
      expirationSeconds = DEFAULT_SESSION_EXPIRATION_IN_SECONDS,
      publicKey,
      sessionType = SessionType.READ_WRITE,
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
      switch (sessionType) {
        case SessionType.READ_ONLY: {
          // IMPLEMENT
        }
        case SessionType.READ_WRITE: {
          let keyPair = publicKey;

          if (!publicKey) {
            keyPair = await this.apiKeyStamper?.createKeyPair();
          }

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
        }
        default: {
          throw new TurnkeyError(
            "Invalid session type passed. Use SessionType.READ_WRITE or SessionType.READ_ONLY.",
            TurnkeyErrorCodes.INVALID_REQUEST,
          );
        }
      }
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

  getProxyAuthConfig = async (): Promise<v1GetWalletKitConfigResponse> => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.config.authProxyId) {
      headers["X-Proxy-ID"] = this.config.authProxyId;
    }
    try {
      const res = await fetch(
        `${this.config.authProxyUrl}/v1/wallet_kit_config`,
        {
          method: "GET",
          headers,
        },
      );

      if (!res.ok) {
        throw new TurnkeyNetworkError(
          `Failed to fetch auth proxy config`,
          res.status,
          TurnkeyErrorCodes.GET_PROXY_AUTH_CONFIG_ERROR,
          await res.text(),
        );
      }

      return (await res.json()) as v1GetWalletKitConfigResponse;
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

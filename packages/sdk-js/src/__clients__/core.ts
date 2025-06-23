import { TurnkeySDKClientBase } from "../__generated__/sdk-client-base";
import {
  CreateSubOrganizationResponse,
  DeleteSubOrganizationResponse,
  GetWalletAccountsResponse,
  SessionType,
  SignTransactionResponse,
  v1AddressFormat,
  v1Attestation,
  v1AuthenticatorParamsV2,
  v1InitOtpResult,
  v1OtpLoginResult,
  v1Pagination,
  v1SignRawPayloadResult,
  v1TransactionType,
  v1User,
  v1VerifyOtpResult,
  v1WalletAccount,
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
import {
  DEFAULT_ETHEREUM_ACCOUNTS,
  DEFAULT_SOLANA_ACCOUNTS,
} from "../turnkey-helpers";
import { WalletType } from "@turnkey/wallet-stamper";

export class TurnkeyClient {
  config: TurnkeySDKClientConfig; // Type TBD
  httpClient!: TurnkeySDKClientBase;

  // public session?: Session | undefined;  // TODO (Amir): Define session type. Or not maybe???
  public user?: User; // TO IMPLEMENT: fetchUser
  public wallets?: Wallet[];

  apiKeyStamper?: CrossPlatformApiKeyStamper | undefined; // TODO (Amir): TEMPORARILY PUBLIC, MAKE PRIVATE LATER
  private passkeyStamper?: CrossPlatformPasskeyStamper | undefined;
  storageManager!: StorageBase;

  constructor(
    config: any,

    // Users can pass in their own stampers, or we will create them. Should we remove this?
    apiKeyStamper?: CrossPlatformApiKeyStamper,
    passkeyStamper?: CrossPlatformPasskeyStamper
  ) {
    this.config = config;

    // Just store any explicitly provided stampers
    this.apiKeyStamper = apiKeyStamper;
    this.passkeyStamper = passkeyStamper;

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

    // Initialize the HTTP client with the appropriate stampers
    this.httpClient = new TurnkeySDKClientBase({
      apiKeyStamper: this.apiKeyStamper,
      passkeyStamper: this.passkeyStamper!,
      storageManager: this.storageManager,
      ...this.config,
    });
  }

  createPasskey = async (params: {
    name?: string;
    displayName?: string;
  }): Promise<{ attestation: v1Attestation; encodedChallenge: string }> => {
    try {
      const { name = "A Passkey", displayName = "A Passkey" } = params;
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
          throw new Error("Failed to create React Native passkey");
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
          throw new Error("Failed to create React Native passkey");
        }
        passkey = {
          encodedChallenge: res?.challenge,
          attestation: res?.attestation,
        };
      } else {
        throw new Error("Unsupported platform for passkey creation");
      }

      return passkey;
    } catch (error) {
      throw new Error(`Failed to create passkey: ${error}`);
    }
  };

  logout = async (params?: { sessionKey?: string }): Promise<void> => {
    if (params?.sessionKey) {
      const session = await this.storageManager.getSession(params.sessionKey);
      this.storageManager.clearSession(params.sessionKey);
      this.apiKeyStamper?.deleteKeyPair(session?.token!);
    } else {
      const sessionKey = await this.storageManager.getActiveSessionKey();
      const session = await this.storageManager.getActiveSession();
      if (sessionKey) {
        this.storageManager.clearSession(sessionKey);
        this.apiKeyStamper?.deleteKeyPair(session?.token!);
      } else {
        throw new Error("No active session found to log out from.");
      }
    }
  };

  loginWithPasskey = async (params: {
    sessionType?: SessionType;
    expirationSeconds?: string | undefined;
    publicKey?: string;
    sessionKey?: string | undefined;
  }): Promise<void> => {
    let generatedKeyPair = null;
    try {
      generatedKeyPair = await this.apiKeyStamper?.createKeyPair();
      const {
        sessionType = SessionType.READ_WRITE,
        publicKey = generatedKeyPair,
        expirationSeconds = DEFAULT_SESSION_EXPIRATION_IN_SECONDS,
        sessionKey = SessionKey.DefaultSessionkey,
      } = params;

      // Create a read-only session
      if (sessionType === SessionType.READ_ONLY) {
        const readOnlySessionResult =
          await this.httpClient.createReadOnlySession({}, StamperType.Passkey);

        await this.storageManager.storeSession(
          readOnlySessionResult.session,
          sessionKey
        );
        // Key pair was successfully used, set to null to prevent cleanup
        generatedKeyPair = null;

        // Create a read-write session
      } else if (sessionType === SessionType.READ_WRITE) {
        if (!publicKey) {
          throw new Error(
            "You must provide a publicKey to create a passkey read write session."
          );
        }
        const sessionResponse = await this.httpClient.stampLogin(
          {
            publicKey,
            expirationSeconds,
            organizationId: this.config.organizationId,
          },
          StamperType.Passkey
        );

        // TODO (Amir): This should be done in a helper or something. It's very strange that we have to delete the key pair here
        const sessionToReplace =
          await this.storageManager.getSession(sessionKey);
        if (sessionToReplace) {
          await this.apiKeyStamper?.deleteKeyPair(sessionToReplace.token);
        }

        await this.storageManager.storeSession(
          sessionResponse.session,
          sessionKey
        );
        // Key pair was successfully used, set to null to prevent cleanup
        generatedKeyPair = null;
      } else {
        throw new Error(`Invalid session type passed: ${sessionType}`);
      }
    } catch (error) {
      throw new Error(`Unable to log in with the provided passkey: ${error}`);
    } finally {
      // Clean up the generated key pair if it wasn't successfully used
      if (generatedKeyPair) {
        try {
          await this.apiKeyStamper?.deleteKeyPair(generatedKeyPair);
        } catch (cleanupError) {
          throw new Error(
            `Failed to clean up generated key pair: ${cleanupError}`
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
        const error = await otpRes.text();
        throw new Error(`OTP initialization failed: ${otpRes.status} ${error}`);
      }
      const initOtpRes: { initOtpResult: v1InitOtpResult } =
        await otpRes.json();

      return initOtpRes.initOtpResult.otpId;
    } catch (error) {
      throw new Error(`Failed to initialize OTP: ${error}`);
    }
  };

  verifyOtp = async (params: {
    otpId: string;
    otpCode: string;
    contact: string;
    otpType: OtpType;
  }): Promise<{ subOrgs: string[]; verificationToken: string }> => {
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
        const error = await accountRes.text();
        throw new Error(`Account fetch failed: ${accountRes.status} ${error}`);
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
        }
      );
      if (!verifyRes.ok) {
        const error = await verifyRes.text();
        throw new Error(
          `OTP verification failed: ${verifyRes.status} ${error}`
        );
      }
      const verifyOtpRes: { verifyOtpResult: v1VerifyOtpResult } =
        await verifyRes.json();
      const accountData = await accountRes.text();

      console.log("Account data:", accountData);

      return {
        subOrgs: [],
        verificationToken: verifyOtpRes.verifyOtpResult.verificationToken,
      };
    } catch (error) {
      throw new Error(`Failed to verify OTP: ${error}`);
    }
  };

  loginWithOtp = async (params: {
    verificationToken: string;
    publicKey?: string;
    invalidateExisting?: boolean;
    sessionKey?: string | undefined;
  }): Promise<string> => {
    const {
      verificationToken,
      invalidateExisting = false,
      publicKey = await this.apiKeyStamper?.createKeyPair(),
      sessionKey = SessionKey.DefaultSessionkey
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
        const errorText = await res.text();
        throw new Error(`OTP login failed: ${res.status} ${errorText}`);
      }

      const loginRes: {otpLoginResult: v1OtpLoginResult} = await res.json();
      if (!loginRes.otpLoginResult.session) {
        throw new Error("No session returned from OTP login");
      }

      // // Store the session in the storage manager
      await this.storageManager.storeSession(
        loginRes.otpLoginResult.session,
        sessionKey
      );

      return loginRes.otpLoginResult.session;
    } catch (error) {
      throw new Error(`Failed to log in with OTP: ${error}`);
    }
  };

  signUpWithOtp = async (params: {
    verificationToken: string;
    contact: string;
    otpType: OtpType;
    createSubOrgParams?: CreateSubOrgParams;
    sessionType?: SessionType;
    sessionExpirationSeconds?: string | undefined;
    sessionKey?: string | undefined;
  }): Promise<void> => {
    const { verificationToken, createSubOrgParams, contact, otpType } = params;

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
      wallets: {
        walletName: createSubOrgParams?.customWalletName || `Wallet 1`,
        accounts: createSubOrgParams?.customWalletAccounts || [
          ...DEFAULT_ETHEREUM_ACCOUNTS,
          ...DEFAULT_SOLANA_ACCOUNTS,
        ],
      },
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

    const generatedKeyPair = await this.apiKeyStamper?.createKeyPair();
    await this.loginWithOtp({
      verificationToken,
      publicKey: generatedKeyPair!,
    });
  };

  signUpWithPasskey = async (params: {
    createSubOrgParams?: CreateSubOrgParams;
    sessionType?: SessionType;
    sessionExpirationSeconds?: string | undefined;
    sessionKey?: string | undefined;
    passkeyDisplayName?: string;
  }): Promise<void> => {
    const {
      createSubOrgParams,
      passkeyDisplayName,
      sessionExpirationSeconds,
      sessionKey,
    } = params;

    let generatedKeyPair = null;
    try {
      generatedKeyPair = await this.apiKeyStamper?.createKeyPair();
      const passkey = await this.createPasskey({
        ...(createSubOrgParams?.passkeyName && {
          name: createSubOrgParams?.passkeyName,
        }),
        ...(passkeyDisplayName && { displayName: passkeyDisplayName }),
      });

      if (!passkey) {
        throw new Error(
          "Failed to create passkey: encoded challenge or attestation is missing"
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
            apiKeyName: `passkey-auth:${generatedKeyPair}`,
            publicKey: generatedKeyPair,
            curveType: "API_KEY_CURVE_P256",
            expirationSeconds: "60",
          },
        ],
        oauthProviders: createSubOrgParams?.oauthProviders,
        wallets: {
          walletName: createSubOrgParams?.customWalletName || `Wallet 1`,
          accounts: createSubOrgParams?.customWalletAccounts || [
            ...DEFAULT_ETHEREUM_ACCOUNTS,
            ...DEFAULT_SOLANA_ACCOUNTS,
          ],
        },
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
        ...(sessionExpirationSeconds && {
          expirationSeconds: sessionExpirationSeconds,
        }),
        organizationId: this.config.organizationId,
      });

      await this.apiKeyStamper?.deleteKeyPair(generatedKeyPair!);

      await this.storageManager.storeSession(
        sessionResponse.session,
        sessionKey
      );

      generatedKeyPair = null; // Key pair was successfully used, set to null to prevent cleanup
    } catch (error) {
      throw new Error(`Failed to sign up with passkey: ${error}`);
    } finally {
      // Clean up the generated key pair if it wasn't successfully used
      this.apiKeyStamper?.clearOverridePublicKey();
      if (generatedKeyPair) {
        try {
          await this.apiKeyStamper?.deleteKeyPair(generatedKeyPair);
        } catch (cleanupError) {
          throw new Error(
            `Failed to clean up generated key pair: ${cleanupError}`
          );
        }
      }
    }
  };

  fetchWallets = async (params: {
    stamperType?: StamperType;
    saveInClient?: boolean;
  }): Promise<Wallet[]> => {
    const { stamperType, saveInClient = true } = params;
    const session = await this.storageManager.getActiveSession();
    if (!session) {
      throw new Error("No active session found. Please log in first.");
    }
    try {
      const res = await this.httpClient.getWallets(
        { organizationId: session.organizationId },
        stamperType
      );

      if (!res || !res.wallets) {
        throw new Error("No wallets found in the response");
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
      throw new Error(`Failed to fetch wallets: ${error}`);
    }
  };

  fetchWalletAccounts = async (params: {
    walletId: string;
    stamperType?: StamperType;
    paginationOptions?: v1Pagination;
  }): Promise<GetWalletAccountsResponse> => {
    const { walletId, stamperType, paginationOptions } = params;
    const session = await this.storageManager.getActiveSession();
    if (!session) {
      throw new Error("No active session found. Please log in first.");
    }

    if (!walletId) {
      throw new Error("Wallet ID must be provided to fetch accounts");
    }

    try {
      return await this.httpClient.getWalletAccounts(
        {
          walletId,
          organizationId: session.organizationId,
          paginationOptions: paginationOptions || { limit: "100" },
        },
        stamperType
      );
    } catch (error) {
      throw new Error(`Failed to fetch wallet accounts: ${error}`);
    }
  };

  signMessage = async (params: {
    message: string;
    wallet?: v1WalletAccount;
    stampWith?: StamperType;
  }): Promise<v1SignRawPayloadResult> => {
    const { message, wallet, stampWith } = params;
    if (!wallet) {
      throw new Error("A wallet account must be provided for signing");
    }

    if (!wallet.address || !wallet.addressFormat) {
      throw new Error("Wallet must have an address and addressFormat");
    }

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
      stampWith
    );

    if (response.activity.failure) {
      throw new Error("Failed to sign message, no signed payload returned");
    }

    return response.activity.result
      .signRawPayloadResult as v1SignRawPayloadResult;
  };

  signTransaction = async (params: {
    signWith: string;
    unsignedTransaction: string;
    type: v1TransactionType;
    stampWith?: StamperType;
  }): Promise<SignTransactionResponse> => {
    const { signWith, unsignedTransaction, type, stampWith } = params;

    if (!signWith) {
      throw new Error("A wallet account must be provided for signing");
    }

    if (!unsignedTransaction) {
      throw new Error("An unsigned transaction must be provided for signing");
    }

    try {
      return await this.httpClient.signTransaction(
        {
          signWith,
          unsignedTransaction,
          type,
        },
        stampWith
      );
    } catch (error) {
      throw new Error(`Failed to sign transaction: ${error}`);
    }
  };

  fetchUser = async (params: {
    organizationId?: string;
    userId?: string;
  }): Promise<v1User> => {
    const session = await this.storageManager.getActiveSession();
    if (!session) {
      throw new Error("No active session found. Please log in first.");
    }

    const userId = params.userId || session.userId;
    if (!userId) {
      throw new Error("User ID must be provided to fetch user");
    }

    const organizationId = params.organizationId || session.organizationId;

    try {
      const userResponse = await this.httpClient.getUser(
        { organizationId, userId },
        StamperType.ApiKey
      );

      if (!userResponse || !userResponse.user) {
        throw new Error("No user found in the response");
      }

      return userResponse.user as User;
    } catch (error) {
      throw new Error(`Failed to fetch user: ${error}`);
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
      throw new Error("No active session found. Please log in first.");
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
        stampWith
      );

      if (!res || !res.walletId) {
        throw new Error("No wallet ID found in the create wallet response");
      }
      return res.walletId;
    } catch (error) {
      throw new Error(`Failed to create wallet: ${error}`);
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
      throw new Error("No active session found. Please log in first.");
    }

    if (!walletId) {
      throw new Error("Wallet ID must be provided to create an account");
    }

    try {
      const res = await this.httpClient.createWalletAccounts(
        {
          organizationId: organizationId || session.organizationId,
          walletId,
          accounts: accounts,
        },
        stampWith
      );

      if (!res || !res.addresses) {
        throw new Error(
          "No account found in the create wallet account response"
        );
      }
      return res.addresses;
    } catch (error) {
      throw new Error(`Failed to create wallet account: ${error}`);
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
      throw new Error("No active session found. Please log in first.");
    }

    if (!walletId) {
      throw new Error("Wallet ID must be provided to export wallet");
    }

    try {
      const res = await this.httpClient.exportWallet(
        {
          walletId,
          targetPublicKey,
          organizationId: organizationId || session.organizationId,
        },
        stamperType
      );

      if (!res.exportBundle) {
        throw new Error("No export bundle found in the response");
      }
      return res.exportBundle as ExportBundle;
    } catch (error) {
      throw new Error(`Failed to export wallet: ${error}`);
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
      throw new Error("No active session found. Please log in first.");
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
        throw new Error("No wallet ID found in the import response");
      }
      return res.walletId;
    } catch (error) {
      throw new Error(`Failed to import wallet: ${error}`);
    }
  };

  deleteSubOrganization = async (params: {
    deleteWithoutExport?: boolean;
    stamperWith?: StamperType;
  }): Promise<DeleteSubOrganizationResponse> => {
    const { deleteWithoutExport = false, stamperWith } = params;
    const session = await this.storageManager.getActiveSession();
    if (!session) {
      throw new Error("No active session found. Please log in first.");
    }

    try {
      return await this.httpClient.deleteSubOrganization(
        { deleteWithoutExport },
        stamperWith
      );
    } catch (error) {
      throw new Error(`Failed to delete sub-organization: ${error}`);
    }
  };

  createSubOrganization = async (params: {
    oauthProviders?: Provider[] | undefined;
    userEmail?: string | undefined;
    userPhoneNumber?: string | undefined;
    userName?: string | undefined;
    subOrgName?: string | undefined;
    passkey?: v1AuthenticatorParamsV2 | undefined;
    customAccounts?: WalletAccount[] | undefined;
    wallet?:
      | {
          publicKey: string;
          type: WalletType;
        }
      | undefined;
  }): Promise<CreateSubOrganizationResponse> => {
    const {
      oauthProviders,
      passkey,
      customAccounts,
      wallet,
      subOrgName,
      userName,
      userEmail,
      userPhoneNumber,
    } = params;

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
        throw new Error("Expected a non-null subOrganizationId in response");
      }
      return response as CreateSubOrganizationResponse;
    } catch (error) {
      throw new Error(`Failed to create sub-organization: ${error}`);
    }
  };

  setActiveSession = async (params: { sessionKey: string }): Promise<void> => {
    const { sessionKey } = params;
    await this.storageManager.setActiveSessionKey(sessionKey);
  };
}

// TO IMPLEMENT: fetchUser

import { TurnkeySDKClientBase } from "../__generated__/sdk-client-base";
import {
  GetWalletAccountsResponse,
  GetWalletsResponse,
  SessionType,
  SignRawPayloadIntent,
  SignRawPayloadIntentV2,
  SignRawPayloadRequest,
  SignRawPayloadResult,
  Wallet,
  WalletAccount,
} from "@turnkey/sdk-types";
import {
  LoginWithPasskeyParams,
  DEFAULT_SESSION_EXPIRATION_IN_SECONDS,
  Passkey,
  StamperType,
  CreatePasskeyParams,
  ActivityResponse,
  TWallet,
  TurnkeySDKClientConfig,
} from "@types"; // AHHHH, SDK-TYPES
import {
  base64UrlEncode,
  generateRandomBuffer,
  getMessageHashAndEncodingType,
  isReactNative,
  isWeb,
} from "@utils";
import { getWebAuthnAttestation } from "@turnkey/http";
import {
  createStorageManager,
  StorageBase,
  SessionKey,
} from "../__storage__/base";
import { CrossPlatformApiKeyStamper } from "../__stampers__/api/base";
import { CrossPlatformPasskeyStamper } from "../__stampers__/passkey/base";
import { get } from "http";

export class TurnkeyClient {
  config: TurnkeySDKClientConfig; // Type TBD
  httpClient!: TurnkeySDKClientBase;

  // public session?: Session | undefined;  // TODO (Amir): Define session type. Or not maybe???
  // public user?: any; // TODO (Amir): Define user type
  // public wallets?: any; // TODO (Amir): Define wallets type

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

  createPasskey = async (params: CreatePasskeyParams): Promise<void> => {
    try {
      const { name = "A Passkey", displayName = "A Passkey" } = params;
      if (isWeb()) {
        this.passkeyStamper?.createWebPasskey({
          publicKey: {
            user: {
              name,
              displayName,
            },
          },
        });
      } else if (isReactNative()) {
        this.passkeyStamper?.createReactNativePasskey({
          name,
          displayName,
        });
      }
    } catch (error) {
      throw new Error(`Failed to create passkey: ${error}`);
    }
  };

  loginWithPasskey = async (params: LoginWithPasskeyParams): Promise<void> => {
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

  getWallets = async ({
    stamperType,
  }: {
    stamperType?: StamperType;
  }): Promise<TWallet[]> => {
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

      const wallets: TWallet[] = res.wallets;
      let i = 0;
      for (const wallet of wallets) {
        const walletAccounts = await this.getWalletAccounts({
          walletId: wallet.walletId,
        });

        if (walletAccounts.accounts.length > 0) {
          wallets[i]!.accounts = walletAccounts.accounts;
        }

        i++;
      }

      return wallets;
    } catch (error) {
      throw new Error(`Failed to fetch wallets: ${error}`);
    }
  };

  getWalletAccounts = async ({
    walletId,
    stamperType,
  }: {
    walletId: string;
    stamperType?: StamperType;
  }): Promise<GetWalletAccountsResponse> => {
    const session = await this.storageManager.getActiveSession();
    if (!session) {
      throw new Error("No active session found. Please log in first.");
    }

    if (!walletId) {
      throw new Error("Wallet ID must be provided to fetch accounts");
    }

    try {
      return await this.httpClient.getWalletAccounts(
        { walletId, organizationId: session.organizationId },
        stamperType
      );
    } catch (error) {
      throw new Error(`Failed to fetch wallet accounts: ${error}`);
    }
  };

  signMessage = async ({
    message,
    wallet,
    stampWith,
  }: {
    message: string;
    wallet?: WalletAccount;
    stampWith?: StamperType;
  }): Promise<SignRawPayloadResult> => {
    if (!wallet) {
      throw new Error("A wallet account must be provided for signing");
    }

    if (!wallet.address || !wallet.addressFormat) {
      throw new Error("Wallet must have an address and addressFormat");
    }

    // Get the proper encoding and hash function for the address format
    const { hashFunction, payloadEncoding } = getMessageHashAndEncodingType(
      wallet.addressFormat
    );

    const response = await this.httpClient.signRawPayload(
      {
        signWith: wallet.address,
        payload: message,
        encoding: payloadEncoding,
        hashFunction,
      },
      stampWith
    );

    if (!response.activity.failure) {
      throw new Error("Failed to sign message, no signed payload returned");
    }

    return response.activity.result
      .signRawPayloadResult as SignRawPayloadResult;
  };
}

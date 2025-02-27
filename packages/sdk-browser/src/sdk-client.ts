import { WebauthnStamper } from "@turnkey/webauthn-stamper";
import { IframeStamper, KeyFormat } from "@turnkey/iframe-stamper";
import { getWebAuthnAttestation } from "@turnkey/http";
import { WalletStamper, type WalletInterface } from "@turnkey/wallet-stamper";

import { VERSION } from "./__generated__/version";
import WindowWrapper from "./__polyfills__/window";

import {
  type GrpcStatus,
  type TurnkeySDKClientConfig,
  type TurnkeySDKBrowserConfig,
  type IframeClientParams,
  type TurnkeyWalletClientConfig,
  TurnkeyRequestError,
  AuthClient,
  Stamper,
} from "./__types__/base";

import { TurnkeySDKClientBase } from "./__generated__/sdk-client-base";
import type * as SdkApiTypes from "./__generated__/sdk_api_types";

import type {
  User,
  SubOrganization,
  ReadWriteSession,
  Passkey,
} from "./models";
import {
  StorageKeys,
  getStorageValue,
  removeStorageValue,
  saveSession,
} from "./storage";
import {
  generateRandomBuffer,
  base64UrlEncode,
  createEmbeddedAPIKey,
} from "./utils";

const DEFAULT_SESSION_EXPIRATION = "900"; // default to 15 minutes

interface UpdateUserAuthParams {
  userId: string;
  phoneNumber?: string | null; // string to set, null to delete
  email?: string | null; // string to set, null to delete
  authenticators?: {
    add?: any[]; // Authenticator objects to create
    deleteIds?: string[]; // Authenticator IDs to delete
  };
  oauthProviders?: {
    add?: any[]; // OAuth provider objects to create
    deleteIds?: string[]; // OAuth provider IDs to delete
  };
  apiKeys?: {
    add?: any[]; // API key objects to create
    deleteIds?: string[]; // API key IDs to delete
  };
}
export class TurnkeyBrowserSDK {
  config: TurnkeySDKBrowserConfig;

  protected stamper: Stamper | undefined;

  constructor(config: TurnkeySDKBrowserConfig) {
    this.config = config;
  }

  /**
   * Creates a passkey client. The parameters are overrides passed to the underlying Turnkey `WebauthnStamper`
   * @param rpId Relying Party ID (defaults to window.location.hostname if not provided)
   * @param timeout optional timeout (defaults to 5mins)
   * @param userVerification optional UV flag (defaults to "preferred")
   * @param allowCredentials optional allowCredentials array (defaults to empty array)
   * @returns new TurnkeyPasskeyClient
   */
  passkeyClient = (
    rpId?: string,
    timeout?: number,
    userVerification?: UserVerificationRequirement,
    allowCredentials?: PublicKeyCredentialDescriptor[],
  ): TurnkeyPasskeyClient => {
    const targetRpId =
      rpId ?? this.config.rpId ?? WindowWrapper.location.hostname;

    if (!targetRpId) {
      throw new Error(
        "Tried to initialize a passkey client with no rpId defined",
      );
    }

    this.stamper = new WebauthnStamper({
      rpId: targetRpId,
      ...(timeout !== undefined && { timeout }),
      ...(userVerification !== undefined && { userVerification }),
      ...(allowCredentials !== undefined && { allowCredentials }),
    });

    return new TurnkeyPasskeyClient({
      stamper: this.stamper,
      apiBaseUrl: this.config.apiBaseUrl,
      organizationId: this.config.defaultOrganizationId,
    });
  };

  iframeClient = async (
    params: IframeClientParams,
  ): Promise<TurnkeyIframeClient> => {
    if (!params.iframeUrl) {
      throw new Error(
        "Tried to initialize iframeClient with no iframeUrl defined",
      );
    }

    const TurnkeyIframeElementId =
      params.iframeElementId ?? "turnkey-default-iframe-element-id";

    this.stamper = new IframeStamper({
      iframeContainer: params.iframeContainer,
      iframeUrl: params.iframeUrl,
      iframeElementId: TurnkeyIframeElementId,
    });

    await this.stamper.init();

    return new TurnkeyIframeClient({
      stamper: this.stamper,
      apiBaseUrl: this.config.apiBaseUrl,
      organizationId: this.config.defaultOrganizationId,
    });
  };

  walletClient = (wallet: WalletInterface): TurnkeyWalletClient => {
    return new TurnkeyWalletClient({
      stamper: new WalletStamper(wallet),
      wallet,
      apiBaseUrl: this.config.apiBaseUrl,
      organizationId: this.config.defaultOrganizationId,
    });
  };

  serverSign = async <TResponseType>(
    methodName: string,
    params: any[],
    serverSignUrl?: string,
  ): Promise<TResponseType> => {
    const targetServerSignUrl = serverSignUrl ?? this.config.serverSignUrl;

    if (!targetServerSignUrl) {
      throw new Error("Tried to call serverSign with no serverSignUrl defined");
    }

    const stringifiedBody = JSON.stringify({
      methodName: methodName,
      params: params,
    });

    const response = await fetch(targetServerSignUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Client-Version": VERSION,
      },
      body: stringifiedBody,
      redirect: "follow",
    });

    if (!response.ok) {
      let res: GrpcStatus;
      try {
        res = await response.json();
      } catch (_) {
        throw new Error(`${response.status} ${response.statusText}`);
      }

      throw new TurnkeyRequestError(res);
    }

    const data = await response.json();
    return data as TResponseType;
  };

  /**
   * If there is a valid, current user session, this will return a read-enabled TurnkeyBrowserClient that can make read requests to Turnkey without additional authentication. This is powered by a session header resulting from a prior successful `login` call.
   *
   * @returns {Promise<TurnkeyBrowserClient | undefined>}
   */
  currentUserSession = async (): Promise<TurnkeyBrowserClient | undefined> => {
    const currentUser = await this.getCurrentUser();
    if (!currentUser?.session?.read) {
      return;
    }

    if (currentUser?.session?.read?.expiry > Date.now()) {
      return new TurnkeyBrowserClient({
        readOnlySession: currentUser?.session?.read?.token!,
        apiBaseUrl: this.config.apiBaseUrl,
        organizationId:
          currentUser?.organization?.organizationId ??
          this.config.defaultOrganizationId,
      });
    } else {
      this.logoutUser();
    }

    return;
  };

  /**
   * If there is a valid, current read-session, this will return an auth bundle and its expiration. This auth bundle can be used in conjunction with an iframeStamper to create a read + write session.
   *
   * @returns {Promise<ReadWriteSession | undefined>}
   */
  getReadWriteSession = async (): Promise<ReadWriteSession | undefined> => {
    const currentUser: User | undefined = await getStorageValue(
      StorageKeys.UserSession,
    );

    if (currentUser?.session?.write) {
      if (currentUser.session.write.expiry > Date.now()) {
        return currentUser.session.write;
      } else {
        await removeStorageValue(StorageKeys.ReadWriteSession);
      }
    }

    return;
  };

  /**
   * @deprecated This method is deprecated and will be removed in future versions.
   * It has been replaced by the `getReadWriteSession` method.
   * Fetches an auth bundle stored in local storage.
   *
   * @returns {Promise<string | undefined>}
   */
  getAuthBundle = async (): Promise<string | undefined> => {
    return await getStorageValue(StorageKeys.AuthBundle);
  };

  /**
   * Fetches the current user's organization details.
   *
   * @returns {Promise<SubOrganization | undefined>}
   */
  getCurrentSubOrganization = async (): Promise<
    SubOrganization | undefined
  > => {
    const currentUser = await this.getCurrentUser();
    return currentUser?.organization;
  };

  /**
   * Fetches the currently active user.
   *
   * @returns {Promise<User | undefined>}
   */
  getCurrentUser = async (): Promise<User | undefined> => {
    return await getStorageValue(StorageKeys.UserSession);
  };

  /**
   * Clears out all data pertaining to a user session.
   *
   * @returns {Promise<boolean>}
   */
  logoutUser = async (): Promise<boolean> => {
    await removeStorageValue(StorageKeys.AuthBundle); // DEPRECATED
    await removeStorageValue(StorageKeys.CurrentUser);
    await removeStorageValue(StorageKeys.UserSession);
    await removeStorageValue(StorageKeys.ReadWriteSession);

    return true;
  };
}

export class TurnkeyBrowserClient extends TurnkeySDKClientBase {
  authClient?: AuthClient | undefined;

  constructor(config: TurnkeySDKClientConfig, authClient?: AuthClient) {
    super(config);
    this.authClient = authClient;
  }

  login = async (config?: {
    organizationId?: string;
  }): Promise<SdkApiTypes.TCreateReadOnlySessionResponse> => {
    const readOnlySessionResult = await this.createReadOnlySession(
      config || {},
    );

    await saveSession(readOnlySessionResult, this.authClient);

    return readOnlySessionResult!;
  };

  /**
   * Creates a read-write session. This method infers the current user's organization ID and target userId.
   * To be used in conjunction with an `iframeStamper`: the resulting session's credential bundle can be
   * injected into an iframeStamper to create a session that enables both read and write requests.
   *
   * @param targetEmbeddedKey
   * @param expirationSeconds
   * @param userId
   * @returns {Promise<SdkApiTypes.TCreateReadWriteSessionResponse>}
   */
  loginWithReadWriteSession = async (
    targetEmbeddedKey: string,
    expirationSeconds: string = DEFAULT_SESSION_EXPIRATION,
    userId?: string,
  ): Promise<SdkApiTypes.TCreateReadWriteSessionResponse> => {
    const readWriteSessionResult = await this.createReadWriteSession({
      targetPublicKey: targetEmbeddedKey,
      expirationSeconds,
      userId: userId!,
    });

    // Ensure session and sessionExpiry are included in the object
    const readWriteSessionResultWithSession = {
      ...readWriteSessionResult,
      credentialBundle: readWriteSessionResult.credentialBundle,
      sessionExpiry: Date.now() + Number(expirationSeconds) * 1000,
    };

    // store auth bundle in local storage
    await saveSession(readWriteSessionResultWithSession, this.authClient);

    return readWriteSessionResultWithSession;
  };

  /**
   * Logs in with an existing auth bundle. this bundle enables both read and write requests.
   *
   * @param credentialBundle
   * @param expirationSeconds
   * @returns {Promise<boolean>}
   */
  loginWithAuthBundle = async (
    credentialBundle: string,
    expirationSeconds: string = DEFAULT_SESSION_EXPIRATION,
  ): Promise<any> => {
    try {
      const whoAmIResult = await this.getWhoami();

      const readWriteSessionResultWithSession = {
        ...whoAmIResult,
        credentialBundle: credentialBundle,
        sessionExpiry: Date.now() + Number(expirationSeconds) * 1000,
      };
      await saveSession(readWriteSessionResultWithSession, this.authClient);
      return true;
    } catch {
      return false;
    }
  };

  /**
   * Removes authentication factors from an end user.
   *
   * This function allows selectively removing:
   * - Phone number
   * - Email
   * - Authenticators (by ID)
   * - OAuth providers (by ID)
   * - API keys (by ID)
   *
   * All removal operations are executed in parallel if multiple
   * parameters are provided.
   *
   * @param userId - Unique identifier of the user
   * @param phoneNumber - If true, removes the user's phone number
   * @param email - If true, removes the user's email
   * @param authenticatorIds - Array of authenticator IDs to remove
   * @param oauthProviderIds - Array of OAuth provider IDs to remove
   * @param apiKeyIds - Array of API key IDs to remove
   * @returns A promise that resolves to an array of results from each removal operation
   */
  deleteUserAuth = async (
    userId: string,
    phoneNumber?: boolean,
    email?: boolean,
    authenticatorIds?: string[],
    oauthProviderIds?: string[],
    apiKeyIds?: string[],
  ): Promise<any[]> => {
    const promises: Promise<any>[] = [];

    if (phoneNumber) {
      promises.push(this.updateUser({ userId, userPhoneNumber: "" }));
    }

    if (email) {
      promises.push(this.updateUser({ userId, userEmail: "" }));
    }

    if (authenticatorIds && authenticatorIds.length > 0) {
      promises.push(this.deleteAuthenticators({ userId, authenticatorIds }));
    }

    if (oauthProviderIds && oauthProviderIds.length > 0) {
      promises.push(
        this.deleteOauthProviders({ userId, providerIds: oauthProviderIds }),
      );
    }

    if (apiKeyIds && apiKeyIds.length > 0) {
      promises.push(this.deleteApiKeys({ userId, apiKeyIds }));
    }

    // Execute all removal operations in parallel
    return Promise.all(promises);
  };

  /**
   * Adds or updates authentication factors for an end user.
   *
   * This function allows selectively adding:
   * - Phone number
   * - Email
   * - Authenticators
   * - OAuth providers
   * - API keys
   *
   * All additions/updates are executed in parallel if multiple
   * parameters are provided.
   *
   * @param userId - Unique identifier of the user
   * @param phoneNumber - New phone number for the user
   * @param email - New email address for the user
   * @param authenticators - Array of authenticator objects to create
   * @param oauthProviders - Array of OAuth provider objects to create
   * @param apiKeys - Array of API key objects to create
   * @returns A promise that resolves to an array of results from each addition or update
   */
  addUserAuth = async (
    userId: string,
    phoneNumber?: string,
    email?: string,
    authenticators?: any[],
    oauthProviders?: any[],
    apiKeys?: any[],
  ): Promise<any[]> => {
    const promises: Promise<any>[] = [];

    if (phoneNumber) {
      promises.push(this.updateUser({ userId, userPhoneNumber: phoneNumber }));
    }

    if (email) {
      promises.push(this.updateUser({ userId, userEmail: email }));
    }

    if (authenticators && authenticators.length > 0) {
      promises.push(this.createAuthenticators({ userId, authenticators }));
    }

    if (oauthProviders && oauthProviders.length > 0) {
      promises.push(this.createOauthProviders({ userId, oauthProviders }));
    }

    if (apiKeys && apiKeys.length > 0) {
      promises.push(this.createApiKeys({ userId, apiKeys }));
    }

    // Execute all additions in parallel
    return Promise.all(promises);
  };

  /**
   * Comprehensive authentication update for an end user.
   * Combines add/update and delete operations into a single call.
   *
   * The behavior is driven by whether values are set to:
   * - A string/array (to create or update)
   * - `null` or an array of IDs (to remove)
   *
   * All operations are executed in parallel where applicable.
   *
   * @param params - A structured object containing all the update parameters
   *   @param params.userId - Unique identifier of the user
   *   @param params.phoneNumber - String to set (new phone) or `null` to remove
   *   @param params.email - String to set (new email) or `null` to remove
   *   @param params.authenticators - Object describing authenticators to add or remove
   *   @param params.oauthProviders - Object describing OAuth providers to add or remove
   *   @param params.apiKeys - Object describing API keys to add or remove
   *
   * @returns A promise that resolves to a boolean indicating overall success
   */
  async updateUserAuth(params: UpdateUserAuthParams): Promise<boolean> {
    const {
      userId,
      phoneNumber,
      email,
      authenticators,
      oauthProviders,
      apiKeys,
    } = params;
    const promises: Promise<any>[] = [];

    // Handle phone/email in a single updateUser call if both are changing,
    // or separate calls if only one is changing—either approach is fine.
    const userUpdates: { userPhoneNumber?: string; userEmail?: string } = {};

    if (phoneNumber !== undefined) {
      userUpdates.userPhoneNumber = phoneNumber === null ? "" : phoneNumber;
    }
    if (email !== undefined) {
      userUpdates.userEmail = email === null ? "" : email;
    }
    if (Object.keys(userUpdates).length > 0) {
      promises.push(this.updateUser({ userId, ...userUpdates }));
    }

    // Handle authenticators
    if (authenticators) {
      if (authenticators.add?.length) {
        promises.push(
          this.createAuthenticators({
            userId,
            authenticators: authenticators.add,
          }),
        );
      }
      if (authenticators.deleteIds?.length) {
        promises.push(
          this.deleteAuthenticators({
            userId,
            authenticatorIds: authenticators.deleteIds,
          }),
        );
      }
    }

    // Handle OAuth providers
    if (oauthProviders) {
      if (oauthProviders.add?.length) {
        promises.push(
          this.createOauthProviders({
            userId,
            oauthProviders: oauthProviders.add,
          }),
        );
      }
      if (oauthProviders.deleteIds?.length) {
        promises.push(
          this.deleteOauthProviders({
            userId,
            providerIds: oauthProviders.deleteIds,
          }),
        );
      }
    }

    // Handle API keys
    if (apiKeys) {
      if (apiKeys.add?.length) {
        promises.push(
          this.createApiKeys({
            userId,
            apiKeys: apiKeys.add,
          }),
        );
      }
      if (apiKeys.deleteIds?.length) {
        promises.push(
          this.deleteApiKeys({
            userId,
            apiKeyIds: apiKeys.deleteIds,
          }),
        );
      }
    }

    // Execute all requested operations in parallel
    await Promise.all(promises);
    return true;
  }
}

export class TurnkeyPasskeyClient extends TurnkeyBrowserClient {
  rpId: string;

  constructor(config: TurnkeySDKClientConfig) {
    super(config, AuthClient.Passkey);
    this.rpId = (this.stamper as WebauthnStamper)!.rpId;
  }

  /**
   * Create a passkey for an end-user, taking care of various lower-level details.
   *
   * @returns {Promise<Passkey>}
   */
  createUserPasskey = async (
    config: Record<any, any> = {},
  ): Promise<Passkey> => {
    const challenge = generateRandomBuffer();
    const encodedChallenge = base64UrlEncode(challenge);
    const authenticatorUserId = generateRandomBuffer();

    // WebAuthn credential options options can be found here:
    // https://www.w3.org/TR/webauthn-2/#sctn-sample-registration
    //
    // All pubkey algorithms can be found here: https://www.iana.org/assignments/cose/cose.xhtml#algorithms
    // Turnkey only supports ES256 (-7) and RS256 (-257)
    //
    // The pubkey type only supports one value, "public-key"
    // See https://www.w3.org/TR/webauthn-2/#enumdef-publickeycredentialtype for more details
    // TODO: consider un-nesting these config params
    const webauthnConfig: CredentialCreationOptions = {
      publicKey: {
        rp: {
          id: config.publicKey?.rp?.id ?? this.rpId,
          name: config.publicKey?.rp?.name ?? "",
        },
        challenge: config.publicKey?.challenge ?? challenge,
        pubKeyCredParams: config.publicKey?.pubKeyCredParams ?? [
          {
            type: "public-key",
            alg: -7,
          },
          {
            type: "public-key",
            alg: -257,
          },
        ],
        user: {
          id: config.publicKey?.user?.id ?? authenticatorUserId,
          name: config.publicKey?.user?.name ?? "Default User",
          displayName: config.publicKey?.user?.displayName ?? "Default User",
        },
        authenticatorSelection: {
          authenticatorAttachment:
            config.publicKey?.authenticatorSelection?.authenticatorAttachment ??
            undefined, // default to empty
          requireResidentKey:
            config.publicKey?.authenticatorSelection?.requireResidentKey ??
            true,
          residentKey:
            config.publicKey?.authenticatorSelection?.residentKey ?? "required",
          userVerification:
            config.publicKey?.authenticatorSelection?.userVerification ??
            "preferred",
        },
      },
    };

    const attestation = await getWebAuthnAttestation(webauthnConfig);

    return {
      encodedChallenge: config.publicKey?.challenge
        ? base64UrlEncode(config.publicKey?.challenge)
        : encodedChallenge,
      attestation,
    };
  };

  /**
   * Uses passkey authentication to create a read-write session, via an embedded API key,
   * and stores + returns the resulting auth bundle that contains the encrypted API key.
   * This auth bundle (also referred to as a credential bundle) can be injected into an `iframeStamper`,
   * resulting in a touch-free authenticator. Unlike `loginWithReadWriteSession`, this method
   * assumes the end-user's organization ID (i.e. the sub-organization ID) is already known.
   *
   * @param userId
   * @param targetEmbeddedKey
   * @param expirationSeconds
   * @param curveType
   * @returns {Promise<ReadWriteSession>}
   */
  createPasskeySession = async (
    userId: string,
    targetEmbeddedKey: string,
    expirationSeconds: string = DEFAULT_SESSION_EXPIRATION,
    organizationId?: string,
  ): Promise<ReadWriteSession> => {
    const user = await getStorageValue(StorageKeys.UserSession);
    organizationId = organizationId ?? user?.organization.organizationId;

    if (!organizationId) {
      throw new Error(
        "Error creating passkey session: Organization ID is required",
      );
    }

    userId = userId ?? user?.userId;

    const { authBundle: credentialBundle, publicKey } =
      await createEmbeddedAPIKey(targetEmbeddedKey);

    // add API key to Turnkey User
    await this.createApiKeys({
      organizationId,
      userId,
      apiKeys: [
        {
          apiKeyName: `Session Key ${String(Date.now())}`,
          publicKey,
          expirationSeconds,
          curveType: "API_KEY_CURVE_P256",
        },
      ],
    });

    const expiry = Date.now() + Number(expirationSeconds) * 1000;

    await saveSession(
      {
        organizationId,
        organizationName: user?.organization.organizationName ?? "",
        userId,
        username: user?.username ?? "",
        credentialBundle,
        sessionExpiry: expiry,
      },
      this.authClient,
    );

    return {
      credentialBundle,
      expiry,
    };
  };
}

export class TurnkeyIframeClient extends TurnkeyBrowserClient {
  iframePublicKey: string | null;

  constructor(config: TurnkeySDKClientConfig) {
    super(config, AuthClient.Iframe);
    this.iframePublicKey = (this.stamper as IframeStamper).iframePublicKey;
  }

  injectCredentialBundle = async (
    credentialBundle: string,
  ): Promise<boolean> => {
    return await (this.stamper as IframeStamper).injectCredentialBundle(
      credentialBundle,
    );
  };

  injectWalletExportBundle = async (
    credentialBundle: string,
    organizationId: string,
  ): Promise<boolean> => {
    return await (this.stamper as IframeStamper).injectWalletExportBundle(
      credentialBundle,
      organizationId,
    );
  };

  injectKeyExportBundle = async (
    credentialBundle: string,
    organizationId: string,
    keyFormat?: KeyFormat | undefined,
  ): Promise<boolean> => {
    return await (this.stamper as IframeStamper).injectKeyExportBundle(
      credentialBundle,
      organizationId,
      keyFormat,
    );
  };

  injectImportBundle = async (
    bundle: string,
    organizationId: string,
    userId: string,
  ): Promise<boolean> => {
    return await (this.stamper as IframeStamper).injectImportBundle(
      bundle,
      organizationId,
      userId,
    );
  };

  extractWalletEncryptedBundle = async (): Promise<string> => {
    return await (this.stamper as IframeStamper).extractWalletEncryptedBundle();
  };

  extractKeyEncryptedBundle = async (): Promise<string> => {
    return await (this.stamper as IframeStamper).extractKeyEncryptedBundle();
  };
}

export class TurnkeyWalletClient extends TurnkeyBrowserClient {
  private wallet: WalletInterface;

  constructor(config: TurnkeyWalletClientConfig) {
    super(config, AuthClient.Wallet);
    this.wallet = config.wallet;
  }

  async getPublicKey(): Promise<string> {
    return this.wallet.getPublicKey();
  }

  getWalletInterface(): WalletInterface {
    return this.wallet;
  }
}

import { WebauthnStamper } from "@turnkey/webauthn-stamper";
import {
  IframeStamper,
  KeyFormat,
  TIframeSettings,
} from "@turnkey/iframe-stamper";
import { getWebAuthnAttestation } from "@turnkey/http";

import { VERSION } from "./__generated__/version";
import WindowWrapper from "./__polyfills__/window";

import type {
  GrpcStatus,
  TurnkeySDKClientConfig,
  TurnkeySDKBrowserConfig,
  IframeClientParams,
} from "./__types__/base";

import { TurnkeyRequestError } from "./__types__/base";

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
  setStorageValue,
} from "./storage";
import {
  generateRandomBuffer,
  base64UrlEncode,
  createEmbeddedAPIKey,
} from "./utils";

const DEFAULT_SESSION_EXPIRATION = "900"; // default to 15 minutes

export class TurnkeyBrowserSDK {
  config: TurnkeySDKBrowserConfig;

  constructor(config: TurnkeySDKBrowserConfig) {
    this.config = config;
  }

  passkeyClient = (rpId?: string): TurnkeyPasskeyClient => {
    const targetRpId =
      rpId ?? this.config.rpId ?? WindowWrapper.location.hostname;

    if (!targetRpId) {
      throw new Error(
        "Tried to initialize a passkey client with no rpId defined"
      );
    }

    const webauthnStamper = new WebauthnStamper({
      rpId: targetRpId,
    });

    return new TurnkeyPasskeyClient({
      stamper: webauthnStamper,
      apiBaseUrl: this.config.apiBaseUrl,
      organizationId: this.config.defaultOrganizationId,
    });
  };

  iframeClient = async (
    params: IframeClientParams
  ): Promise<TurnkeyIframeClient> => {
    if (!params.iframeUrl) {
      throw new Error(
        "Tried to initialize iframeClient with no iframeUrl defined"
      );
    }

    const TurnkeyIframeElementId =
      params.iframeElementId ?? "turnkey-default-iframe-element-id";

    const iframeStamper = new IframeStamper({
      iframeContainer: params.iframeContainer,
      iframeUrl: params.iframeUrl,
      iframeElementId: TurnkeyIframeElementId,
    });

    await iframeStamper.init();

    return new TurnkeyIframeClient({
      stamper: iframeStamper,
      apiBaseUrl: this.config.apiBaseUrl,
      organizationId: this.config.defaultOrganizationId,
    });
  };

  serverSign = async <TResponseType>(
    methodName: string,
    params: any[],
    serverSignUrl?: string
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
    if (!currentUser?.readOnlySession) {
      return;
    }

    if (currentUser?.readOnlySession?.sessionExpiry > Date.now()) {
      return new TurnkeyBrowserClient({
        readOnlySession: currentUser?.readOnlySession?.session!,
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
    const readWriteSession: ReadWriteSession | undefined =
      await getStorageValue(StorageKeys.ReadWriteSession);

    if (readWriteSession) {
      if (readWriteSession.sessionExpiry > Date.now()) {
        return readWriteSession;
      } else {
        await removeStorageValue(StorageKeys.ReadWriteSession);
      }
    }

    return;
  };

  /**
   * Fetches an auth bundle stored in local storage.
   *
   * @returns {Promise<string | undefined>}
   */
  getAuthBundle = async (): Promise<string | undefined> => {
    return await getStorageValue(StorageKeys.AuthBundle); // DEPRECATED
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
    return await getStorageValue(StorageKeys.CurrentUser);
  };

  /**
   * Clears out all data pertaining to a user session.
   *
   * @returns {Promise<boolean>}
   */
  logoutUser = async (): Promise<boolean> => {
    await removeStorageValue(StorageKeys.AuthBundle); // DEPRECATED
    await removeStorageValue(StorageKeys.CurrentUser);
    await removeStorageValue(StorageKeys.ReadWriteSession);

    return true;
  };
}

export class TurnkeyBrowserClient extends TurnkeySDKClientBase {
  constructor(config: TurnkeySDKClientConfig) {
    super(config);
  }

  login = async (config?: {
    organizationId?: string;
  }): Promise<SdkApiTypes.TCreateReadOnlySessionResponse> => {
    const readOnlySessionResult = await this.createReadOnlySession(
      config || {}
    );
    const org = {
      organizationId: readOnlySessionResult!.organizationId,
      organizationName: readOnlySessionResult!.organizationName,
    };

    const currentUser: User = {
      userId: readOnlySessionResult!.userId,
      username: readOnlySessionResult!.username,
      organization: org,
      readOnlySession: {
        session: readOnlySessionResult!.session,
        sessionExpiry: Number(readOnlySessionResult!.sessionExpiry),
      },
    };

    await setStorageValue(StorageKeys.CurrentUser, currentUser);

    return readOnlySessionResult!;
  };

  /**
   * Creates a read-write session. This method infers the current user's organization ID and target userId. To be used in conjunction with an `iframeStamper`: the resulting session's credential bundle can be injected into an iframeStamper to create a session that enables both read and write requests.
   *
   * @param email
   * @param targetEmbeddedKey
   * @param expirationSeconds
   * @returns {Promise<SdkApiTypes.TCreateReadWriteSessionResponse>}
   */
  loginWithReadWriteSession = async (
    targetEmbeddedKey: string,
    expirationSeconds: string = DEFAULT_SESSION_EXPIRATION,
    userId?: string
  ): Promise<SdkApiTypes.TCreateReadWriteSessionResponse> => {
    const readWriteSessionResult = await this.createReadWriteSession({
      targetPublicKey: targetEmbeddedKey,
      expirationSeconds,
      userId: userId!,
    });

    // store auth bundle in local storage
    await setStorageValue(StorageKeys.ReadWriteSession, {
      authBundle: readWriteSessionResult!.credentialBundle,
      sessionExpiry: Date.now() + Number(expirationSeconds) * 1000,
    });

    return readWriteSessionResult;
  };
}

export class TurnkeyPasskeyClient extends TurnkeyBrowserClient {
  rpId: string;

  constructor(config: TurnkeySDKClientConfig) {
    super(config);
    this.rpId = (config.stamper as WebauthnStamper)!.rpId;
  }

  /**
   * Create a passkey for an end-user, taking care of various lower-level details.
   *
   * @returns {Promise<Passkey>}
   */
  createUserPasskey = async (
    config: Record<any, any> = {}
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
   * Uses passkey authentication to create a read-write session, via an embedded API key, and stores + returns the resulting auth bundle that contains the encrypted API key. This auth bundle (also referred to as a credential bundle) can be injected into an iframeStamper, resulting in a touch-free authenticator. Unlike `loginWithReadWriteSession`, this method assumes the end-user's organization ID (i.e. the sub-organization ID) is already known.
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
    organizationId?: string
  ): Promise<ReadWriteSession> => {
    const localStorageUser = await getStorageValue(StorageKeys.CurrentUser);
    userId = userId ?? localStorageUser?.userId;

    const { authBundle, publicKey } = await createEmbeddedAPIKey(
      targetEmbeddedKey
    );

    // add API key to Turnkey User
    await this.createApiKeys({
      organizationId: organizationId!,
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

    const readWriteSession = {
      authBundle: authBundle,
      sessionExpiry: Date.now() + Number(expirationSeconds) * 1000,
    };

    // store auth bundle in local storage
    await setStorageValue(StorageKeys.ReadWriteSession, readWriteSession);

    return readWriteSession;
  };
}

export class TurnkeyIframeClient extends TurnkeyBrowserClient {
  // Expose the target public key corresponding to the iframe
  iframePublicKey: string | null;

  constructor(config: TurnkeySDKClientConfig) {
    super(config);
    this.iframePublicKey = (config.stamper as IframeStamper).iframePublicKey;
  }

  // Allows the iframe to be cleared from the DOM
  clear = (): void => {
    const stamper = this.config.stamper as IframeStamper;
    return stamper.clear();
  }

  // Enable iframe styling
  applySettings = async (settings: TIframeSettings): Promise<boolean> => {
    const stamper = this.config.stamper as IframeStamper;
    return await stamper.applySettings(settings);
  }

  injectCredentialBundle = async (
    credentialBundle: string
  ): Promise<boolean> => {
    const stamper = this.config.stamper as IframeStamper;
    return await stamper.injectCredentialBundle(credentialBundle);
  };

  injectWalletExportBundle = async (
    credentialBundle: string,
    organizationId: string
  ): Promise<boolean> => {
    const stamper = this.config.stamper as IframeStamper;
    return await stamper.injectWalletExportBundle(
      credentialBundle,
      organizationId
    );
  };

  injectKeyExportBundle = async (
    credentialBundle: string,
    organizationId: string,
    keyFormat?: KeyFormat | undefined
  ): Promise<boolean> => {
    const stamper = this.config.stamper as IframeStamper;
    return await stamper.injectKeyExportBundle(
      credentialBundle,
      organizationId,
      keyFormat
    );
  };

  injectImportBundle = async (
    bundle: string,
    organizationId: string,
    userId: string
  ): Promise<boolean> => {
    const stamper = this.config.stamper as IframeStamper;
    return await stamper.injectImportBundle(bundle, organizationId, userId);
  };

  extractWalletEncryptedBundle = async (): Promise<string> => {
    const stamper = this.config.stamper as IframeStamper;
    return await stamper.extractWalletEncryptedBundle();
  };

  extractKeyEncryptedBundle = async (): Promise<string> => {
    const stamper = this.config.stamper as IframeStamper;
    return await stamper.extractKeyEncryptedBundle();
  };
}

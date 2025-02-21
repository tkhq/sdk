import { WalletStamper, type WalletInterface } from "@turnkey/wallet-stamper";
import { IframeStamper } from "@turnkey/iframe-stamper";
import { WebauthnStamper } from "@turnkey/webauthn-stamper";

import WindowWrapper from "@polyfills/window";

import {
  type GrpcStatus,
  type TurnkeySDKBrowserConfig,
  TurnkeyRequestError,
  Stamper,
  IframeClientParams,
  PasskeyClientParams,
  SessionType,
} from "./__types__/base";

import type { User, SubOrganization, ReadWriteSession } from "@models";

import {
  Session,
  StorageKeys,
  getStorageValue,
  removeStorageValue,
} from "@storage";

import {
  TurnkeyBrowserClient,
  TurnkeyIframeClient,
  TurnkeyPasskeyClient,
  TurnkeyWalletClient,
} from "./__clients__/browser-clients";
import { VERSION } from "./__generated__/version";

export interface OauthProvider {
  providerName: string;
  oidcToken: string;
}

export interface ApiKey {
  apiKeyName: string;
  publicKey: string;
  curveType:
    | "API_KEY_CURVE_P256"
    | "API_KEY_CURVE_SECP256K1"
    | "API_KEY_CURVE_ED25519";
  expirationSeconds?: string;
}

export interface Authenticator {
  authenticatorName: string;
  challenge: string;
  attestation: {
    credentialId: string;
    clientDataJson: string;
    attestationObject: string;
    transports: (
      | "AUTHENTICATOR_TRANSPORT_BLE"
      | "AUTHENTICATOR_TRANSPORT_INTERNAL"
      | "AUTHENTICATOR_TRANSPORT_NFC"
      | "AUTHENTICATOR_TRANSPORT_USB"
      | "AUTHENTICATOR_TRANSPORT_HYBRID"
    )[];
  };
}

export class TurnkeyBrowserSDK {
  config: TurnkeySDKBrowserConfig;

  protected stamper: Stamper | undefined;

  /**
   * The current client instance. This is set by the `passkeyClient`, `iframeClient`, or `walletClient` methods.
   * const turnkey = new Turnkey({
   *   apiBaseUrl: "https://api.turnkey.com",
   *   apiPublicKey: turnkeyPublicKey,
   *   apiPrivateKey: turnkeyPrivateKey,
   *   defaultOrganizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
   * });
   *
   * turnkey.client.init(storageType = StorageType.LocalStorage || StorageType.Iframe);
   *   returns -> string publicKey
   *
   * turnkey.client.publicKey() -> string publicKey
   *
   * passkeyClient is used exlusively with Read-Only sessions
   *
   * passkeyClient needs iframe client when used with Read-Write sessions
   *
   * There are several ways to use the Turnkey Browser SDK and get a client instance:
   *    import { Turnkey } from "@turnkey/sdk-browser";
   *    const turnkey = new Turnkey({ ... }: TurnkeySDKBrowserConfig); // TurnkeySDKBrowserConfig does not have a stamper
   *
   *    turnkey.currentUserSession(); // returns a TurnkeyBrowserClient if there is a valid read session
   *
   *    turnkey.passkeyClient({ ... }: PasskeyClientParams); // PasskeyClientParams does not have a stamper
   *      creates a WebauthnStamper
   *      creates a TurnkeyPasskeyClient which takes the WebauthnStamper
   *      returns the TurnkeyPasskeyClient
   *
   *    import TelegramCloudStorageStamper from "@turnkey/telegram-cloud-storage-stamper";
   *    const stamper = await TelegramCloudStorageStamper.create({
   *      cloudStorageAPIKey: apiKey
   *    })
   *    import { TurnkeyBrowserClient } from "@turnkey/sdk-browser";
   *    const passkeyClient = new TurnkeyBrowserClient({ ... }: TurnkeySDKClientConfig); // TurnkeySDKClientConfig has a stamper
   */
  protected client:
    | TurnkeyBrowserClient
    | TurnkeyWalletClient
    | TurnkeyIframeClient
    | TurnkeyPasskeyClient
    | undefined;

  constructor(config: TurnkeySDKBrowserConfig) {
    this.config = config;
  }

  init = async (): Promise<void> => {
    // noop
  };

  /**
   * Creates a passkey client. The parameters override the default values passed to the underlying Turnkey `WebauthnStamper`
   * @param PasskeyClientParams
   * @returns new TurnkeyPasskeyClient
   */
  passkeyClient = (params?: PasskeyClientParams): TurnkeyPasskeyClient => {
    const targetRpId =
      params?.rpId ?? this.config.rpId ?? WindowWrapper.location.hostname;

    if (!targetRpId) {
      throw new Error(
        "Tried to initialize a passkey client with no rpId defined"
      );
    }

    this.stamper = new WebauthnStamper({
      rpId: targetRpId,
      ...(params?.timeout !== undefined && { timeout: params?.timeout }),
      ...(params?.userVerification !== undefined && {
        userVerification: params?.userVerification,
      }),
      ...(params?.allowCredentials !== undefined && {
        allowCredentials: params?.allowCredentials,
      }),
    });

    return new TurnkeyPasskeyClient({
      stamper: this.stamper,
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

    this.stamper = new IframeStamper({
      iframeContainer: params.iframeContainer,
      iframeUrl: params.iframeUrl,
      iframeElementId: TurnkeyIframeElementId,
    });

    await this.stamper.init(
      params.dangerouslyOverrideIframeKeyTtl ?? undefined
    );

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
      await this.logout();
    }

    return;
  };

  /**
   * If there is a valid, current read-session, this will return an auth bundle and its expiration. This auth bundle can be used in conjunction with an iframeStamper to create a read + write session.
   * @deprecated use `getSession` instead
   * @returns {Promise<ReadWriteSession | undefined>}
   */
  getReadWriteSession = async (): Promise<ReadWriteSession | undefined> => {
    const currentUser: User | undefined = await getStorageValue(
      StorageKeys.UserSession
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
   * If there is a valid, active READ_WRITE session, this will return it
   *
   * @returns {Promise<Session | undefined>}
   */
  getSession = async (): Promise<Session | undefined> => {
    const currentSession: Session | undefined = await getStorageValue(
      StorageKeys.Session
    );
    if (currentSession?.sessionType === SessionType.READ_WRITE) {
      if (currentSession?.expiry > Date.now()) {
        return currentSession;
      } else {
        await removeStorageValue(StorageKeys.Session);
      }
    }

    return;
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
   * Clears out all data pertaining to an end user session.
   *
   * @returns {Promise<boolean>}
   */
  logout = async (): Promise<boolean> => {
    await removeStorageValue(StorageKeys.AuthBundle); // DEPRECATED
    await removeStorageValue(StorageKeys.CurrentUser);
    await removeStorageValue(StorageKeys.UserSession);
    await removeStorageValue(StorageKeys.ReadWriteSession);
    await removeStorageValue(StorageKeys.Client);
    await removeStorageValue(StorageKeys.Session);
    return true;
  };
}

export {
  TurnkeyBrowserClient,
  TurnkeyIframeClient,
  TurnkeyPasskeyClient,
  TurnkeyWalletClient,
};

import { WalletStamper, type WalletInterface } from "@turnkey/wallet-stamper";
import { IframeStamper } from "@turnkey/iframe-stamper";
import { WebauthnStamper } from "@turnkey/webauthn-stamper";

import WindowWrapper from "@polyfills/window";

import {
  type GrpcStatus,
  type TurnkeySDKBrowserConfig,
  Session,
  TurnkeyRequestError,
  Stamper,
  IframeClientParams,
  PasskeyClientParams,
} from "./__types__/base";


import { StorageKeys, getStorageValue, removeStorageValue } from "@storage";

import {
  TurnkeyBrowserClient,
  TurnkeyIframeClient,
  TurnkeyPasskeyClient,
  TurnkeyIndexedDbClient,
  TurnkeyWalletClient,
} from "./__clients__/browser-clients";
import { VERSION } from "./__generated__/version";
import { IndexedDbStamper } from "@turnkey/indexed-db-stamper";
import { parseSession } from "@utils";

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

  constructor(config: TurnkeySDKBrowserConfig) {
    this.config = config;
  }

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
        "Tried to initialize a passkey client with no rpId defined",
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

    await this.stamper.init(
      params.dangerouslyOverrideIframeKeyTtl ?? undefined,
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

  indexedDbClient = async (): Promise<TurnkeyIndexedDbClient> => {
    this.stamper = new IndexedDbStamper();

    return new TurnkeyIndexedDbClient({
      stamper: this.stamper,
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
   * If there is a valid, active session, this will parse it and return it
   *
   * @returns {Promise<Session | undefined>}
   */
  getSession = async (): Promise<Session | undefined> => {
    const currentSession: Session | string | undefined = await getStorageValue(
      StorageKeys.Session,
    );
  
    let session: Session | undefined;
  
    if (typeof currentSession === "string") {
      session = parseSession(currentSession);
    } else {
      session = currentSession;
    }
  
    if (session && session.expiry * 1000 > Date.now()) {
      return session;
    }
  
    await removeStorageValue(StorageKeys.Session);
    return undefined;
  };
  


    /**
   * If there is a valid, active session, this will return it without parsing it
   *
   * @returns {Promise<Session | undefined>}
   */
    getRawSession = async (): Promise<string | undefined> => {
      const currentSession: Session | string | undefined = await getStorageValue(StorageKeys.Session);
    
      let session: Session | undefined;
    
      if (typeof currentSession === "string") {
        session = parseSession(currentSession);
        if (session && session.expiry * 1000 > Date.now()) {
          return currentSession; // return raw JWT string
        }
      } else if (currentSession && currentSession.expiry * 1000 > Date.now()) {
        return JSON.stringify(currentSession); 
      }
    
      await removeStorageValue(StorageKeys.Session);
      return undefined;
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
  TurnkeyIndexedDbClient,
  TurnkeyWalletClient,
};

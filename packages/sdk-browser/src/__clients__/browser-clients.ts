import type { WalletInterface } from "@turnkey/wallet-stamper";
import type { IframeStamper, KeyFormat } from "@turnkey/iframe-stamper";
import type { WebauthnStamper } from "@turnkey/webauthn-stamper";
import { getWebAuthnAttestation } from "@turnkey/http";

import type * as SdkApiTypes from "../__generated__/sdk_api_types";
import { TurnkeyBaseClient } from "../__clients__/base-client";

import {
  AuthClient,
  TurnkeySDKClientConfig,
  SessionType,
  TurnkeyWalletClientConfig,
} from "@types";

import {
  generateRandomBuffer,
  base64UrlEncode,
  createEmbeddedAPIKey,
} from "@utils";

import type { ReadWriteSession, Passkey } from "@models";

import {
  Session,
  StorageKeys,
  getStorageValue,
  saveSession,
  storeSession,
} from "@storage";

import { DEFAULT_SESSION_EXPIRATION_IN_SECONDS } from "@constants";

export class TurnkeyBrowserClient extends TurnkeyBaseClient {
  iframeClient?: TurnkeyIframeClient;

  constructor(config: TurnkeySDKClientConfig, authClient?: AuthClient) {
    console.log("TurnkeyBrowserClient constructor config", config, authClient);
    super(config, authClient);
  }

  login = async (config?: {
    organizationId?: string;
  }): Promise<SdkApiTypes.TCreateReadOnlySessionResponse> => {
    console.log("TurnkeyBrowserClient login authClient", this.authClient);
    const readOnlySessionResult = await this.createReadOnlySession(
      config || {}
    );
    console.log(
      "TurnkeyBrowserClient login readOnlySessionResult",
      readOnlySessionResult
    );
    await saveSession(readOnlySessionResult, this.authClient);

    return readOnlySessionResult!;
  };

  //// NEW - BELOW ///

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
  refereshSession = async (
    sessionType: SessionType = SessionType.READ_WRITE,
    targetPublicKey?: string, // TODO: eventually we want to automatically pull this from localStorage/iframe
    expirationSeconds: string = DEFAULT_SESSION_EXPIRATION_IN_SECONDS
  ): Promise<void> => {
    console.log("TurnkeyBrowserClient refereshSession");
    if (sessionType === SessionType.READ_ONLY) {
      if (this! instanceof TurnkeyPasskeyClient) {
        throw new Error(
          "You must use a passkey client to refresh a read session"
        ); // TODO: support wallet clients perhaps?
      }
      const readOnlySessionResult = await this.createReadOnlySession({});
      const session: Session = {
        sessionType: SessionType.READ_ONLY,
        userId: readOnlySessionResult.userId,
        organizationId: readOnlySessionResult.organizationId,
        expiry: Number(readOnlySessionResult.sessionExpiry),
        token: readOnlySessionResult.session,
      };

      storeSession(session, AuthClient.Passkey);
    }
    if (sessionType === SessionType.READ_WRITE) {
      if (!targetPublicKey) {
        throw new Error(
          "You must provide a targetPublicKey to refresh a read-write session."
        );
      }
      const readWriteSessionResult = await this.createReadWriteSession({
        targetPublicKey,
        expirationSeconds,
        invalidateExisting: true,
      });
      const session: Session = {
        sessionType: SessionType.READ_WRITE,
        userId: readWriteSessionResult.userId,
        organizationId: readWriteSessionResult.organizationId,
        expiry: Date.now() + Number(expirationSeconds) * 1000, // TODO: change this to the actual expiry time from the response in a new version of the activity
        token: readWriteSessionResult.credentialBundle,
      };
      if (this instanceof TurnkeyIframeClient) {
        await this.injectCredentialBundle(session.token!);
      } else {
        // Throw an error if the client is not an iframe client
        throw new Error(
          "You must use an iframe client to refresh a read-write session"
        ); //should we default to a "localStorage" client?
      }
      storeSession(session, AuthClient.Iframe);
    }
  };

  /**
   * Log in with a bundle. This method uses a bundle sent to the end user email
   * To be used in conjunction with an `iframeStamper`.
   *
   * @param bundle
   * @param expirationSeconds
   * @returns {Promise<void>}
   */
  loginWithBundle = async (
    bundle: string, // we need a way to get the expiry of this token. Either it lives in the token itself or is returned from the server action and passed again here
    expirationSeconds: string // we need a way to get the expiry of this token. Either it lives in the token itself or is returned from the server action and passed again here
  ): Promise<void> => {
    console.log("TurnkeyBrowserClient loginWithBundle");
    if (this! instanceof TurnkeyIframeClient) {
      await this.injectCredentialBundle(bundle);
    } else {
      // Throw an error if the client is not an iframe client
      throw new Error(
        "You must use an iframe client to log in with a session."
      ); //should we default to a "localStorage" client?
    }
    const whoAmI = await this.getWhoami();

    const session: Session = {
      sessionType: SessionType.READ_WRITE,
      userId: whoAmI.userId,
      organizationId: whoAmI.organizationId,
      expiry: Date.now() + Number(expirationSeconds) * 1000, // TODO: change this to the actual expiry time
      token: bundle,
    };

    storeSession(session, AuthClient.Iframe);
  };

  /**
   * Log in with a session object. This method uses a session object from server actions and stores it and the active client in local storage
   * To be used in conjunction with an `iframeStamper`.
   *
   * @param session
   * @returns {Promise<SdkApiTypes.void>}
   */
  loginWithSession = async (session: Session): Promise<void> => {
    console.log("TurnkeyBrowserClient loginWithSession");
    if (this instanceof TurnkeyIframeClient) {
      await this.injectCredentialBundle(session.token!);
    } else {
      // Throw an error if the client is not an iframe client
      throw new Error(
        "You must use an iframe client to log in with a session."
      ); //should we default to a "localStorage" client?
    }
    storeSession(session, AuthClient.Iframe);
  };

  /**
   * Log in with a passkey.
   * To be used in conjunction with a `passkeyStamper`
   *
   * @param session
   * @returns {Promise<void>}
   */
  loginWithPasskey = async (
    sessionType: SessionType,
    targetPublicKey?: string, // TODO: eventually we want to automatically pull this from localStorage/iframe
    expirationSeconds: string = DEFAULT_SESSION_EXPIRATION_IN_SECONDS
  ): Promise<void> => {
    console.log("TurnkeyBrowserClient loginWithPasskey");
    if (this! instanceof TurnkeyPasskeyClient) {
      throw new Error(
        "You must use a passkey client to log in with a passkey."
      );
    }

    // Create a read-only session
    if (sessionType === SessionType.READ_ONLY) {
      const readOnlySessionResult = await this.createReadOnlySession({});

      const session: Session = {
        sessionType: SessionType.READ_ONLY,
        userId: readOnlySessionResult.userId,
        organizationId: readOnlySessionResult.organizationId,
        expiry: Number(readOnlySessionResult.sessionExpiry),
        token: readOnlySessionResult.session,
      };
      storeSession(session, AuthClient.Passkey);
    }

    // Create a read-write session
    if (sessionType === SessionType.READ_WRITE) {
      if (!targetPublicKey) {
        throw new Error(
          "You must provide a targetPublicKey to create a read-write session."
        );
      }
      const readWriteSessionResult = await this.createReadWriteSession({
        targetPublicKey,
        expirationSeconds,
      });

      const session: Session = {
        sessionType: SessionType.READ_WRITE,
        userId: readWriteSessionResult.userId,
        organizationId: readWriteSessionResult.organizationId,
        expiry: Date.now() + Number(expirationSeconds) * 1000, // TODO: change this to the actual expiry time from the response in a new version of the activity
        token: readWriteSessionResult.credentialBundle,
      };
      /**
       * some way to get a handle on the iframeStamper / iframeClient
       * do clients want a read only session?
       *   afterthought for now - read only sessions can be used for email OTPs
       *     the parentOrg has read only access by default
       *
       */
      // TODO: we need to inject the credential bundle in the iframe here
      if (!this.iframeClient) {
        throw new Error(
          "You must provide an iframe client to log in with a passkey."
        );
      }
      await this.iframeClient.injectCredentialBundle(session.token!);

      storeSession(session, AuthClient.Iframe);
    } else {
      throw new Error("Invalid session type passed.");
    }
  };

  //// NEW - ABOVE ///

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
    expirationSeconds: string = DEFAULT_SESSION_EXPIRATION_IN_SECONDS,
    userId?: string
  ): Promise<SdkApiTypes.TCreateReadWriteSessionResponse> => {
    console.log("TurnkeyBrowserClient loginWithReadWriteSession");
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
    console.log(
      "TurnkeyBrowserClient loginWithReadWriteSession",
      readWriteSessionResult
    );
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
    expirationSeconds: string = DEFAULT_SESSION_EXPIRATION_IN_SECONDS
  ): Promise<any> => {
    console.log(
      "TurnkeyBrowserClient loginWithAuthBundle authClient",
      this.authClient
    );
    try {
      console.log("TurnkeyBrowserClient loginWithAuthBundle before getWhoami");
      const whoAmIResult = await this.getWhoami();

      const readWriteSessionResultWithSession = {
        ...whoAmIResult,
        credentialBundle: credentialBundle,
        sessionExpiry: Date.now() + Number(expirationSeconds) * 1000,
      };
      console.log(
        "TurnkeyBrowserClient loginWithAuthBundle readWriteSessionResultWithSession",
        readWriteSessionResultWithSession
      );
      await saveSession(readWriteSessionResultWithSession, this.authClient);
      return true;
    } catch {
      return false;
    }
  };
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
    config: Record<any, any> = {}
  ): Promise<Passkey> => {
    console.log("passkeyClient createUserPasskey");
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
    expirationSeconds: string = DEFAULT_SESSION_EXPIRATION_IN_SECONDS,
    organizationId?: string
  ): Promise<ReadWriteSession> => {
    console.log("passkeyClient createPasskeySession");
    const user = await getStorageValue(StorageKeys.UserSession);
    organizationId = organizationId ?? user?.organization.organizationId;

    if (!organizationId) {
      throw new Error(
        "Error creating passkey session: Organization ID is required"
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
    console.log("passkeyClient createPasskeySession saveSession");
    await saveSession(
      {
        organizationId,
        organizationName: user?.organization.organizationName ?? "",
        userId,
        username: user?.username ?? "",
        credentialBundle,
        sessionExpiry: expiry,
      },
      this.authClient
    );

    return {
      credentialBundle,
      expiry,
    };
  };
}

/**
 * TurnkeyIframeClient is a client that uses an iframe to interact with the Turnkey API.
 * It is used to create read-write sessions, and to inject credential bundles into the iframe.
 * It is also used to extract encrypted credential bundles from the iframe.
 * @extends TurnkeyBrowserClient
 */
export class TurnkeyIframeClient extends TurnkeyBrowserClient {
  iframePublicKey: string | null;

  constructor(config: TurnkeySDKClientConfig) {
    super(config, AuthClient.Iframe);
    this.iframePublicKey = (this.stamper as IframeStamper).iframePublicKey;
  }

  injectCredentialBundle = async (
    credentialBundle: string
  ): Promise<boolean> => {
    console.log("iframeClient injectCredentialBundle");
    return await (this.stamper as IframeStamper).injectCredentialBundle(
      credentialBundle
    );
  };

  injectWalletExportBundle = async (
    credentialBundle: string,
    organizationId: string
  ): Promise<boolean> => {
    console.log("iframeClient injectWalletExportBundle");
    return await (this.stamper as IframeStamper).injectWalletExportBundle(
      credentialBundle,
      organizationId
    );
  };

  injectKeyExportBundle = async (
    credentialBundle: string,
    organizationId: string,
    keyFormat?: KeyFormat | undefined
  ): Promise<boolean> => {
    console.log("iframeClient injectKeyExportBundle");
    return await (this.stamper as IframeStamper).injectKeyExportBundle(
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
    console.log("iframeClient injectImportBundle");
    return await (this.stamper as IframeStamper).injectImportBundle(
      bundle,
      organizationId,
      userId
    );
  };

  extractWalletEncryptedBundle = async (): Promise<string> => {
    console.log("iframeClient extractWalletEncryptedBundle");
    return await (this.stamper as IframeStamper).extractWalletEncryptedBundle();
  };

  extractKeyEncryptedBundle = async (): Promise<string> => {
    console.log("iframeClient extractKeyEncryptedBundle");
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

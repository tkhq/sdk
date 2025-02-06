import { TurnkeySDKClientBase } from "../__generated__/sdk-client-base";
import type * as SdkApiTypes from "../__generated__/sdk_api_types";
import { type TurnkeySDKClientConfig, AuthClient } from "../__types__/base";
import { DEFAULT_SESSION_EXPIRATION_IN_SECONDS } from "../sdk-client";
import { Session, saveSession, storeSession } from "../storage";
import { TurnkeyIframeClient } from "./iframe-client";
import { TurnkeyPasskeyClient } from "./passkey-client";

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
      config || {}
    );

    await saveSession(readOnlySessionResult, this.authClient);

    return readOnlySessionResult!;
  };

  //// NEW ///

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
    sessionType: string, // TODO make this an enum and default to rw
    targetPublicKey?: string, //eventually we want to automatically pull this from localStorage/iframe
    expirationSeconds: string = DEFAULT_SESSION_EXPIRATION_IN_SECONDS
  ): Promise<void> => {
    if (sessionType == "r") {
      if (this! instanceof TurnkeyPasskeyClient) {
        throw new Error(
          "You must use a passkey client to refresh a read session"
        ); //TODO support wallet clients perhaps?
      }
      const readOnlySessionResult = await this.createReadOnlySession({});
      const session: Session = {
        sessionType: "r",
        userId: readOnlySessionResult.userId,
        organizationId: readOnlySessionResult.organizationId,
        expiry: Number(readOnlySessionResult.sessionExpiry),
        token: readOnlySessionResult.session,
      };
      storeSession(session, AuthClient.Passkey);
    }
    if (sessionType == "rw") {
      if (!targetPublicKey) {
        throw new Error(
          "You must provide a targetPublicKey to refresh a read-write session."
        );
      }
      const readWriteSessionResult = await this.createReadWriteSession({
        targetPublicKey,
        expirationSeconds,
        // invalidateExisting: true We need to add this to the API
      });
      const session: Session = {
        sessionType: "rw",
        userId: readWriteSessionResult.userId,
        organizationId: readWriteSessionResult.organizationId,
        expiry: Date.now() + Number(expirationSeconds) * 1000, //TODO change this to the actual expiry time from the response in a new version of the activity
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
      sessionType: "rw",
      userId: whoAmI.userId,
      organizationId: whoAmI.organizationId,
      expiry: Date.now() + Number(expirationSeconds) * 1000, //TODO change this to the actual expiry time
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
    sessionType: string, // TODO make this an enum
    targetPublicKey?: string, //eventually we want to automatically pull this from localStorage/iframe
    expirationSeconds: string = DEFAULT_SESSION_EXPIRATION_IN_SECONDS
  ): Promise<void> => {
    if (this! instanceof TurnkeyPasskeyClient) {
      throw new Error(
        "You must use a passkey client to log in with a passkey."
      );
    }

    // Create a read-only session

    if (sessionType == "r") {
      const readOnlySessionResult = await this.createReadOnlySession({});

      const session: Session = {
        sessionType: "r",
        userId: readOnlySessionResult.userId,
        organizationId: readOnlySessionResult.organizationId,
        expiry: Number(readOnlySessionResult.sessionExpiry),
        token: readOnlySessionResult.session,
      };
      storeSession(session, AuthClient.Passkey);
    }
    // Create a read-write session

    if (sessionType == "rw") {
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
        sessionType: "rw",
        userId: readWriteSessionResult.userId,
        organizationId: readWriteSessionResult.organizationId,
        expiry: Date.now() + Number(expirationSeconds) * 1000, //TODO change this to the actual expiry time from the response in a new version of the activity
        token: readWriteSessionResult.credentialBundle,
      };
      // TODO we need to inject the credential bundle in the iframe here
      storeSession(session, AuthClient.Iframe);
    } else {
      throw new Error("Invalid session type passed.");
    }
  };
  //// NEW ///

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
    expirationSeconds: string = DEFAULT_SESSION_EXPIRATION_IN_SECONDS
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
}

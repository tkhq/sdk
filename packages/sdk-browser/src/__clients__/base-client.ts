import type { TurnkeySDKClientConfig, AuthClient, SessionType } from "@types";

import { Session, saveSession } from "@storage";

import { TurnkeySDKClientBase } from "../__generated__/sdk-client-base";
import type * as SdkApiTypes from "../__generated__/sdk_api_types";
import { DEFAULT_SESSION_EXPIRATION_IN_SECONDS } from "@constants";

export abstract class TurnkeyBaseClient extends TurnkeySDKClientBase {
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
  abstract refereshSession(
    sessionType: SessionType,
    targetPublicKey?: string, //eventually we want to automatically pull this from localStorage/iframe
    expirationSeconds?: string // TODO = DEFAULT_SESSION_EXPIRATION_IN_SECONDS
  ): Promise<void>;

  /**
   * Log in with a bundle. This method uses a bundle sent to the end user email
   * To be used in conjunction with an `iframeStamper`.
   *
   * @param bundle
   * @param expirationSeconds
   * @returns {Promise<void>}
   */
  // abstract loginWithBundle(
  //   bundle: string, // we need a way to get the expiry of this token. Either it lives in the token itself or is returned from the server action and passed again here
  //   expirationSeconds: string // we need a way to get the expiry of this token. Either it lives in the token itself or is returned from the server action and passed again here
  // ): Promise<void>;

  /**
   * Log in with a session object. This method uses a session object from server actions and stores it and the active client in local storage
   * To be used in conjunction with an `iframeStamper`.
   *
   * @param session
   * @returns {Promise<SdkApiTypes.void>}
   */
  abstract loginWithSession(session: Session): Promise<void>;

  /**
   * Log in with a passkey.
   * To be used in conjunction with a `passkeyStamper`
   *
   * @param session
   * @returns {Promise<void>}
   */
  abstract loginWithPasskey(
    sessionType: SessionType,
    targetPublicKey?: string, //eventually we want to automatically pull this from localStorage/iframe
    expirationSeconds?: string // TODO = DEFAULT_SESSION_EXPIRATION_IN_SECONDS
  ): Promise<void>;

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

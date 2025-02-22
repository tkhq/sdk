import { WalletStamper, type WalletInterface } from "@turnkey/wallet-stamper";
import { IframeStamper } from "@turnkey/iframe-stamper";
import { WebauthnStamper } from "@turnkey/webauthn-stamper";

import { VERSION } from "./__generated__/version";
import WindowWrapper from "./__polyfills__/window";
import {
  type GrpcStatus,
  type TurnkeySDKBrowserConfig,
  TurnkeyRequestError,
  Stamper,
  IframeClientParams,
} from "@types";

import type { User, SubOrganization, ReadWriteSession } from "@models";
import { StorageKeys, getStorageValue, removeStorageValue } from "@storage";

import { TurnkeyWalletClient } from "@wallet-client";
import { TurnkeyBrowserClient } from "@browser-client";

import { TurnkeyIframeClient } from "@iframe-client";
import { TurnkeyPasskeyClient } from "@passkey-client";

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
    allowCredentials?: PublicKeyCredentialDescriptor[]
  ): TurnkeyPasskeyClient => {
    const targetRpId =
      rpId ?? this.config.rpId ?? WindowWrapper.location.hostname;

    if (!targetRpId) {
      throw new Error(
        "Tried to initialize a passkey client with no rpId defined"
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
   *
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
    await removeStorageValue(StorageKeys.Client);
    await removeStorageValue(StorageKeys.Session);

    return true;
  };
}

// export class TurnkeyBrowserClient extends TurnkeySDKClientBase {
//   authClient?: AuthClient | undefined;

//   constructor(config: TurnkeySDKClientConfig, authClient?: AuthClient) {
//     super(config);
//     this.authClient = authClient;
//   }

//   login = async (config?: {
//     organizationId?: string;
//   }): Promise<SdkApiTypes.TCreateReadOnlySessionResponse> => {
//     const readOnlySessionResult = await this.createReadOnlySession(
//       config || {}
//     );

//     await saveSession(readOnlySessionResult, this.authClient);

//     return readOnlySessionResult!;
//   };

//   //// NEW ///

//   /**
//    * Creates a read-write session. This method infers the current user's organization ID and target userId.
//    * To be used in conjunction with an `iframeStamper`: the resulting session's credential bundle can be
//    * injected into an iframeStamper to create a session that enables both read and write requests.
//    *
//    * @param targetEmbeddedKey
//    * @param expirationSeconds
//    * @param userId
//    * @returns {Promise<SdkApiTypes.TCreateReadWriteSessionResponse>}
//    */
//   refereshSession = async (
//     sessionType: string, // TODO make this an enum and default to rw
//     targetPublicKey?: string, //eventually we want to automatically pull this from localStorage/iframe
//     expirationSeconds: string = DEFAULT_SESSION_EXPIRATION
//   ): Promise<void> => {
//     if (sessionType == "r") {
//       if (this! instanceof TurnkeyPasskeyClient) {
//         throw new Error(
//           "You must use a passkey client to refresh a read session"
//         ); //TODO support wallet clients perhaps?
//       }
//       const readOnlySessionResult = await this.createReadOnlySession({});
//       const session: Session = {
//         sessionType: "r",
//         userId: readOnlySessionResult.userId,
//         organizationId: readOnlySessionResult.organizationId,
//         expiry: Number(readOnlySessionResult.sessionExpiry),
//         token: readOnlySessionResult.session,
//       };
//       storeSession(session, AuthClient.Passkey);
//     }
//     if (sessionType == "rw") {
//       if (!targetPublicKey) {
//         throw new Error(
//           "You must provide a targetPublicKey to refresh a read-write session."
//         );
//       }
//       const readWriteSessionResult = await this.createReadWriteSession({
//         targetPublicKey,
//         expirationSeconds,
//         // invalidateExisting: true We need to add this to the API
//       });
//       const session: Session = {
//         sessionType: "rw",
//         userId: readWriteSessionResult.userId,
//         organizationId: readWriteSessionResult.organizationId,
//         expiry: Date.now() + Number(expirationSeconds) * 1000, //TODO change this to the actual expiry time from the response in a new version of the activity
//         token: readWriteSessionResult.credentialBundle,
//       };
//       if (this instanceof TurnkeyIframeClient) {
//         await this.injectCredentialBundle(session.token!);
//       } else {
//         // Throw an error if the client is not an iframe client
//         throw new Error(
//           "You must use an iframe client to refresh a read-write session"
//         ); //should we default to a "localStorage" client?
//       }
//       storeSession(session, AuthClient.Iframe);
//     }
//   };

//   /**
//    * Log in with a bundle. This method uses a bundle sent to the end user email
//    * To be used in conjunction with an `iframeStamper`.
//    *
//    * @param bundle
//    * @param expirationSeconds
//    * @returns {Promise<void>}
//    */
//   loginWithBundle = async (
//     bundle: string, // we need a way to get the expiry of this token. Either it lives in the token itself or is returned from the server action and passed again here
//     expirationSeconds: string // we need a way to get the expiry of this token. Either it lives in the token itself or is returned from the server action and passed again here
//   ): Promise<void> => {
//     if (this! instanceof TurnkeyIframeClient) {
//       await this.injectCredentialBundle(bundle);
//     } else {
//       // Throw an error if the client is not an iframe client
//       throw new Error(
//         "You must use an iframe client to log in with a session."
//       ); //should we default to a "localStorage" client?
//     }
//     const whoAmI = await this.getWhoami();

//     const session: Session = {
//       sessionType: "rw",
//       userId: whoAmI.userId,
//       organizationId: whoAmI.organizationId,
//       expiry: Date.now() + Number(expirationSeconds) * 1000, //TODO change this to the actual expiry time
//       token: bundle,
//     };
//     storeSession(session, AuthClient.Iframe);
//   };

//   /**
//    * Log in with a session object. This method uses a session object from server actions and stores it and the active client in local storage
//    * To be used in conjunction with an `iframeStamper`.
//    *
//    * @param session
//    * @returns {Promise<SdkApiTypes.void>}
//    */
//   loginWithSession = async (session: Session): Promise<void> => {
//     if (this instanceof TurnkeyIframeClient) {
//       await this.injectCredentialBundle(session.token!);
//     } else {
//       // Throw an error if the client is not an iframe client
//       throw new Error(
//         "You must use an iframe client to log in with a session."
//       ); //should we default to a "localStorage" client?
//     }
//     storeSession(session, AuthClient.Iframe);
//   };

//   /**
//    * Log in with a passkey.
//    * To be used in conjunction with a `passkeyStamper`
//    *
//    * @param session
//    * @returns {Promise<void>}
//    */
//   loginWithPasskey = async (
//     sessionType: string, // TODO make this an enum
//     targetPublicKey?: string, //eventually we want to automatically pull this from localStorage/iframe
//     expirationSeconds: string = DEFAULT_SESSION_EXPIRATION
//   ): Promise<void> => {
//     if (this! instanceof TurnkeyPasskeyClient) {
//       throw new Error(
//         "You must use a passkey client to log in with a passkey."
//       );
//     }

//     // Create a read-only session

//     if (sessionType == "r") {
//       const readOnlySessionResult = await this.createReadOnlySession({});

//       const session: Session = {
//         sessionType: "r",
//         userId: readOnlySessionResult.userId,
//         organizationId: readOnlySessionResult.organizationId,
//         expiry: Number(readOnlySessionResult.sessionExpiry),
//         token: readOnlySessionResult.session,
//       };
//       storeSession(session, AuthClient.Passkey);
//     }
//     // Create a read-write session

//     if (sessionType == "rw") {
//       if (!targetPublicKey) {
//         throw new Error(
//           "You must provide a targetPublicKey to create a read-write session."
//         );
//       }
//       const readWriteSessionResult = await this.createReadWriteSession({
//         targetPublicKey,
//         expirationSeconds,
//       });

//       const session: Session = {
//         sessionType: "rw",
//         userId: readWriteSessionResult.userId,
//         organizationId: readWriteSessionResult.organizationId,
//         expiry: Date.now() + Number(expirationSeconds) * 1000, //TODO change this to the actual expiry time from the response in a new version of the activity
//         token: readWriteSessionResult.credentialBundle,
//       };
//       // TODO we need to inject the credential bundle in the iframe here
//       storeSession(session, AuthClient.Iframe);
//     } else {
//       throw new Error("Invalid session type passed.");
//     }
//   };
//   //// NEW ///

//   /**
//    * Creates a read-write session. This method infers the current user's organization ID and target userId.
//    * To be used in conjunction with an `iframeStamper`: the resulting session's credential bundle can be
//    * injected into an iframeStamper to create a session that enables both read and write requests.
//    *
//    * @param targetEmbeddedKey
//    * @param expirationSeconds
//    * @param userId
//    * @returns {Promise<SdkApiTypes.TCreateReadWriteSessionResponse>}
//    */
//   loginWithReadWriteSession = async (
//     targetEmbeddedKey: string,
//     expirationSeconds: string = DEFAULT_SESSION_EXPIRATION,
//     userId?: string
//   ): Promise<SdkApiTypes.TCreateReadWriteSessionResponse> => {
//     const readWriteSessionResult = await this.createReadWriteSession({
//       targetPublicKey: targetEmbeddedKey,
//       expirationSeconds,
//       userId: userId!,
//     });

//     // Ensure session and sessionExpiry are included in the object
//     const readWriteSessionResultWithSession = {
//       ...readWriteSessionResult,
//       credentialBundle: readWriteSessionResult.credentialBundle,
//       sessionExpiry: Date.now() + Number(expirationSeconds) * 1000,
//     };

//     // store auth bundle in local storage
//     await saveSession(readWriteSessionResultWithSession, this.authClient);

//     return readWriteSessionResultWithSession;
//   };

//   /**
//    * Logs in with an existing auth bundle. this bundle enables both read and write requests.
//    *
//    * @param credentialBundle
//    * @param expirationSeconds
//    * @returns {Promise<boolean>}
//    */
//   loginWithAuthBundle = async (
//     credentialBundle: string,
//     expirationSeconds: string = DEFAULT_SESSION_EXPIRATION
//   ): Promise<any> => {
//     try {
//       const whoAmIResult = await this.getWhoami();

//       const readWriteSessionResultWithSession = {
//         ...whoAmIResult,
//         credentialBundle: credentialBundle,
//         sessionExpiry: Date.now() + Number(expirationSeconds) * 1000,
//       };
//       await saveSession(readWriteSessionResultWithSession, this.authClient);
//       return true;
//     } catch {
//       return false;
//     }
//   };
// }

// export class TurnkeyPasskeyClient extends TurnkeyBrowserClient {
//   rpId: string;

//   constructor(config: TurnkeySDKClientConfig) {
//     super(config, AuthClient.Passkey);
//     this.rpId = (this.stamper as WebauthnStamper)!.rpId;
//   }

//   /**
//    * Create a passkey for an end-user, taking care of various lower-level details.
//    *
//    * @returns {Promise<Passkey>}
//    */
//   createUserPasskey = async (
//     config: Record<any, any> = {}
//   ): Promise<Passkey> => {
//     const challenge = generateRandomBuffer();
//     const encodedChallenge = base64UrlEncode(challenge);
//     const authenticatorUserId = generateRandomBuffer();

//     // WebAuthn credential options options can be found here:
//     // https://www.w3.org/TR/webauthn-2/#sctn-sample-registration
//     //
//     // All pubkey algorithms can be found here: https://www.iana.org/assignments/cose/cose.xhtml#algorithms
//     // Turnkey only supports ES256 (-7) and RS256 (-257)
//     //
//     // The pubkey type only supports one value, "public-key"
//     // See https://www.w3.org/TR/webauthn-2/#enumdef-publickeycredentialtype for more details
//     // TODO: consider un-nesting these config params
//     const webauthnConfig: CredentialCreationOptions = {
//       publicKey: {
//         rp: {
//           id: config.publicKey?.rp?.id ?? this.rpId,
//           name: config.publicKey?.rp?.name ?? "",
//         },
//         challenge: config.publicKey?.challenge ?? challenge,
//         pubKeyCredParams: config.publicKey?.pubKeyCredParams ?? [
//           {
//             type: "public-key",
//             alg: -7,
//           },
//           {
//             type: "public-key",
//             alg: -257,
//           },
//         ],
//         user: {
//           id: config.publicKey?.user?.id ?? authenticatorUserId,
//           name: config.publicKey?.user?.name ?? "Default User",
//           displayName: config.publicKey?.user?.displayName ?? "Default User",
//         },
//         authenticatorSelection: {
//           authenticatorAttachment:
//             config.publicKey?.authenticatorSelection?.authenticatorAttachment ??
//             undefined, // default to empty
//           requireResidentKey:
//             config.publicKey?.authenticatorSelection?.requireResidentKey ??
//             true,
//           residentKey:
//             config.publicKey?.authenticatorSelection?.residentKey ?? "required",
//           userVerification:
//             config.publicKey?.authenticatorSelection?.userVerification ??
//             "preferred",
//         },
//       },
//     };

//     const attestation = await getWebAuthnAttestation(webauthnConfig);

//     return {
//       encodedChallenge: config.publicKey?.challenge
//         ? base64UrlEncode(config.publicKey?.challenge)
//         : encodedChallenge,
//       attestation,
//     };
//   };

//   /**
//    * Uses passkey authentication to create a read-write session, via an embedded API key,
//    * and stores + returns the resulting auth bundle that contains the encrypted API key.
//    * This auth bundle (also referred to as a credential bundle) can be injected into an `iframeStamper`,
//    * resulting in a touch-free authenticator. Unlike `loginWithReadWriteSession`, this method
//    * assumes the end-user's organization ID (i.e. the sub-organization ID) is already known.
//    *
//    * @param userId
//    * @param targetEmbeddedKey
//    * @param expirationSeconds
//    * @param curveType
//    * @returns {Promise<ReadWriteSession>}
//    */
//   createPasskeySession = async (
//     userId: string,
//     targetEmbeddedKey: string,
//     expirationSeconds: string = DEFAULT_SESSION_EXPIRATION,
//     organizationId?: string
//   ): Promise<ReadWriteSession> => {
//     const user = await getStorageValue(StorageKeys.UserSession);
//     organizationId = organizationId ?? user?.organization.organizationId;

//     if (!organizationId) {
//       throw new Error(
//         "Error creating passkey session: Organization ID is required"
//       );
//     }

//     userId = userId ?? user?.userId;

//     const { authBundle: credentialBundle, publicKey } =
//       await createEmbeddedAPIKey(targetEmbeddedKey);

//     // add API key to Turnkey User
//     await this.createApiKeys({
//       organizationId,
//       userId,
//       apiKeys: [
//         {
//           apiKeyName: `Session Key ${String(Date.now())}`,
//           publicKey,
//           expirationSeconds,
//           curveType: "API_KEY_CURVE_P256",
//         },
//       ],
//     });

//     const expiry = Date.now() + Number(expirationSeconds) * 1000;

//     await saveSession(
//       {
//         organizationId,
//         organizationName: user?.organization.organizationName ?? "",
//         userId,
//         username: user?.username ?? "",
//         credentialBundle,
//         sessionExpiry: expiry,
//       },
//       this.authClient
//     );

//     return {
//       credentialBundle,
//       expiry,
//     };
//   };
// }

// export class TurnkeyIframeClient extends TurnkeyBrowserClient {
//   iframePublicKey: string | null;

//   constructor(config: TurnkeySDKClientConfig) {
//     super(config, AuthClient.Iframe);
//     this.iframePublicKey = (this.stamper as IframeStamper).iframePublicKey;
//   }

//   injectCredentialBundle = async (
//     credentialBundle: string
//   ): Promise<boolean> => {
//     return await (this.stamper as IframeStamper).injectCredentialBundle(
//       credentialBundle
//     );
//   };

//   injectWalletExportBundle = async (
//     credentialBundle: string,
//     organizationId: string
//   ): Promise<boolean> => {
//     return await (this.stamper as IframeStamper).injectWalletExportBundle(
//       credentialBundle,
//       organizationId
//     );
//   };

//   injectKeyExportBundle = async (
//     credentialBundle: string,
//     organizationId: string,
//     keyFormat?: KeyFormat | undefined
//   ): Promise<boolean> => {
//     return await (this.stamper as IframeStamper).injectKeyExportBundle(
//       credentialBundle,
//       organizationId,
//       keyFormat
//     );
//   };

//   injectImportBundle = async (
//     bundle: string,
//     organizationId: string,
//     userId: string
//   ): Promise<boolean> => {
//     return await (this.stamper as IframeStamper).injectImportBundle(
//       bundle,
//       organizationId,
//       userId
//     );
//   };

//   extractWalletEncryptedBundle = async (): Promise<string> => {
//     return await (this.stamper as IframeStamper).extractWalletEncryptedBundle();
//   };

//   extractKeyEncryptedBundle = async (): Promise<string> => {
//     return await (this.stamper as IframeStamper).extractKeyEncryptedBundle();
//   };
// }

// export class TurnkeyWalletClient extends TurnkeyBrowserClient {
//   private wallet: WalletInterface;

//   constructor(config: TurnkeyWalletClientConfig) {
//     super(config, AuthClient.Wallet);
//     this.wallet = config.wallet;
//   }

//   async getPublicKey(): Promise<string> {
//     return this.wallet.getPublicKey();
//   }

//   getWalletInterface(): WalletInterface {
//     return this.wallet;
//   }
// }

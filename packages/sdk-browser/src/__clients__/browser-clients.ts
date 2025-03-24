import type { WalletInterface } from "@turnkey/wallet-stamper";
import type { IframeStamper, KeyFormat } from "@turnkey/iframe-stamper";
import type { WebauthnStamper } from "@turnkey/webauthn-stamper";
import { getWebAuthnAttestation } from "@turnkey/http";

import type * as SdkApiTypes from "../__generated__/sdk_api_types";
import { TurnkeyBaseClient } from "../__clients__/base-client";

import {
  Session,
  AuthClient,
  TurnkeySDKClientConfig,
  SessionType,
  TurnkeyWalletClientConfig,
  ReadWriteSession,
  LoginWithBundleParams,
  LoginWithPasskeyParams,
  LoginWithWalletParams,
  RefreshSessionParams,
} from "@types";

import {
  generateRandomBuffer,
  base64UrlEncode,
  createEmbeddedAPIKey,
} from "@utils";

import type { Passkey } from "@models";

import {
  StorageKeys,
  getStorageValue,
  saveSession,
  storeSession,
} from "@storage";

import { DEFAULT_SESSION_EXPIRATION_IN_SECONDS } from "@constants";

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
interface UpdateUserAuthParams {
  userId: string;
  phoneNumber?: string | null; // string to set, null to delete
  email?: string | null; // string to set, null to delete
  authenticators?: {
    add?: Authenticator[]; // Authenticator objects to create
    deleteIds?: string[]; // Authenticator IDs to delete
  };
  oauthProviders?: {
    add?: OauthProvider[]; // OAuth provider objects to create
    deleteIds?: string[]; // OAuth provider IDs to delete
  };
  apiKeys?: {
    add?: ApiKey[]; // API key objects to create
    deleteIds?: string[]; // API key IDs to delete
  };
}

interface DeleteUserAuthParams {
  userId: string; // Unique identifier of the user
  phoneNumber?: boolean; // true to remove the phone number
  email?: boolean; // true to remove the email
  authenticatorIds?: string[]; // Array of authenticator IDs to remove
  oauthProviderIds?: string[]; // Array of OAuth provider IDs to remove
  apiKeyIds?: string[]; // Array of API key IDs to remove
}

interface AddUserAuthParams {
  userId: string; // Unique identifier of the user
  phoneNumber?: string; // New phone number to set
  email?: string; // New email address to set
  authenticators?: Authenticator[]; // Array of authenticator objects to add
  oauthProviders?: OauthProvider[]; // Array of OAuth provider objects to add
  apiKeys?: ApiKey[]; // Array of API key objects to add
}
export class TurnkeyBrowserClient extends TurnkeyBaseClient {
  constructor(config: TurnkeySDKClientConfig, authClient?: AuthClient) {
    super(config, authClient);
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
   * Attempts to refresh an existing Session. This method infers the current user's organization ID and target userId.
   * This will use a passkeyStamper for `READ_ONLY` sessions or an `iframeStamper` for `READ_WRITE` sessions.
   *
   * @param RefreshSessionParams
   *   @param params.sessionType - The type of session that is being refreshed
   *   @param params.targetPublicKey - The public key of the target client
   *   @param params.expirationSeconds - Specify how long to extend the session. Defaults to 900 seconds or 15 minutes.
   * @returns {Promise<void>}
   */
  refreshSession = async (params: RefreshSessionParams): Promise<void> => {
    const {
      sessionType = SessionType.READ_WRITE,
      targetPublicKey,
      expirationSeconds = DEFAULT_SESSION_EXPIRATION_IN_SECONDS,
    } = params;

    try {
      if (sessionType === SessionType.READ_ONLY) {
        if (this! instanceof TurnkeyPasskeyClient) {
          throw new Error(
            "You must use a passkey client to refresh a read session",
          ); // TODO: support wallet client
        }
        const readOnlySessionResult = await this.createReadOnlySession({});
        const session: Session = {
          sessionType: SessionType.READ_ONLY,
          userId: readOnlySessionResult.userId,
          organizationId: readOnlySessionResult.organizationId,
          expiry: Number(readOnlySessionResult.sessionExpiry),
          token: readOnlySessionResult.session,
        };

        await storeSession(session, AuthClient.Passkey);
      } else if (sessionType === SessionType.READ_WRITE) {
        if (!targetPublicKey) {
          throw new Error(
            "You must provide a targetPublicKey to refresh a read-write session.",
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
          expiry: Date.now() + Number(expirationSeconds) * 1000,
          token: readWriteSessionResult.credentialBundle,
        };
        if (this instanceof TurnkeyIframeClient) {
          await this.injectCredentialBundle(session.token!);
        } else {
          // Throw an error if the client is not an iframe client
          throw new Error(
            "You must use an iframe client to refresh a read-write session",
          );
        }
        await storeSession(session, AuthClient.Iframe);
      } else {
        throw new Error(`Invalid session type passed: ${sessionType}`);
      }
    } catch (error) {
      throw new Error(`Unable to refresh session: ${error}`);
    }
  };

  /**
   * Log in with a bundle. This method uses a bundle sent to the end user email
   * To be used in conjunction with an `iframeStamper`.
   *
   * @param LoginWithBundleParams
   *   @param params.bundle - Credential bundle to log in with
   *   @param params.expirationSeconds - Expiration time for the session in seconds. Defaults to 900 seconds or 15 minutes.
   * @returns {Promise<void>}
   */
  loginWithBundle = async (params: LoginWithBundleParams): Promise<void> => {
    const {
      bundle,
      expirationSeconds = DEFAULT_SESSION_EXPIRATION_IN_SECONDS,
    } = params;
    if (this! instanceof TurnkeyIframeClient) {
      await this.injectCredentialBundle(bundle);
    } else {
      // Throw an error if the client is not an iframe client
      throw new Error(
        "You must use an iframe client to log in with a session.",
      ); //should we default to a "localStorage" client?
    }
    const whoAmI = await this.getWhoami();

    const session: Session = {
      sessionType: SessionType.READ_WRITE,
      userId: whoAmI.userId,
      organizationId: whoAmI.organizationId,
      expiry: Date.now() + Number(expirationSeconds) * 1000,
      token: bundle,
    };

    await storeSession(session, AuthClient.Iframe);
  };

  /**
   * Log in with a session object. This method uses a session object from server actions and stores it and the active client in local storage
   * To be used in conjunction with an `iframeStamper`.
   *
   * @param session
   * @returns {Promise<void>}
   */
  loginWithSession = async (session: Session): Promise<void> => {
    if (this instanceof TurnkeyIframeClient) {
      await this.injectCredentialBundle(session.token!);
    } else {
      // Throw an error if the client is not an iframe client
      throw new Error(
        "You must use an iframe client to log in with a session.",
      ); //should we default to a "localStorage" client?
    }
    await storeSession(session, AuthClient.Iframe);
  };

  /**
   * Log in with a passkey.
   * To be used in conjunction with a `passkeyStamper`
   *
   * @param LoginWithPasskeyParams
   *   @param params.sessionType - The type of session to create
   *   @param params.iframeClient - The iframe client to use to inject the credential bundle
   *   @param params.targetPublicKey - The public key of the target client
   *   @param params.expirationSeconds - Expiration time for the session in seconds. Defaults to 900 seconds or 15 minutes.
   * @returns {Promise<void>}
   */
  loginWithPasskey = async (params: LoginWithPasskeyParams): Promise<void> => {
    try {
      const {
        sessionType = SessionType.READ_WRITE,
        iframeClient,
        targetPublicKey,
        expirationSeconds = DEFAULT_SESSION_EXPIRATION_IN_SECONDS,
      } = params;
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
        await storeSession(session, AuthClient.Passkey);
        // Create a read-write session
      } else if (sessionType === SessionType.READ_WRITE) {
        if (!targetPublicKey) {
          throw new Error(
            "You must provide a targetPublicKey to create a read-write session.",
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
          expiry: Date.now() + Number(expirationSeconds) * 1000,
          token: readWriteSessionResult.credentialBundle,
        };

        if (!iframeClient) {
          throw new Error(
            "You must provide an iframe client to log in with a passkey.",
          );
        }
        await iframeClient.injectCredentialBundle(session.token!);

        await storeSession(session, AuthClient.Iframe);
      } else {
        throw new Error(`Invalid session type passed: ${sessionType}`);
      }
    } catch (error) {
      throw new Error(`Unable to log in with the provided passkey: ${error}`);
    }
  };

  /**
   * Log in with a browser wallet.
   *
   * @param LoginWithWalletParams
   *   @param params.sessionType - The type of session to create
   *   @param params.iframeClient - The iframe client to use to inject the credential bundle
   *   @param params.targetPublicKey - The public key of the target iframe
   *   @param params.expirationSeconds - The expiration time for the session in seconds
   * @returns {Promise<void>}
   */
  loginWithWallet = async (params: LoginWithWalletParams): Promise<void> => {
    try {
      const {
        sessionType = SessionType.READ_WRITE,
        iframeClient,
        targetPublicKey,
        expirationSeconds = DEFAULT_SESSION_EXPIRATION_IN_SECONDS,
      } = params;
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
        await storeSession(session, AuthClient.Wallet);
        // Create a read-write session
      } else if (sessionType === SessionType.READ_WRITE) {
        if (!targetPublicKey) {
          throw new Error(
            "You must provide a targetPublicKey to create a read-write session.",
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
          expiry: Date.now() + Number(expirationSeconds) * 1000,
          token: readWriteSessionResult.credentialBundle,
        };

        if (!iframeClient) {
          throw new Error(
            "You must provide an iframe client to log in with a wallet.",
          );
        }
        await iframeClient.injectCredentialBundle(session.token!);

        await storeSession(session, AuthClient.Iframe);
      } else {
        throw new Error(`Invalid session type passed: ${sessionType}`);
      }
    } catch (error) {
      throw new Error(`Unable to log in with the provided wallet: ${error}`);
    }
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
    expirationSeconds: string = DEFAULT_SESSION_EXPIRATION_IN_SECONDS,
    userId?: string,
  ): Promise<SdkApiTypes.TCreateReadWriteSessionResponse> => {
    try {
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
    } catch (error) {
      throw new Error(
        `Unable to log in with the provided read-write session: ${error}`,
      );
    }
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
    expirationSeconds: string = DEFAULT_SESSION_EXPIRATION_IN_SECONDS,
  ): Promise<boolean> => {
    try {
      const whoAmIResult = await this.getWhoami();

      const readWriteSessionResultWithSession = {
        ...whoAmIResult,
        credentialBundle: credentialBundle,
        sessionExpiry: Date.now() + Number(expirationSeconds) * 1000,
      };

      await saveSession(readWriteSessionResultWithSession, this.authClient);
      return true;
    } catch (error) {
      throw new Error(
        `Unable to log in with the provided auth bundle: ${error}`,
      );
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
   * @param params - A structured object containing all the removal parameters
   *   @param params.userId - Unique identifier of the user
   *   @param params.phoneNumber - true to remove the phone number
   *   @param params.email - true to remove the email
   *   @param params.authenticatorIds - Array of authenticator IDs to remove
   *   @param params.oauthProviderIds - Array of OAuth provider IDs to remove
   *   @param params.apiKeyIds - Array of API key IDs to remove
   * @returns A promise that resolves to an array of results from each removal operation
   */
  deleteUserAuth = async (params: DeleteUserAuthParams): Promise<any[]> => {
    try {
      const {
        userId,
        phoneNumber,
        email,
        authenticatorIds,
        oauthProviderIds,
        apiKeyIds,
      } = params;
      const promises: Promise<any>[] = [];

      if (phoneNumber) {
        promises.push(
          this.updateUser({ userId, userPhoneNumber: "", userTagIds: [] }),
        );
      }
      if (email) {
        promises.push(
          this.updateUser({ userId, userEmail: "", userTagIds: [] }),
        );
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
      return await Promise.all(promises);
    } catch (error) {
      // Surface error
      throw error;
    }
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
   * @param params - A structured object containing all the addition/update parameters
   *   @param params.userId - Unique identifier of the user
   *   @param params.phoneNumber - New phone number for the user
   *   @param params.email - New email address for the user
   *   @param params.authenticators - Array of authenticator objects to create
   *   @param params.oauthProviders - Array of OAuth provider objects to create
   *   @param params.apiKeys - Array of API key objects to create
   * @returns A promise that resolves to an array of results from each addition or update
   */
  addUserAuth = async (params: AddUserAuthParams): Promise<any[]> => {
    try {
      const {
        userId,
        phoneNumber,
        email,
        authenticators,
        oauthProviders,
        apiKeys,
      } = params;
      const promises: Promise<any>[] = [];

      if (phoneNumber) {
        promises.push(
          this.updateUser({
            userId,
            userPhoneNumber: phoneNumber,
            userTagIds: [],
          }),
        );
      }
      if (email) {
        promises.push(
          this.updateUser({ userId, userEmail: email, userTagIds: [] }),
        );
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

      // Execute all additions/updates operations in parallel
      return await Promise.all(promises);
    } catch (error) {
      // Surface error
      throw error;
    }
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
    try {
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
      // or separate calls if only one is changing.
      const userUpdates: { userPhoneNumber?: string; userEmail?: string } = {};

      if (phoneNumber !== undefined) {
        userUpdates.userPhoneNumber = phoneNumber === null ? "" : phoneNumber;
      }
      if (email !== undefined) {
        userUpdates.userEmail = email === null ? "" : email;
      }
      if (Object.keys(userUpdates).length > 0) {
        promises.push(
          this.updateUser({ userId, ...userUpdates, userTagIds: [] }),
        );
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
    } catch (error) {
      // Surface error
      throw error;
    }
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
    expirationSeconds: string = DEFAULT_SESSION_EXPIRATION_IN_SECONDS,
    organizationId?: string,
  ): Promise<ReadWriteSession> => {
    try {
      const session = await getStorageValue(StorageKeys.Session);
      organizationId = organizationId ?? session?.organizationId;
      userId = userId ?? session?.userId;

      if (!organizationId) {
        throw new Error(
          "Error creating passkey session: Organization ID is required",
        );
      }

      if (!userId) {
        throw new Error("Error creating passkey session: User ID is required");
      }

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

      const whoAmI = await this.getWhoami();
      const expiry = Date.now() + Number(expirationSeconds) * 1000;

      await saveSession(
        {
          organizationId,
          organizationName: whoAmI?.organizationName ?? "",
          userId,
          username: whoAmI?.username ?? "",
          credentialBundle,
          sessionExpiry: expiry,
        },
        this.authClient,
      );

      return {
        credentialBundle,
        expiry,
      };
    } catch (error) {
      throw new Error("Unable to create passkey session.");
    }
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

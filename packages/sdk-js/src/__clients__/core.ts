import { IndexedDbStamper } from "@turnkey/indexed-db-stamper";
import { TurnkeySDKClientBase } from "../__generated__/sdk-client-base";
import { WebauthnStamper } from "@turnkey/webauthn-stamper";
import WindowWrapper from "@polyfills/window";
import { SessionType, Session } from "@turnkey/sdk-types";
import {
  LoginWithPasskeyParams,
  DEFAULT_SESSION_EXPIRATION_IN_SECONDS,
  Passkey,
  StamperType,
} from "@types"; // AHHHH, SDK-TYPES
import { base64UrlEncode, generateRandomBuffer } from "@utils";
import { getWebAuthnAttestation } from "@turnkey/http";
import { createStorageManager, StorageBase } from "../__storage__/base";

export class TurnkeyClient {
  config: any; // Type TBD
  httpClient!: TurnkeySDKClientBase;

  // TODO (Amir): Make these private
  indexedDBStamper: IndexedDbStamper | undefined;
  passkeyStamper: WebauthnStamper | undefined;

  storageManager!: StorageBase;

  constructor(
    config: any,
    indexedDBStamper?: IndexedDbStamper,
    passkeyStamper?: WebauthnStamper,
  ) {
    this.config = config;
    this.indexedDBStamper = indexedDBStamper || new IndexedDbStamper();
    this.passkeyStamper =
      passkeyStamper ||
      new WebauthnStamper({
        rpId: config?.passkeyConfig?.rpId ?? WindowWrapper.location.hostname,
        ...(config?.passkeyConfig?.timeout !== undefined && {
          timeout: config?.passkeyConfig?.timeout,
        }),
        ...(config?.passkeyConfig?.userVerification !== undefined && {
          userVerification: config?.passkeyConfig?.userVerification,
        }),
        ...(config?.passkeyConfig?.allowCredentials !== undefined && {
          allowCredentials: config?.passkeyConfig?.allowCredentials,
        }),
      });

    // storageManager will be initialized asynchronously
  }

  async init() {
    await this.indexedDBStamper?.init();
    this.storageManager = await createStorageManager();

    this.httpClient = new TurnkeySDKClientBase({
      stamper: this.indexedDBStamper, // Maybe we should rename this
      passkeyStamper: this.passkeyStamper,
      storageManager: this.storageManager,
      ...this.config,
    });
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
          id: config.publicKey?.rp?.id ?? this.passkeyStamper?.rpId,
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
            this.passkeyStamper?.userVerification ??
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
   * Log in with a passkey.
   * To be used in conjunction with a `passkeyStamper`
   *
   * @param LoginWithPasskeyParams
   *   @param params.sessionType - The type of session to create
   *   @param params.publicKey - The public key of indexedDb
   *   @param params.expirationSeconds - Expiration time for the session in seconds. Defaults to 900 seconds or 15 minutes.
   * @returns {Promise<void>}
   */
  loginWithPasskey = async (params: LoginWithPasskeyParams): Promise<void> => {
    try {
      await this.indexedDBStamper?.resetKeyPair();
      const {
        sessionType = SessionType.READ_WRITE,
        publicKey = this.indexedDBStamper?.getPublicKey(),
        expirationSeconds = DEFAULT_SESSION_EXPIRATION_IN_SECONDS,
      } = params;
      // Create a read-only session
      if (sessionType === SessionType.READ_ONLY) {
        const readOnlySessionResult =
          await this.httpClient.createReadOnlySession({}, StamperType.Passkey);

        const session: Session = {
          sessionType: SessionType.READ_ONLY,
          userId: readOnlySessionResult.userId,
          organizationId: readOnlySessionResult.organizationId,
          expiry: Number(readOnlySessionResult.sessionExpiry),
          token: readOnlySessionResult.session, // Once we have api key session scopes this can change
        };
        await this.storageManager.storeSession(session);
        // Create a read-write session
      } else if (sessionType === SessionType.READ_WRITE) {
        if (!publicKey) {
          throw new Error(
            "You must provide a publicKey to create a passkey read write session.",
          );
        }

        const sessionResponse = await this.httpClient.stampLogin(
          {
            publicKey,
            expirationSeconds,
          },
          StamperType.Passkey,
        );

        const whoamiResponse = await this.httpClient.getWhoami({});

        const session: Session = {
          // Let's keep consistent with storing the actual session object rather than just the token
          sessionType: SessionType.READ_ONLY,
          userId: whoamiResponse.userId,
          organizationId: whoamiResponse.organizationId,
          expiry: Number(expirationSeconds),
          token: sessionResponse.session,
        };

        await this.storageManager.storeSession(session);
      } else {
        throw new Error(`Invalid session type passed: ${sessionType}`);
      }
    } catch (error) {
      throw new Error(`Unable to log in with the provided passkey: ${error}`);
    }
  };
}

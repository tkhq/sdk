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
import {
  base64UrlEncode,
  generateRandomBuffer,
  getPubKeyFromToken,
  isReactNative,
  isWeb,
} from "@utils";
import { getWebAuthnAttestation } from "@turnkey/http";
import {
  createStorageManager,
  StorageBase,
  SessionKey,
} from "../__storage__/base";
import { CrossPlatformApiKeyStamper } from "../__stampers__/base";

export class TurnkeyClient {
  config: any; // Type TBD
  httpClient!: TurnkeySDKClientBase;

  // public session?: Session | undefined;  // TODO (Amir): Define session type
  // public user?: any; // TODO (Amir): Define user type
  // public wallets?: any; // TODO (Amir): Define wallets type

  private apiKeyStamper?: CrossPlatformApiKeyStamper | undefined;
  private passkeyStamper?: WebauthnStamper | undefined;
  private mobilePasskeyStamper?: any | undefined; // TODO (Amir): Implement proper type

  storageManager!: StorageBase;

  constructor(
    config: any,

    // Users can pass in their own stampers, or we will create them. Should we remove this?
    apiKeyStamper?: CrossPlatformApiKeyStamper,
    passkeyStamper?: WebauthnStamper,
    mobilePasskeyStamper?: any // TODO: Add proper type
  ) {
    this.config = config;

    // Just store any explicitly provided stampers
    this.apiKeyStamper = apiKeyStamper;
    this.passkeyStamper = passkeyStamper;
    this.mobilePasskeyStamper = mobilePasskeyStamper;

    // Actual initialization will happen in init()
  }

  async init() {
    // Initialize platform-specific stampers
    if (isWeb()) {
      if (!this.passkeyStamper) {
        this.passkeyStamper = new WebauthnStamper({
          rpId:
            this.config?.passkeyConfig?.rpId ?? WindowWrapper.location.hostname,
          ...(this.config?.passkeyConfig?.timeout !== undefined && {
            timeout: this.config?.passkeyConfig?.timeout,
          }),
          ...(this.config?.passkeyConfig?.userVerification !== undefined && {
            userVerification: this.config?.passkeyConfig?.userVerification,
          }),
          ...(this.config?.passkeyConfig?.allowCredentials !== undefined && {
            allowCredentials: this.config?.passkeyConfig?.allowCredentials,
          }),
        });
      }
    } else if (isReactNative()) {
      if (!this.mobilePasskeyStamper) {
        // TODO: Initialize mobilePasskeyStamper
        // this.mobilePasskeyStamper = new MobilePasskeyStamper();
      }
    }

    // Initialize storage manager
    this.storageManager = await createStorageManager();

    this.apiKeyStamper = new CrossPlatformApiKeyStamper(this.storageManager);

    // Initialize the HTTP client with the appropriate stampers
    this.httpClient = new TurnkeySDKClientBase({
      stamper: this.apiKeyStamper,
      passkeyStamper: isWeb() ? this.passkeyStamper : this.mobilePasskeyStamper,
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
    config: Record<any, any> = {}
  ): Promise<Passkey> => {
    // TODO (Amir): Make this work for mobile as well
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

  loginWithPasskey = async (params: LoginWithPasskeyParams): Promise<void> => {
    try {
      const generatedPublicKey = await this.apiKeyStamper?.createKeyPair();
      const {
        sessionType = SessionType.READ_WRITE,
        publicKey = generatedPublicKey,
        expirationSeconds = DEFAULT_SESSION_EXPIRATION_IN_SECONDS,
        sessionKey = SessionKey.DefaultSessionkey,
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
        await this.storageManager.storeSession(session, sessionKey);
        // Create a read-write session
      } else if (sessionType === SessionType.READ_WRITE) {
        if (!publicKey) {
          throw new Error(
            "You must provide a publicKey to create a passkey read write session."
          );
        }
        const sessionResponse = await this.httpClient.stampLogin(
          {
            publicKey,
            expirationSeconds,
          },
          StamperType.Passkey
        );

        // TODO (Amir): This should be done in a helper or something. It's very strange that we have to delete the key pair here
        const sessionToReplace =
          await this.storageManager.getSession(sessionKey);
        if (sessionToReplace) {
          const pubkey = getPubKeyFromToken(sessionToReplace.token);
          await this.apiKeyStamper?.deleteKeyPair(pubkey);
        }

        await this.storageManager.storeSession(
          {
            /// THIS IS SO DUMB!
            sessionType: SessionType.READ_WRITE,
            expiry: Number(expirationSeconds),
            token: sessionResponse.session,
          } as any,
          sessionKey
        );

        const whoamiResponse = await this.httpClient.getWhoami({});

        const session: Session = {
          // Note (Amir): Let's keep consistent with storing the actual session object rather than just the token
          sessionType: SessionType.READ_ONLY,
          userId: whoamiResponse.userId,
          organizationId: whoamiResponse.organizationId,
          expiry: Number(expirationSeconds),
          token: sessionResponse.session,
        };

        await this.storageManager.storeSession(session, sessionKey);
      } else {
        throw new Error(`Invalid session type passed: ${sessionType}`);
      }
    } catch (error) {
      throw new Error(`Unable to log in with the provided passkey: ${error}`);
    }
  };
}

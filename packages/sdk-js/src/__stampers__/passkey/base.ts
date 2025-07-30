import { generateRandomBuffer, isReactNative, isWeb } from "@utils";
import type { Passkey, TStamp, TStamper, TPasskeyStamperConfig } from "@types";
import { WebauthnStamper } from "@turnkey/webauthn-stamper";
import {
  base64StringToBase64UrlEncodedString,
  uint8ArrayToHexString,
} from "@turnkey/encoding";
import { getWebAuthnAttestation, TurnkeyApiTypes } from "@turnkey/http";
import { v4 as uuidv4 } from "uuid";

let PasskeyStamperModule: typeof import("@turnkey/react-native-passkey-stamper");

export type TurnkeyAuthenticatorParams =
  TurnkeyApiTypes["v1AuthenticatorParamsV2"];

export class CrossPlatformPasskeyStamper implements TStamper {
  private stamper!: TStamper;
  private config: TPasskeyStamperConfig;

  constructor(config: TPasskeyStamperConfig) {
    // Use init method to set up the stamper based on the platform. It's async, so can't be done in the constructor.
    this.config = config;
  }

  async init(): Promise<void> {
    if (isWeb()) {
      const { default: WindowWrapper } = await import("@polyfills/window");

      this.stamper = new WebauthnStamper({
        ...this.config,
        rpId: this.config.rpId ?? WindowWrapper.location.hostname,
      });
    } else if (isReactNative()) {
      try {
        // Dynamic import to prevent bundling the native module in web environments.
        let PasskeyStamper;
        try {
          PasskeyStamperModule = require("@turnkey/react-native-passkey-stamper");
          PasskeyStamper = PasskeyStamperModule.PasskeyStamper;
        } catch {
          throw new Error(
            "Please install react-native-passkeys and @turnkey/react-native-passkey-stamper in your app to use passkeys.",
          );
        }

        this.stamper = new PasskeyStamper({
          ...this.config,
          rpId: this.config.rpId!,
          allowCredentials: this.config.allowCredentials?.map((cred) => ({
            id: uint8ArrayToHexString(cred.id as Uint8Array),
            type: cred.type,
            transports: cred.transports,
          })) as any,
        });
      } catch (error) {
        throw new Error(
          `Failed to load passkey stamper for react-native: ${error}`,
        );
      }
    } else {
      throw new Error("Unsupported platform for passkey stamper");
    }
  }

  async stamp(payload: string): Promise<TStamp> {
    return await this.stamper.stamp(payload);
  }

  /**
   * Create a passkey for an end-user, taking care of various lower-level details.
   *
   * @returns {Promise<Passkey>}
   */
  createWebPasskey = async (
    config: Record<any, any> = {},
  ): Promise<Passkey> => {
    const challenge = generateRandomBuffer();
    const encodedChallenge = base64StringToBase64UrlEncodedString(
      btoa(String.fromCharCode(...new Uint8Array(challenge))),
    );
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
          id: config.publicKey?.rp?.id ?? this.config.rpId,
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
        ? base64StringToBase64UrlEncodedString(config.publicKey?.challenge)
        : encodedChallenge,
      attestation,
    };
  };

  createReactNativePasskey = async (
    config: Record<any, any> = {},
  ): Promise<TurnkeyAuthenticatorParams> => {
    const { name, displayName } = config;
    const { createPasskey } = PasskeyStamperModule; // We do a 'selective' import when initializing the stamper. This is safe to do here.

    if (!createPasskey) {
      throw new Error(
        "Ensure you have @turnkey/react-native-passkey-stamper installed and linked correctly. Are you not on React Native?",
      );
    }

    return await createPasskey({
      rp: {
        id: this.config.rpId!,
        name: this.config.rpName ?? "Turnkey",
      },
      user: {
        id: uuidv4(),
        name,
        displayName,
      },
      authenticatorName: "End-User Passkey",
    });
  };
}

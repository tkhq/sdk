import {
  Passkey,
  PasskeyCreateResult,
  PasskeyGetResult,
} from "react-native-passkey";
import type { TurnkeyApiTypes } from "@turnkey/http";
import { base64StringToBase64UrlEncodedString as base64Tobase64url } from "@turnkey/encoding";
import { getChallengeFromPayload, getRandomChallenge } from "./util";

/**
 * https://www.w3.org/TR/webauthn-2/#dictionary-credential-descriptor
 * Copied from https://github.com/f-23/react-native-passkey/blob/17184a1b1f6f3ac61e07aa784c9b64efb28b570e/src/Passkey.tsx#L80C1-L85C2
 * TODO: can we import this type instead?
 */
export interface PublicKeyCredentialDescriptor {
  type: string;
  id: string;
  transports?: Array<AuthenticatorTransport>;
}

export enum AuthenticatorTransport {
  usb = "usb",
  nfc = "nfc",
  ble = "ble",
  smartCard = "smart-card",
  hybrid = "hybrid",
  internal = "internal",
}

/**
 * Authenticator params expected by the Turnkey API (for authenticator, user, or sub-organization creation)
 */
export type TurnkeyAuthenticatorParams =
  TurnkeyApiTypes["v1AuthenticatorParamsV2"];

/**
 * Header name for a webauthn stamp
 */
const stampHeaderName = "X-Stamp-Webauthn";

export type TPasskeyRegistrationConfig = {
  // The RPID ("Relying Party ID") for your app.
  // See https://github.com/f-23/react-native-passkey?tab=readme-ov-file#configuration to set this up.
  rp: {
    id: string;
    name: string;
  };

  // Properties for passkey display: user name and email will show up in the prompts
  user: {
    id: string;
    name: string;
    displayName: string;
  };

  // Name of the authenticator (affects Turnkey only, won't be shown on passkey prompts)
  // TODO: document restrictions on character sets
  authenticatorName: string;

  // Optional challenge. If not provided, a new random challenge will be generated
  challenge?: string;

  // Optional timeout value. Defaults to 5 minutes.
  timeout?: number;

  // Optional override for UV flag. Defaults to "preferred".
  userVerification?: UserVerificationRequirement;

  // Optional list of credentials to exclude from registration. Defaults to empty
  excludeCredentials?: PublicKeyCredentialDescriptor[];

  // Authenticator selection params
  // Defaults if not passed:
  // - authenticatorAttachment: undefined
  //   (users can enroll yubikeys -- aka "cross-platform authenticator" -- or "platform" authenticator like faceID)
  // - requireResidentKey: true
  // - residentKey: "required"
  // - userVerification: "preferred"
  authenticatorSelection?: {
    authenticatorAttachment?: string;
    requireResidentKey?: boolean;
    residentKey?: string;
    userVerification?: string;
  };

  // Optional attestation param. Defaults to "none"
  attestation?: string;

  // Optional extensions. Defaults to empty.
  extensions?: Record<string, unknown>;
};

export type TPasskeyStamperConfig = {
  // The RPID ("Relying Party ID") for your app.
  // See https://github.com/f-23/react-native-passkey?tab=readme-ov-file#configuration to set this up.
  rpId: string;

  // Optional timeout value in milliseconds. Defaults to 5 minutes.
  timeout?: number;

  // Optional override for UV flag. Defaults to "preferred".
  userVerification?: UserVerificationRequirement;

  // Optional list of credentials to pass. Defaults to empty.
  allowCredentials?: PublicKeyCredentialDescriptor[];

  // Option to force security passkeys on native platforms
  withSecurityKey?: boolean;

  // Option to force platform passkeys on native platforms
  withPlatformKey?: boolean;

  // Optional extensions. Defaults to empty.
  extensions?: Record<string, unknown>;
};

const defaultTimeout = 5 * 60 * 1000; // five minutes
const defaultUserVerification = "preferred";

/**
 * Re-export of the underlying library's `isSupported` method
 */
export function isSupported(): boolean {
  return Passkey.isSupported();
}

// Context: https://github.com/f-23/react-native-passkey/issues/54
type BrokenPasskeyCreateResult = PasskeyCreateResult | string;
type BrokenPasskeyGetResult = PasskeyGetResult | string;

/**
 * Creates a passkey and returns authenticator params
 */
export async function createPasskey(
  config: TPasskeyRegistrationConfig,
  options?: {
    withSecurityKey: boolean;
    withPlatformKey: boolean;
  }
): Promise<TurnkeyAuthenticatorParams> {
  const challenge = config.challenge || getRandomChallenge();

  let createFn = options?.withPlatformKey
    ? Passkey.createPlatformKey
    : options?.withSecurityKey
    ? Passkey.createSecurityKey
    : Passkey.create;

  let registrationResult = await createFn({
    challenge: challenge,
    rp: config.rp,
    user: config.user,
    excludeCredentials: config.excludeCredentials || [],
    authenticatorSelection: config.authenticatorSelection || {
      requireResidentKey: true,
      residentKey: "required",
      userVerification: "preferred",
    },
    attestation: config.attestation || "none",
    extensions: config.extensions || {},
    // All algorithms can be found here: https://www.iana.org/assignments/cose/cose.xhtml#algorithms
    // We only support ES256 and RS256, which are listed below
    pubKeyCredParams: [
      {
        type: "public-key",
        alg: -7,
      },
      {
        type: "public-key",
        alg: -257,
      },
    ],
  });

  // See https://github.com/f-23/react-native-passkey/issues/54
  // On Android the typedef lies. Registration result is actually a string!
  // TODO: remove me once the above is resolved.
  const brokenRegistrationResult =
    registrationResult as BrokenPasskeyCreateResult;
  if (typeof brokenRegistrationResult === "string") {
    registrationResult = JSON.parse(brokenRegistrationResult);
  }

  return {
    authenticatorName: config.authenticatorName,
    challenge: challenge,
    attestation: {
      credentialId: base64Tobase64url(registrationResult.id),
      clientDataJson: base64Tobase64url(
        registrationResult.response.clientDataJSON
      ),
      attestationObject: base64Tobase64url(
        registrationResult.response.attestationObject
      ),
      // TODO: can we infer the transport from the registration result?
      // In all honesty this isn't critical so we default to "hybrid" because that's the transport used by passkeys.
      transports: ["AUTHENTICATOR_TRANSPORT_HYBRID"],
    },
  };
}

/**
 * Stamper to use with `@turnkey/http`'s `TurnkeyClient`
 */
export class PasskeyStamper {
  rpId: string;
  timeout: number;
  userVerification: UserVerificationRequirement;
  allowCredentials: PublicKeyCredentialDescriptor[];
  extensions: Record<string, unknown>;
  forcePlatformKey: boolean;
  forceSecurityKey: boolean;

  constructor(config: TPasskeyStamperConfig) {
    this.rpId = config.rpId;
    this.timeout = config.timeout || defaultTimeout;
    this.userVerification = config.userVerification || defaultUserVerification;
    this.allowCredentials = config.allowCredentials || [];
    this.extensions = config.extensions || {};
    this.forcePlatformKey = !!config.withPlatformKey;
    this.forceSecurityKey = !!config.withSecurityKey;
  }

  async stamp(payload: string) {
    const challenge = getChallengeFromPayload(payload);

    const signingOptions = {
      challenge: challenge,
      rpId: this.rpId,
      timeout: this.timeout,
      allowCredentials: this.allowCredentials,
      userVerification: this.userVerification,
      extensions: this.extensions,
    };

    let passkeyGetfn = this.forcePlatformKey
      ? Passkey.getPlatformKey
      : this.forceSecurityKey
      ? Passkey.getSecurityKey
      : Passkey.get;
    let authenticationResult = await passkeyGetfn(signingOptions);

    // See https://github.com/f-23/react-native-passkey/issues/54
    // On Android the typedef lies. Authentication result is actually a string!
    // TODO: remove me once the above is resolved.
    const brokenAuthenticationResult =
      authenticationResult as BrokenPasskeyGetResult;
    if (typeof brokenAuthenticationResult === "string") {
      authenticationResult = JSON.parse(brokenAuthenticationResult);
    }

    const stamp = {
      authenticatorData: base64Tobase64url(
        authenticationResult.response.authenticatorData
      ),
      clientDataJson: base64Tobase64url(
        authenticationResult.response.clientDataJSON
      ),
      credentialId: base64Tobase64url(authenticationResult.id),
      signature: base64Tobase64url(authenticationResult.response.signature),
    };

    return {
      stampHeaderName: stampHeaderName,
      stampHeaderValue: JSON.stringify(stamp),
    };
  }
}

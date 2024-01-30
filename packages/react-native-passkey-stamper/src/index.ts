/// <reference lib="dom" />
import { Passkey } from 'react-native-passkey';
import { sha256 } from "@noble/hashes/sha256";
import type { TurnkeyApiTypes } from "@turnkey/http";


// https://www.w3.org/TR/webauthn-2/#dictionary-credential-descriptor
// Copied from https://github.com/f-23/react-native-passkey/blob/17184a1b1f6f3ac61e07aa784c9b64efb28b570e/src/Passkey.tsx#L80C1-L85C2
// TODO: can we import this type instead?
interface PublicKeyCredentialDescriptor {
  type: string;
  id: string;
  transports?: Array<string>;
}

export type TurnkeyAuthenticatorParams = TurnkeyApiTypes["v1AuthenticatorParamsV2"]

// Header name for a webauthn stamp
const stampHeaderName = "X-Stamp-Webauthn";

export type TPasskeyRegistrationConfig = {
  // The RPID ("Relying Party ID") for your app.
  // See https://github.com/f-23/react-native-passkey?tab=readme-ov-file#configuration to set this up.
  rpId: string;
  rpName: string;
  // Properties for passkey display: user name and email will show up in the prompts
  user: {
    id: string,
    name: string,
    displayName: string,
  }
  // Name of the authenticator (affects Turnkey only, won't be shown on passkey prompts)
  // TODO: document restrictions on character sets
  authenticatorName: string,
  // Optional challenge. If not provided, a new random challenge will be generated
  challenge?: string;
  // Optional timeout value. Defaults to 5 minutes.
  timeout?: number;
  // Optional override for UV flag. Defaults to "preferred".
  userVerification?: UserVerificationRequirement;
  // Optional list of credentials to pass. Defaults to empty
  allowCredentials?: PublicKeyCredentialDescriptor[];
};

export type TPasskeyStamperConfig = {
  // The RPID ("Relying Party ID") for your app.
  // See https://github.com/f-23/react-native-passkey?tab=readme-ov-file#configuration to set this up.
  rpId: string;
  // Optional timeout value. Defaults to 5 minutes.
  timeout?: number;
  // Optional override for UV flag. Defaults to "preferred".
  userVerification?: UserVerificationRequirement;
  // Optional list of credentials to pass. Defaults to empty
  allowCredentials?: PublicKeyCredentialDescriptor[];
};

const defaultTimeout = 5 * 60 * 1000; // five minutes
const defaultUserVerification = "preferred";

/**
 * Creates a passkey and returns authenticator params
 */
export async function CreatePasskey(config: TPasskeyRegistrationConfig): Promise<TurnkeyAuthenticatorParams> {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  // TODO: this is probably not right? Need to find the right way to encode random bytes into a string
  const challenge = new TextDecoder("utf-8").decode(arr)

  const registrationResult = await Passkey.register({
    challenge: challenge,
    rp: {
      id: config.rpId,
      name: config.rpName,
    },
    user: config.user,
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
    ]
  });

  return {
    authenticatorName: config.authenticatorName,
    challenge: challenge,
    attestation: {
      credentialId: registrationResult.id,
      clientDataJson: registrationResult.response.clientDataJSON,
      attestationObject: registrationResult.response.attestationObject,
      transports: ["AUTHENTICATOR_TRANSPORT_HYBRID"],
    }
  }

}

/**
 * Stamper to use with `@turnkey/http`'s `TurnkeyClient`
 */
export class PasskeyStamper {
  rpId: string;
  timeout: number;
  userVerification: UserVerificationRequirement;
  allowCredentials: PublicKeyCredentialDescriptor[];

  constructor(config: TPasskeyStamperConfig) {
    this.rpId = config.rpId;
    this.timeout = config.timeout || defaultTimeout;
    this.userVerification = config.userVerification || defaultUserVerification;
    this.allowCredentials = config.allowCredentials || [];
  }

  async stamp(payload: string) {
    const challenge = getChallengeFromPayload(payload);

    // TODO: do we want to support extensions?
    const signingOptions = {
        challenge: challenge,
        rpId: this.rpId,
        timeout: this.timeout,
        allowCredentials: this.allowCredentials,
        userVerification: this.userVerification,
    };

    const authenticationResult = await Passkey.authenticate(signingOptions);

    const stamp = {
      authenticatorData: authenticationResult.response.authenticatorData,
      clientDataJson: authenticationResult.response.clientDataJSON,
      credentialId: authenticationResult.id,
      signature: authenticationResult.response.signature,
    };

    return {
      stampHeaderName: stampHeaderName,
      stampHeaderValue: JSON.stringify(stamp),
    };
  }
}

// Needs to return a base64-encoded string
function getChallengeFromPayload(payload: string): string {
  const messageBuffer = new TextEncoder().encode(payload);
  const hashBuffer = sha256(messageBuffer);
  const hexString = Buffer.from(hashBuffer).toString("hex");
  const hexBuffer = Buffer.from(hexString, "utf8");
  return hexBuffer.toString("base64")
}

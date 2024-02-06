/// <reference lib="dom" />
import { get as webauthnCredentialGet } from "./webauthn-json";
import { createHash } from "sha256-uint8array";

// Header name for a webauthn stamp
const stampHeaderName = "X-Stamp-Webauthn";

export type TWebauthnStamperConfig = {
  // The RPID ("Relying Party ID") for your origin.
  // For an origin named "https://www.example.com", the RPID is typically "example.com".
  // If you're testing on localhost, the RPID should be "localhost".
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
 * Stamper to use with `@turnkey/http`'s `TurnkeyClient`
 */
export class WebauthnStamper {
  rpId: string;
  timeout: number;
  userVerification: UserVerificationRequirement;
  allowCredentials: PublicKeyCredentialDescriptor[];

  constructor(config: TWebauthnStamperConfig) {
    this.rpId = config.rpId;
    this.timeout = config.timeout || defaultTimeout;
    this.userVerification = config.userVerification || defaultUserVerification;
    this.allowCredentials = config.allowCredentials || [];
  }

  async stamp(payload: string) {
    const challenge = getChallengeFromPayload(payload);

    const signingOptions: CredentialRequestOptions = {
      publicKey: {
        rpId: this.rpId,
        challenge: challenge,
        allowCredentials: this.allowCredentials,
        timeout: this.timeout,
        userVerification: this.userVerification,
      },
    };

    const clientGetResult = await webauthnCredentialGet(signingOptions);
    const assertion = clientGetResult.toJSON();

    const stamp = {
      authenticatorData: assertion.response.authenticatorData,
      clientDataJson: assertion.response.clientDataJSON,
      credentialId: assertion.id,
      signature: assertion.response.signature,
    };

    return {
      stampHeaderName: stampHeaderName,
      stampHeaderValue: JSON.stringify(stamp),
    };
  }
}

function getChallengeFromPayload(payload: string): Uint8Array {
  const hexString = createHash().update(payload).digest("hex");
  return new TextEncoder().encode(hexString);
}

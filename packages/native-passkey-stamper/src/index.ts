/// <reference lib="dom" />

import {
  Passkey,
  PasskeyRegistrationResult,
  PasskeyAuthenticationResult,
} from './Passkey';
import type { PasskeyError } from './PasskeyError';

export { Passkey, PasskeyError }
export type { PasskeyRegistrationResult, PasskeyAuthenticationResult };

// Header name for a webauthn stamp
const stampHeaderName = "X-Stamp-Webauthn";

export type TWebauthnStamperConfig = {
    // The RPID ("Relying Party ID") for your origin.
    // For an origin named "https://www.example.com", the RPID is typically "example.com".
    // If you're testing on localhost, the RPID should be "localhost".
    rpId: string;
    //challenge
    challenge: string;
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
export class NativePasskeyStamper {
    rpId: string;
    challenge: string;
    timeout: number;
    userVerification: UserVerificationRequirement;
    allowCredentials: PublicKeyCredentialDescriptor[];

    constructor(config: TWebauthnStamperConfig) {
        this.rpId = config.rpId;
        this.challenge = config.challenge;
        this.timeout = config.timeout || defaultTimeout;
        this.userVerification = config.userVerification || defaultUserVerification;
        this.allowCredentials = config.allowCredentials || [];
    }

    async stamp(payload: string) {

        const passKeyAuthRequest: PasskeyAuthenticationRequest = {
            challenge: payload,
            timeout: this.timeout,
            userVerification: this.userVerification,
            rpId: this.rpId,
        }

        const result = await Passkey.authenticate(passKeyAuthRequest);

        const stamp = {
            authenticatorData: base64UrlEncode(result.response.authenticatorData),
            clientDataJson: result.response.clientDataJSON,
            credentialId: base64UrlEncode(result.rawId),
            signature: base64UrlEncode(result.response.signature)
        };

        return {
            stampHeaderName: stampHeaderName,
            stampHeaderValue: JSON.stringify(stamp),
        };
    }
}


export async function stampWhoAmI(organizationId: string, timeout: number, userVerification: string, rpId: string) {

    const passKeyAuthRequest: PasskeyAuthenticationRequest = {
        challenge: JSON.stringify({
            organizationId: organizationId
        }),
        timeout: timeout,
        userVerification: userVerification,
        rpId: rpId,
    }

    const result = await Passkey.authenticate(passKeyAuthRequest);

    const stamp = {
        authenticatorData: base64UrlEncode(result.response.authenticatorData),
        clientDataJson: result.response.clientDataJSON,
        credentialId: base64UrlEncode(result.rawId),
        signature: base64UrlEncode(result.response.signature)
    };

    const fullUrl = 'https://api.turnkey.com/public/v1/query/whoami'

    return {
        body: JSON.stringify({
            organizationId: organizationId
        }),
        stamp: {
            stampHeaderName: stampHeaderName,
            stampHeaderValue: JSON.stringify(stamp),
        },
        url: fullUrl,
    };
}

export function base64UrlEncode(input: string): string {
  return input.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

/**
 * The FIDO2 Assertion Request
 *
 */
export interface PasskeyAuthenticationRequest {
  challenge: string;
  timeout: number;
  userVerification: string;
  rpId: string;
}
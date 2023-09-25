export declare class Passkey {
    /**
     * Creates a new Passkey
     *
     * @param request The FIDO2 Attestation Request in JSON format
     * @param options An object containing options for the registration process
     * @returns The FIDO2 Attestation Result in JSON format
     * @throws
     */
    static register(request: PasskeyRegistrationRequest, { withSecurityKey }?: {
        withSecurityKey: boolean;
    }): Promise<object>;
    /**
     * Authenticates using an existing Passkey
     *
     * @param request The FIDO2 Assertion Request in JSON format
     * @param options An object containing options for the authentication process
     * @returns The FIDO2 Assertion Result in JSON format
     * @throws
     */
    static authenticate(request: PasskeyAuthenticationRequest, { withSecurityKey }?: {
        withSecurityKey: boolean;
    }): Promise<PasskeyAuthenticationResult>;
    /**
     * Checks if Passkeys are supported on the current device
     *
     * @returns A boolean indicating whether Passkeys are supported
     */
    static isSupported(): Promise<boolean>;
}
/**
 * The available options for Passkey operations
 */
export interface PasskeyOptions {
    withSecurityKey: boolean;
}
/**
 * The FIDO2 Attestation Request
 */
export interface PasskeyRegistrationRequest {
    challenge: string;
    rp: {
        id: string;
        name?: string;
    };
    user: {
        id: string;
        name?: string;
        displayName: string;
    };
    pubKeyCredParams: Array<{
        type: string;
        alg: number;
    }>;
    timeout: number;
    attestation: string;
    authenticatorSelection: {
        authenticatorAttachment?: string;
        requireResidentKey?: boolean;
        residentKey?: string;
        userVerification?: string;
    };
}
/**
 * The FIDO2 Attestation Result
 */
export interface PasskeyRegistrationResult {
    id: string;
    rawId: string;
    type?: string;
    response: {
        clientDataJSON: string;
        attestationObject: string;
    };
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
/**
 * The FIDO2 Assertion Result
 */
export interface PasskeyAuthenticationResult {
    id: string;
    rawId: string;
    type?: string;
    response: {
        authenticatorData: string;
        clientDataJSON: string;
        signature: string;
        userHandle: string;
    };
}
//# sourceMappingURL=Passkey.d.ts.map
import type { PasskeyRegistrationRequest, PasskeyAuthenticationRequest, PasskeyAuthenticationResult } from './Passkey';
export declare class PasskeyiOS {
    /**
     * iOS implementation of the registration process
     *
     * @param request The FIDO2 Attestation Request in JSON format
     * @param withSecurityKey A boolean indicating wether a security key should be used for registration
     * @returns The FIDO2 Attestation Result in JSON format
     */
    static register(request: PasskeyRegistrationRequest, withSecurityKey?: boolean): Promise<object>;
    /**
     * Extracts the data required for the attestation process on iOS from a given request
     */
    private static prepareRegistrationRequest;
    /**
     * Transform the iOS-specific attestation result into a FIDO2 result
     */
    private static handleNativeRegistrationResult;
    /**
     * iOS implementation of the authentication process
     *
     * @param request The FIDO2 Assertion Request in JSON format
     * @param withSecurityKey A boolean indicating wether a security key should be used for authentication
     * @returns The FIDO2 Assertion Result in JSON format
     */
    static authenticate(request: PasskeyAuthenticationRequest, withSecurityKey?: boolean): Promise<PasskeyAuthenticationResult>;
    /**
     * Transform the iOS-specific assertion result into a FIDO2 result
     */
    private static handleNativeAuthenticationResult;
}
//# sourceMappingURL=PasskeyiOS.d.ts.map
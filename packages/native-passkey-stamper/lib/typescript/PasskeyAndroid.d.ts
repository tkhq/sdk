import type { PasskeyRegistrationResult, PasskeyAuthenticationResult, PasskeyRegistrationRequest, PasskeyAuthenticationRequest } from './Passkey';
export declare class PasskeyAndroid {
    /**
     * Android implementation of the registration process
     *
     * @param request The FIDO2 Attestation Request in JSON format
     * @returns The FIDO2 Attestation Result in JSON format
     */
    static register(request: PasskeyRegistrationRequest): Promise<PasskeyRegistrationResult>;
    /**
     * Android implementation of the authentication process
     *
     * @param request The FIDO2 Assertion Request in JSON format
     * @returns The FIDO2 Assertion Result in JSON format
     */
    static authenticate(request: PasskeyAuthenticationRequest): Promise<PasskeyAuthenticationResult>;
    /**
     * Prepares the attestation or assertion request for Android
     */
    static prepareRequest(request: {
        challenge: string;
    }): object;
    /**
     * Transform the attestation or assertion result
     */
    private static handleNativeResponse;
}
//# sourceMappingURL=PasskeyAndroid.d.ts.map
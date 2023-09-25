export interface PasskeyError {
    error: string;
    message: string;
}
export declare const UnknownError: PasskeyError;
export declare const NotSupportedError: PasskeyError;
export declare const RequestFailedError: PasskeyError;
export declare const UserCancelledError: PasskeyError;
export declare const InvalidChallengeError: PasskeyError;
export declare const InvalidUserIdError: PasskeyError;
export declare const NotConfiguredError: PasskeyError;
export declare const NoCredentialsError: PasskeyError;
export declare const InterruptedError: PasskeyError;
export declare const NativeError: (message?: string) => PasskeyError;
export declare function handleNativeError(_error: unknown): PasskeyError;
//# sourceMappingURL=PasskeyError.d.ts.map
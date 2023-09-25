export const UnknownError = {
  error: 'Unknown error',
  message: 'An unknown error occurred'
};
export const NotSupportedError = {
  error: 'NotSupported',
  message: 'Passkeys are not supported on this device. iOS 15 and above is required to use Passkeys'
};
export const RequestFailedError = {
  error: 'RequestFailed',
  message: 'The request failed. No Credentials were returned.'
};
export const UserCancelledError = {
  error: 'UserCancelled',
  message: 'The user cancelled the request.'
};
export const InvalidChallengeError = {
  error: 'InvalidChallenge',
  message: 'The provided challenge was invalid'
};
export const InvalidUserIdError = {
  error: 'InvalidUserId',
  message: 'The provided userId was invalid'
};
export const NotConfiguredError = {
  error: 'NotConfigured',
  message: 'Your app is not properly configured. Refer to the docs for help.'
};
export const NoCredentialsError = {
  error: 'NotCredentials',
  message: 'No viable credential is available for the the user.'
};
export const InterruptedError = {
  error: 'Interrupted',
  message: 'The operation was interrupted and may be retried.'
};
export const NativeError = function () {
  let message = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 'An unknown error occurred';
  return {
    error: 'Native error',
    message: message
  };
};
export function handleNativeError(_error) {
  if (typeof _error !== 'object') {
    return UnknownError;
  }
  const error = String(_error).split(' ')[1];
  switch (error) {
    case 'NotSupported':
      {
        return NotSupportedError;
      }
    case 'RequestFailed':
      {
        return RequestFailedError;
      }
    case 'UserCancelled':
      {
        return UserCancelledError;
      }
    case 'InvalidChallenge':
      {
        return InvalidChallengeError;
      }
    case 'NotConfigured':
      {
        return NotConfiguredError;
      }
    case 'Interrupted':
      {
        return InterruptedError;
      }
    case 'NoCredentials':
      {
        return NoCredentialsError;
      }
    case 'UnknownError':
      {
        return UnknownError;
      }
    default:
      {
        return NativeError(error);
      }
  }
}
//# sourceMappingURL=PasskeyError.js.map
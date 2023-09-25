"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.UserCancelledError = exports.UnknownError = exports.RequestFailedError = exports.NotSupportedError = exports.NotConfiguredError = exports.NoCredentialsError = exports.NativeError = exports.InvalidUserIdError = exports.InvalidChallengeError = exports.InterruptedError = void 0;
exports.handleNativeError = handleNativeError;
const UnknownError = {
  error: 'Unknown error',
  message: 'An unknown error occurred'
};
exports.UnknownError = UnknownError;
const NotSupportedError = {
  error: 'NotSupported',
  message: 'Passkeys are not supported on this device. iOS 15 and above is required to use Passkeys'
};
exports.NotSupportedError = NotSupportedError;
const RequestFailedError = {
  error: 'RequestFailed',
  message: 'The request failed. No Credentials were returned.'
};
exports.RequestFailedError = RequestFailedError;
const UserCancelledError = {
  error: 'UserCancelled',
  message: 'The user cancelled the request.'
};
exports.UserCancelledError = UserCancelledError;
const InvalidChallengeError = {
  error: 'InvalidChallenge',
  message: 'The provided challenge was invalid'
};
exports.InvalidChallengeError = InvalidChallengeError;
const InvalidUserIdError = {
  error: 'InvalidUserId',
  message: 'The provided userId was invalid'
};
exports.InvalidUserIdError = InvalidUserIdError;
const NotConfiguredError = {
  error: 'NotConfigured',
  message: 'Your app is not properly configured. Refer to the docs for help.'
};
exports.NotConfiguredError = NotConfiguredError;
const NoCredentialsError = {
  error: 'NotCredentials',
  message: 'No viable credential is available for the the user.'
};
exports.NoCredentialsError = NoCredentialsError;
const InterruptedError = {
  error: 'Interrupted',
  message: 'The operation was interrupted and may be retried.'
};
exports.InterruptedError = InterruptedError;
const NativeError = function () {
  let message = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 'An unknown error occurred';
  return {
    error: 'Native error',
    message: message
  };
};
exports.NativeError = NativeError;
function handleNativeError(_error) {
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
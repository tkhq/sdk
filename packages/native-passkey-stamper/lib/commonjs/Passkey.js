"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Passkey = void 0;
var _PasskeyError = require("./PasskeyError");
var _reactNative = require("react-native");
var _PasskeyAndroid = require("./PasskeyAndroid");
var _PasskeyiOS = require("./PasskeyiOS");
class Passkey {
  /**
   * Creates a new Passkey
   *
   * @param request The FIDO2 Attestation Request in JSON format
   * @param options An object containing options for the registration process
   * @returns The FIDO2 Attestation Result in JSON format
   * @throws
   */
  static async register(request) {
    let {
      withSecurityKey
    } = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {
      withSecurityKey: false
    };
    if (!Passkey.isSupported) {
      throw _PasskeyError.NotSupportedError;
    }
    if (_reactNative.Platform.OS === 'android') {
      return _PasskeyAndroid.PasskeyAndroid.register(request);
    }
    return _PasskeyiOS.PasskeyiOS.register(request, withSecurityKey);
  }

  /**
   * Authenticates using an existing Passkey
   *
   * @param request The FIDO2 Assertion Request in JSON format
   * @param options An object containing options for the authentication process
   * @returns The FIDO2 Assertion Result in JSON format
   * @throws
   */
  static async authenticate(request) {
    let {
      withSecurityKey
    } = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {
      withSecurityKey: false
    };
    if (!Passkey.isSupported) {
      throw _PasskeyError.NotSupportedError;
    }
    if (_reactNative.Platform.OS === 'android') {
      return _PasskeyAndroid.PasskeyAndroid.authenticate(request);
    }
    return _PasskeyiOS.PasskeyiOS.authenticate(request, withSecurityKey);
  }

  /**
   * Checks if Passkeys are supported on the current device
   *
   * @returns A boolean indicating whether Passkeys are supported
   */
  static async isSupported() {
    if (_reactNative.Platform.OS === 'android') {
      return _reactNative.Platform.Version > 28;
    }
    if (_reactNative.Platform.OS === 'ios') {
      return parseInt(_reactNative.Platform.Version, 10) > 15;
    }
    return false;
  }
}

/**
 * The available options for Passkey operations
 */

/**
 * The FIDO2 Attestation Request
 */

/**
 * The FIDO2 Attestation Result
 */

/**
 * The FIDO2 Assertion Request
 *
 */

/**
 * The FIDO2 Assertion Result
 */
exports.Passkey = Passkey;
//# sourceMappingURL=Passkey.js.map
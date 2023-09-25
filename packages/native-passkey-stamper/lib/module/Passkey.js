import { NotSupportedError } from './PasskeyError';
import { Platform } from 'react-native';
import { PasskeyAndroid } from './PasskeyAndroid';
import { PasskeyiOS } from './PasskeyiOS';
export class Passkey {
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
      throw NotSupportedError;
    }
    if (Platform.OS === 'android') {
      return PasskeyAndroid.register(request);
    }
    return PasskeyiOS.register(request, withSecurityKey);
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
      throw NotSupportedError;
    }
    if (Platform.OS === 'android') {
      return PasskeyAndroid.authenticate(request);
    }
    return PasskeyiOS.authenticate(request, withSecurityKey);
  }

  /**
   * Checks if Passkeys are supported on the current device
   *
   * @returns A boolean indicating whether Passkeys are supported
   */
  static async isSupported() {
    if (Platform.OS === 'android') {
      return Platform.Version > 28;
    }
    if (Platform.OS === 'ios') {
      return parseInt(Platform.Version, 10) > 15;
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
//# sourceMappingURL=Passkey.js.map
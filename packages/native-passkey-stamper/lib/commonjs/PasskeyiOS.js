"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.PasskeyiOS = void 0;
var _PasskeyError = require("./PasskeyError");
var _NativePasskey = require("./NativePasskey");
class PasskeyiOS {
  /**
   * iOS implementation of the registration process
   *
   * @param request The FIDO2 Attestation Request in JSON format
   * @param withSecurityKey A boolean indicating wether a security key should be used for registration
   * @returns The FIDO2 Attestation Result in JSON format
   */
  static async register(request) {
    let withSecurityKey = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
    // Extract the required data from the attestation request
    const {
      rpId,
      challenge,
      name,
      userID
    } = this.prepareRegistrationRequest(request);
    try {
      const response = await _NativePasskey.NativePasskey.register(rpId, challenge, name, userID, withSecurityKey);
      return this.handleNativeRegistrationResult(response);
    } catch (error) {
      throw (0, _PasskeyError.handleNativeError)(error);
    }
  }

  /**
   * Extracts the data required for the attestation process on iOS from a given request
   */
  static prepareRegistrationRequest(request) {
    return {
      rpId: request.rp.id,
      challenge: request.challenge,
      name: request.user.displayName,
      userID: request.user.id
    };
  }

  /**
   * Transform the iOS-specific attestation result into a FIDO2 result
   */
  static handleNativeRegistrationResult(result) {
    return {
      id: result.credentialID,
      rawId: result.credentialID,
      response: {
        clientDataJSON: result.response.rawClientDataJSON,
        attestationObject: result.response.rawAttestationObject
      }
    };
  }

  /**
   * iOS implementation of the authentication process
   *
   * @param request The FIDO2 Assertion Request in JSON format
   * @param withSecurityKey A boolean indicating wether a security key should be used for authentication
   * @returns The FIDO2 Assertion Result in JSON format
   */
  static async authenticate(request) {
    let withSecurityKey = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
    try {
      const response = await _NativePasskey.NativePasskey.authenticate(request.rpId, request.challenge, withSecurityKey);
      return this.handleNativeAuthenticationResult(response);
    } catch (error) {
      throw (0, _PasskeyError.handleNativeError)(error);
    }
  }

  /**
   * Transform the iOS-specific assertion result into a FIDO2 result
   */
  static handleNativeAuthenticationResult(result) {
    return {
      id: result.credentialID,
      rawId: result.credentialID,
      response: {
        clientDataJSON: result.response.rawClientDataJSON,
        authenticatorData: result.response.rawAuthenticatorData,
        signature: result.response.signature,
        userHandle: result.userID
      }
    };
  }
}
exports.PasskeyiOS = PasskeyiOS;
//# sourceMappingURL=PasskeyiOS.js.map
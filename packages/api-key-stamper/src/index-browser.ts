/// <reference lib="dom" />
import { TApiKeyStamperConfig, stampHeaderName } from "./common";
import { stringToBase64urlString } from "./encoding";

const signWithApiKey = require("./webcrypto").signWithApiKey;
export { signWithApiKey };

/**
 * Stamper to use with `@turnkey/http`'s `TurnkeyClient`
 */
export class ApiKeyStamper {
  apiPublicKey: string;
  apiPrivateKey: string;

  constructor(config: TApiKeyStamperConfig) {
    this.apiPublicKey = config.apiPublicKey;
    this.apiPrivateKey = config.apiPrivateKey;
  }

  async stamp(payload: string) {
    const signature = await signWithApiKey({
      publicKey: this.apiPublicKey,
      privateKey: this.apiPrivateKey,
      content: payload,
    });

    const stamp = {
      publicKey: this.apiPublicKey,
      scheme: "SIGNATURE_SCHEME_TK_API_P256",
      signature: signature,
    };

    return {
      stampHeaderName: stampHeaderName,
      stampHeaderValue: stringToBase64urlString(JSON.stringify(stamp)),
    };
  }
}

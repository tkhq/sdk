/// <reference lib="dom" />
import { stringToBase64urlString } from "@turnkey/encoding";
import { signWithApiKey } from "./purejs";

// Header name for an API key stamp
const stampHeaderName = "X-Stamp";

export type TApiKeyStamperConfig = {
  apiPublicKey: string;
  apiPrivateKey: string;
};

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

export { pointDecode } from "./tink/elliptic_curves";

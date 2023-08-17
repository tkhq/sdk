/// <reference lib="dom" />

import { stringToBase64urlString } from "./encoding";

// Header name for an API key stamp
const stampHeaderName = "X-Stamp";

export type TApiKeyStamperConfig = {
  apiPublicKey: string;
  apiPrivateKey: string;
};

/**
 * Signature function abstracting the differences between NodeJS and web environments for signing with API keys.
 */
let signWithApiKey: (input: {
  content: string;
  publicKey: string;
  privateKey: string;
}) => string;

if (typeof globalThis?.crypto?.subtle !== "undefined") {
  signWithApiKey = require("./webcrypto").signWithApiKey;
} else {
  signWithApiKey = require("./nodecrypto").signWithApiKey;
}
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

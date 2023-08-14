/// <reference lib="dom" />

export type TApiKeyStamperConfig = {
  apiPublicKey: string;
  apiPrivateKey: string;
}

/**
 * Signature function abstracting the differences between NodeJS and web environments for signing.
 */
export let signWithApiKey: (input: {
  content: string;
  publicKey: string;
  privateKey: string;
}) => string;

if (typeof globalThis?.crypto?.subtle !== "undefined") {
  signWithApiKey = require("./stamp.webcrypto").signWithApiKey;
} else {
  signWithApiKey = require("./stamp.node").signWithApiKey;
}

/**
 * Stamper to use with `@turnkey/http`'s `TurnkeyClient`
 */
export class ApiKeyStamper {
  apiPublicKey: string;
  apiPrivateKey: string;

  constructor(config: TApiKeyStamperConfig) {
    this.apiPublicKey = config.apiPublicKey
    this.apiPrivateKey = config.apiPrivateKey
  }

  async stamp(payload: string) {

    const signature = signWithApiKey({
      publicKey: this.apiPublicKey,
      privateKey: this.apiPrivateKey,
      content: payload,
    })

    const stamp = {
      publicKey: this.apiPublicKey,
      scheme: "SIGNATURE_SCHEME_TK_API_P256",
      signature: signature,
    };

    return JSON.stringify(stamp)
  }
}
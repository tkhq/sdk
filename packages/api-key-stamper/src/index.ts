/// <reference lib="dom" />
import { stringToBase64urlString } from "@turnkey/encoding";

// Header name for an API key stamp
const stampHeaderName = "X-Stamp";

export type TApiKeyStamperConfig = {
  apiPublicKey: string;
  apiPrivateKey: string;
  forceBrowserCrypto?: boolean;
};

// `window.document` ensures that we're in a browser context
// and `crypto.subtle` ensures that it supports the web crypto APIs
// Inspired by https://github.com/flexdinesh/browser-or-node/blob/master/src/index.ts
const isCryptoEnabledBrowser: boolean =
  typeof window !== "undefined" &&
  typeof window.document !== "undefined" &&
  typeof crypto !== "undefined" &&
  typeof crypto.subtle !== "undefined";

// Detects a real Node.js environment.
// Based on https://github.com/flexdinesh/browser-or-node
// Includes a check for `createSign` to avoid false positives in environments like Cloudflare Workers.
function detectIsNode(): boolean {
  try {
    const nodeCrypto = require("crypto");
    return (
      typeof process !== "undefined" &&
      process.versions?.node != null &&
      typeof nodeCrypto.createSign === "function"
    );
  } catch {
    return false;
  }
}

/**
 * Signature function abstracting the differences between NodeJS and web environments for signing with API keys.
 */
export const signWithApiKey = async (input: {
  content: string;
  publicKey: string;
  privateKey: string;
  forceBrowserCrypto?: boolean;
}): Promise<string> => {
  if (isCryptoEnabledBrowser || input.forceBrowserCrypto) {
    console.log("Using WebCrypto for signing with API key");
    const fn = await import("./webcrypto").then((m) => m.signWithApiKey);
    return fn(input);
  }

  if (detectIsNode()) {
    console.log("Using NodeJS crypto for signing with API key");
    const fn = await import("./nodecrypto").then((m) => m.signWithApiKey);
    return fn(input);
  }

  // If we don't have NodeJS or web crypto at our disposal, default to pure JS implementation
  // This is the case for old browsers and react native environments
  console.log("Using PureJS for signing with API key");
  const fn = await import("./purejs").then((m) => m.signWithApiKey);
  return fn(input);
};

/**
 * Stamper to use with `@turnkey/http`'s `TurnkeyClient`
 */
export class ApiKeyStamper {
  apiPublicKey: string;
  apiPrivateKey: string;
  forceBrowserCrypto: boolean;

  constructor(config: TApiKeyStamperConfig) {
    this.apiPublicKey = config.apiPublicKey;
    this.apiPrivateKey = config.apiPrivateKey;
    this.forceBrowserCrypto = config.forceBrowserCrypto ?? false;
  }

  async stamp(payload: string) {
    const signature = await signWithApiKey({
      publicKey: this.apiPublicKey,
      privateKey: this.apiPrivateKey,
      forceBrowserCrypto: this.forceBrowserCrypto,
      content: payload,
    });

    const stamp = {
      publicKey: this.apiPublicKey,
      scheme: "SIGNATURE_SCHEME_TK_API_P256",
      signature,
    };

    return {
      stampHeaderName,
      stampHeaderValue: stringToBase64urlString(JSON.stringify(stamp)),
    };
  }
}

export { pointDecode } from "./tink/elliptic_curves";

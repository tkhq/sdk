/// <reference lib="dom" />
import { stringToBase64urlString } from "@turnkey/encoding";

// Header name for an API key stamp
const stampHeaderName = "X-Stamp";

export type Runtime = "browser" | "node" | "purejs";

export type TApiKeyStamperConfig = {
  apiPublicKey: string;
  apiPrivateKey: string;
  runtimeOverride?: Runtime | undefined;
};

// `window.document` ensures that we're in a browser context
// and `crypto.subtle` ensures that it supports the web crypto APIs
// Inspired by https://github.com/flexdinesh/browser-or-node/blob/master/src/index.ts
const isCryptoEnabledBrowser: boolean =
  typeof window !== "undefined" &&
  typeof window.document !== "undefined" &&
  typeof crypto !== "undefined" &&
  typeof crypto.subtle !== "undefined";

// We check `process.versions.node`
// Taken from https://github.com/flexdinesh/browser-or-node/blob/master/src/index.ts
const isNode: boolean =
  typeof process !== "undefined" &&
  process.versions != null &&
  process.versions.node != null;

const detectRuntime = (): Runtime => {
  if (isCryptoEnabledBrowser) {
    return "browser";
  }

  if (isNode) {
    return "node";
  }

  // If we don't have NodeJS or web crypto at our disposal, default to pure JS implementation
  // This is the case for old browsers and react native environments
  return "purejs";
};

/**
 * Signature function abstracting the differences between NodeJS and web environments for signing with API keys.
 */
export const signWithApiKey = async (
  input: {
    content: string;
    publicKey: string;
    privateKey: string;
  },
  runtimeOverride?: Runtime | undefined,
): Promise<string> => {
  const runtime = runtimeOverride ?? detectRuntime();

  switch (runtime) {
    case "browser":
      return (await import("./webcrypto")).signWithApiKey(input);
    case "node":
      return (await import("./nodecrypto")).signWithApiKey(input);
    case "purejs":
      return (await import("./purejs")).signWithApiKey(input);
    default:
      throw new Error(`Unsupported runtime: ${runtime}`);
  }
};

/**
 * Stamper to use with `@turnkey/http`'s `TurnkeyClient`
 */
export class ApiKeyStamper {
  apiPublicKey: string;
  apiPrivateKey: string;
  runtimeOverride?: Runtime | undefined;

  constructor(config: TApiKeyStamperConfig) {
    this.apiPublicKey = config.apiPublicKey;
    this.apiPrivateKey = config.apiPrivateKey;
    this.runtimeOverride = config.runtimeOverride;
  }

  async stamp(payload: string) {
    const signature = await signWithApiKey(
      {
        publicKey: this.apiPublicKey,
        privateKey: this.apiPrivateKey,
        content: payload,
      },
      this.runtimeOverride,
    );

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

/// <reference lib="dom" />

// Header name for an API key stamp
const stampHeaderName = "X-Stamp";

type TStamp = {
  stampHeaderName: string;
  stampHeaderValue: string;
};

export type TIframeStamperConfig = {
  iframeUrl: string;
  iframeElementId: string;
  iframeContainerId: string;
};

/**
 * Stamper to use with `@turnkey/http`'s `TurnkeyClient`
 * Creating a stamper inserts an iframe in the current page.
 */
export class IframeStamper {
  container: HTMLElement;
  iframe: HTMLIFrameElement;
  iframeOrigin: string;
  iframePublicKey: string | null;

  /**
   * Creates a new iframe stamper. This function _does not_ insert the iframe in the DOM.
   * Call `.init()` to insert the iframe element in the DOM.
   */
  constructor(config: TIframeStamperConfig) {
    if (typeof window === "undefined") {
      throw new Error("Cannot initialize iframe in non-browser environment");
    }

    if (document.getElementById(config.iframeElementId)) {
      throw new Error(
        `Iframe element with ID ${config.iframeElementId} already exists`
      );
    }

    const container = document.getElementById(config.iframeContainerId);
    if (!container) {
      throw new Error(
        `Cannot create iframe stamper: no container with ID ${config.iframeContainerId} exists in the current document`
      );
    }
    this.container = container;

    var iframe = window.document.createElement("iframe");
    iframe.id = config.iframeElementId;
    iframe.src = config.iframeUrl;
    this.iframe = iframe;

    const iframeUrl = new URL(config.iframeUrl);
    this.iframeOrigin = iframeUrl.origin;

    // This is populated once the iframe is ready. Call `.init()` to kick off DOM insertion!
    this.iframePublicKey = null;
  }

  /**
   * Inserts the iframe on the page and returns a promise resolving to the iframe's public key
   */
  async init(): Promise<string> {
    this.container.appendChild(this.iframe);
    return new Promise((resolve, _reject) => {
      window.addEventListener(
        "message",
        (event) => {
          if (event.origin !== this.iframeOrigin) {
            // There might be other things going on in the window, for example: react dev tools, other extensions, etc.
            // Instead of erroring out
            return;
          }
          if (event.data && event.data["type"] == "PUBLIC_KEY_READY") {
            resolve(event.data["value"]);
            this.iframePublicKey = event.data["value"];
          }
        },
        false
      );
    });
  }

  /**
   * Removes the iframe from the DOM
   */
  clear() {
    this.iframe.remove();
  }

  /**
   * Returns the public key, or `null` if the underlying iframe isn't properly initialized.
   */
  publicKey(): string | null {
    return this.iframePublicKey;
  }

  /**
   * Function to inject a new credential into the iframe
   * The bundle should be encrypted to the iframe's initial public key
   * Encryption should be performed with HPKE (RFC 9180).
   * This is used during recovery flows.
   */
  async injectRecoveryBundle(bundle: string): Promise<boolean> {
    this.iframe.contentWindow?.postMessage(
      {
        type: "INJECT_RECOVERY_BUNDLE",
        value: bundle,
      },
      "*"
    );

    return new Promise((resolve, _reject) => {
      window.addEventListener(
        "message",
        (event) => {
          if (event.origin !== this.iframeOrigin) {
            // There might be other things going on in the window, for example: react dev tools, other extensions, etc.
            // Instead of erroring out we simply return. Not our event!
            return;
          }
          if (event.data && event.data["type"] == "BUNDLE_INJECTED") {
            resolve(event.data["value"]);
          }
        },
        false
      );
    });
  }

  /**
   * Function to sign a payload with the underlying iframe
   */
  async stamp(payload: string): Promise<TStamp> {
    if (this.iframePublicKey === null) {
      throw new Error(
        "null iframe public key. Have you called/awaited .init()?"
      );
    }

    const challenge = await getChallengeFromPayload(payload);
    const iframeOrigin = this.iframeOrigin;

    this.iframe.contentWindow?.postMessage(
      {
        type: "STAMP_REQUEST",
        value: Buffer.from(challenge).toString("hex"),
      },
      "*"
    );

    return new Promise(function (resolve, _reject) {
      window.addEventListener(
        "message",
        (event) => {
          if (event.origin !== iframeOrigin) {
            // There might be other things going on in the window, for example: react dev tools, other extensions, etc.
            // Instead of erroring out we simply return. Not our event!
            return;
          }
          if (event.data && event.data["type"] == "STAMP") {
            resolve({
              stampHeaderName: stampHeaderName,
              stampHeaderValue: event.data["value"],
            });
          }
        },
        false
      );
    });
  }
}

async function getChallengeFromPayload(payload: string): Promise<Uint8Array> {
  const messageBuffer = new TextEncoder().encode(payload);
  const hashBuffer = await crypto.subtle.digest("SHA-256", messageBuffer);
  const hexString = Buffer.from(hashBuffer).toString("hex");
  const hexBuffer = Buffer.from(hexString, "utf8");
  return new Uint8Array(hexBuffer);
}

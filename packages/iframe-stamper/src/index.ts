/// <reference lib="dom" />

// Header name for an API key stamp
const stampHeaderName = "X-Stamp";

// Set of constants for event types expected to be sent and received between a parent page and its iframe.
export enum IframeEventType {
  // Event sent by the iframe to its parent to indicate readiness.
  // Value: the iframe public key
  PublicKeyReady = "PUBLIC_KEY_READY",
  // Event sent by the parent to inject a recovery bundle into the iframe.
  // Value: the bundle to inject
  InjectRecoveryBundle = "INJECT_RECOVERY_BUNDLE",
  // Event sent by the parent to inject an export bundle into the iframe.
  // Value: the bundle to inject
  InjectExportBundle = "INJECT_EXPORT_BUNDLE",
  // Event sent by the iframe to its parent when `InjectBundle` is successful
  // Value: true (boolean)
  BundleInjected = "BUNDLE_INJECTED",
  // Event sent by the parent page to request a signature
  // Value: payload to sign
  StampRequest = "STAMP_REQUEST",
  // Event sent by the iframe to communicate the result of a stamp operation.
  // Value: signed payload
  Stamp = "STAMP",
}

type TStamp = {
  stampHeaderName: string;
  stampHeaderValue: string;
};

export type TIframeStamperConfig = {
  iframeUrl: string;
  iframeElementId: string;
  iframeContainerId: string;
  iframeStyle: string;
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

    let iframe = window.document.createElement("iframe");
    iframe.id = config.iframeElementId;
    iframe.src = config.iframeUrl;
    if (config.iframeStyle != null) {
      iframe.setAttribute("style", config.iframeStyle);
    }

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
          if (event.data?.type === IframeEventType.PublicKeyReady) {
            this.iframePublicKey = event.data["value"];
            resolve(event.data["value"]);
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
        type: IframeEventType.InjectRecoveryBundle,
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
          if (event.data?.type === IframeEventType.BundleInjected) {
            resolve(event.data["value"]);
          }
        },
        false
      );
    });
  }

  /**
   * Function to inject an export bundle into the iframe
   * The bundle should be encrypted to the iframe's initial public key
   * Encryption should be performed with HPKE (RFC 9180).
   * This is used during export flows.
   */
  async injectExportBundle(bundle: string): Promise<boolean> {
    this.iframe.contentWindow?.postMessage(
      {
        type: IframeEventType.InjectExportBundle,
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
          if (event.data?.type === IframeEventType.BundleInjected) {
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

    const iframeOrigin = this.iframeOrigin;

    this.iframe.contentWindow?.postMessage(
      {
        type: IframeEventType.StampRequest,
        value: payload,
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
          if (event.data?.type === IframeEventType.Stamp) {
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

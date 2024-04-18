/// <reference lib="dom" />

// Header name for an API key stamp
const stampHeaderName = "X-Stamp";

// Set of constants for event types expected to be sent and received between a parent page and its iframe.
export enum IframeEventType {
  // Event sent by the iframe to its parent to indicate readiness.
  // Value: the iframe public key
  PublicKeyReady = "PUBLIC_KEY_READY",
  // Event sent by the parent to inject a credential bundle (for recovery or auth) into the iframe.
  // Value: the bundle to inject
  InjectCredentialBundle = "INJECT_CREDENTIAL_BUNDLE",
  // Event sent by the parent to inject a private key export bundle into the iframe.
  // Value: the bundle to inject
  // Key Format (optional): the key format to encode the private key in after it's exported and decrypted: HEXADECIMAL or SOLANA. Defaults to HEXADECIMAL.
  // Public Key (optional): the public key of the exported private key. Required when the key format is SOLANA.
  InjectKeyExportBundle = "INJECT_KEY_EXPORT_BUNDLE",
  // Event sent by the parent to inject a wallet export bundle into the iframe.
  // Value: the bundle to inject
  InjectWalletExportBundle = "INJECT_WALLET_EXPORT_BUNDLE",
  // Event sent by the parent to inject an import bundle into the iframe.
  // Value: the bundle to inject
  InjectImportBundle = "INJECT_IMPORT_BUNDLE",
  // Event sent by the parent to extract an encrypted wallet bundle from the iframe.
  // Value: none
  ExtractWalletEncryptedBundle = "EXTRACT_WALLET_ENCRYPTED_BUNDLE",
  // Event sent by the parent to extract an encrypted private key bundle from the iframe.
  // Value: none
  // Key Format (optional): the key format to decode the private key in before it's encrypted for import: HEXADECIMAL or SOLANA. Defaults to HEXADECIMAL.
  ExtractKeyEncryptedBundle = "EXTRACT_KEY_ENCRYPTED_BUNDLE",
  // Event sent by the parent to apply settings on the iframe.
  // Value: the settings to apply in JSON string format.
  ApplySettings = "APPLY_SETTINGS",
  // Event sent by the iframe to its parent when `InjectBundle` is successful
  // Value: true (boolean)
  BundleInjected = "BUNDLE_INJECTED",
  // Event sent by the iframe to its parent when `ExtractEncryptedBundle` is successful
  // Value: the bundle encrypted in the iframe
  EncryptedBundleExtracted = "ENCRYPTED_BUNDLE_EXTRACTED",
  // Event sent by the iframe to its parent when `ApplySettings` is successful
  // Value: true (boolean)
  SettingsApplied = "SETTINGS_APPLIED",
  // Event sent by the parent page to request a signature
  // Value: payload to sign
  StampRequest = "STAMP_REQUEST",
  // Event sent by the iframe to communicate the result of a stamp operation.
  // Value: signed payload
  Stamp = "STAMP",
  // Event sent by the iframe to communicate an error
  // Value: serialized error
  Error = "ERROR",
}

// Set of constants for private key formats. These formats map to the encoding type used on a private key before encrypting and importing it
// or after exporting it and decrypting it.
export enum KeyFormat {
  // 64 hexadecimal digits. Key format used by MetaMask, MyEtherWallet, Phantom, Ledger, and Trezor for Ethereum and Tron keys
  Hexadecimal = "HEXADECIMAL",
  // Key format used by Phantom and Solflare for Solana keys
  Solana = "SOLANA",
}

type TStamp = {
  stampHeaderName: string;
  stampHeaderValue: string;
};

export type TIframeStamperConfig = {
  iframeUrl: string;
  iframeElementId: string;
  iframeContainer: HTMLElement | null | undefined;
};

export type TIframeStyles = {
  padding?: string;
  margin?: string;
  borderWidth?: string;
  borderStyle?: string;
  borderColor?: string;
  borderRadius?: string;
  fontSize?: string;
  fontWeight?: string;
  fontFamily?: string;
  color?: string;
  backgroundColor?: string;
  width?: string;
  height?: string;
  maxWidth?: string;
  maxHeight?: string;
  lineHeight?: string;
  boxShadow?: string;
  textAlign?: string;
  overflowWrap?: string;
  wordWrap?: string;
  resize?: string;
};

export type TIframeSettings = {
  styles?: TIframeStyles;
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

    if (!config.iframeContainer) {
      throw new Error("Iframe container cannot be found");
    }
    this.container = config.iframeContainer;

    if (this.container.querySelector(`#${config.iframeElementId}`)) {
      throw new Error(
        `Iframe element with ID ${config.iframeElementId} already exists`
      );
    }

    let iframe = window.document.createElement("iframe");

    // See https://developer.mozilla.org/en-US/docs/Web/HTML/Element/iframe#sandbox
    // We do not need any other permission than running scripts for import/export/auth frames.
    iframe.setAttribute("sandbox", "allow-scripts allow-same-origin");

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
   * This is used during recovery and auth flows.
   */
  async injectCredentialBundle(bundle: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.iframe.contentWindow?.postMessage(
        {
          type: IframeEventType.InjectCredentialBundle,
          value: bundle,
        },
        "*"
      );

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
          if (event.data?.type === IframeEventType.Error) {
            reject(event.data["value"]);
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
   * The key format to encode the private key in after it's exported and decrypted: HEXADECIMAL or SOLANA. Defaults to HEXADECIMAL.
   * This is used during the private key export flow.
   */
  async injectKeyExportBundle(
    bundle: string,
    organizationId: string,
    keyFormat?: KeyFormat
  ): Promise<boolean> {
    this.iframe.contentWindow?.postMessage(
      {
        type: IframeEventType.InjectKeyExportBundle,
        value: bundle,
        keyFormat,
        organizationId,
      },
      "*"
    );

    return new Promise((resolve, reject) => {
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
          if (event.data?.type === IframeEventType.Error) {
            reject(event.data["value"]);
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
   * This is used during the wallet export flow.
   */
  async injectWalletExportBundle(
    bundle: string,
    organizationId: string
  ): Promise<boolean> {
    this.iframe.contentWindow?.postMessage(
      {
        type: IframeEventType.InjectWalletExportBundle,
        value: bundle,
        organizationId,
      },
      "*"
    );

    return new Promise((resolve, reject) => {
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
          if (event.data?.type === IframeEventType.Error) {
            reject(event.data["value"]);
          }
        },
        false
      );
    });
  }

  /**
   * Function to inject an import bundle into the iframe
   * This is used to initiate either the wallet import flow or the private key import flow.
   */
  async injectImportBundle(
    bundle: string,
    organizationId: string,
    userId: string
  ): Promise<boolean> {
    this.iframe.contentWindow?.postMessage(
      {
        type: IframeEventType.InjectImportBundle,
        value: bundle,
        organizationId,
        userId,
      },
      "*"
    );

    return new Promise((resolve, reject) => {
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
          if (event.data?.type === IframeEventType.Error) {
            reject(event.data["value"]);
          }
        },
        false
      );
    });
  }

  /**
   * Function to extract an encrypted bundle from the iframe
   * The bundle should be encrypted to Turnkey's Signer enclave's initial public key
   * Encryption should be performed with HPKE (RFC 9180).
   * This is used during the wallet import flow.
   */
  async extractWalletEncryptedBundle(): Promise<string> {
    this.iframe.contentWindow?.postMessage(
      {
        type: IframeEventType.ExtractWalletEncryptedBundle,
      },
      "*"
    );

    return new Promise((resolve, reject) => {
      window.addEventListener(
        "message",
        (event) => {
          if (event.origin !== this.iframeOrigin) {
            // There might be other things going on in the window, for example: react dev tools, other extensions, etc.
            // Instead of erroring out we simply return. Not our event!
            return;
          }
          if (event.data?.type === IframeEventType.EncryptedBundleExtracted) {
            resolve(event.data["value"]);
          }
          if (event.data?.type === IframeEventType.Error) {
            reject(event.data["value"]);
          }
        },
        false
      );
    });
  }

  /**
   * Function to extract an encrypted bundle from the iframe
   * The bundle should be encrypted to Turnkey's Signer enclave's initial public key
   * Encryption should be performed with HPKE (RFC 9180).
   * The key format to encode the private key in before it's encrypted and imported: HEXADECIMAL or SOLANA. Defaults to HEXADECIMAL.
   * This is used during the private key import flow.
   */
  async extractKeyEncryptedBundle(keyFormat?: KeyFormat): Promise<string> {
    this.iframe.contentWindow?.postMessage(
      {
        type: IframeEventType.ExtractKeyEncryptedBundle,
        keyFormat: keyFormat,
      },
      "*"
    );

    return new Promise((resolve, reject) => {
      window.addEventListener(
        "message",
        (event) => {
          if (event.origin !== this.iframeOrigin) {
            // There might be other things going on in the window, for example: react dev tools, other extensions, etc.
            // Instead of erroring out we simply return. Not our event!
            return;
          }
          if (event.data?.type === IframeEventType.EncryptedBundleExtracted) {
            resolve(event.data["value"]);
          }
          if (event.data?.type === IframeEventType.Error) {
            reject(event.data["value"]);
          }
        },
        false
      );
    });
  }

  /**
   * Function to apply settings on allowed parameters in the iframe
   * This is used to style the HTML element used for plaintext in wallet and private key import.
   */
  async applySettings(settings: TIframeSettings): Promise<boolean> {
    const settingsStr = JSON.stringify(settings);
    this.iframe.contentWindow?.postMessage(
      {
        type: IframeEventType.ApplySettings,
        value: settingsStr,
      },
      "*"
    );

    return new Promise((resolve, reject) => {
      window.addEventListener(
        "message",
        (event) => {
          if (event.origin !== this.iframeOrigin) {
            // There might be other things going on in the window, for example: react dev tools, other extensions, etc.
            // Instead of erroring out we simply return. Not our event!
            return;
          }
          if (event.data?.type === IframeEventType.SettingsApplied) {
            resolve(event.data["value"]);
          }
          if (event.data?.type === IframeEventType.Error) {
            reject(event.data["value"]);
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

    return new Promise(function (resolve, reject) {
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
          if (event.data?.type === IframeEventType.Error) {
            reject(event.data["value"]);
          }
        },
        false
      );
    });
  }
}

import { ApiKeyStamper } from "@turnkey/api-key-stamper";
import { generateP256KeyPair, decryptCredentialBundle, getPublicKey } from "@turnkey/crypto";
import {uint8ArrayToHexString} from "@turnkey/encoding";


// Key names for localStorage
const LOCAL_STORAGE_EMBEDDED_PUBLIC_KEY = "turnkeyEmbeddedPublicKey";
const LOCAL_STORAGE_EMBEDDED_PRIVATE_KEY = "turnkeyEmbeddedPrivateKey";
const LOCAL_STORAGE_CREDENTIAL_BUNDLE = "turnkeyCredentialBundle";
const LOCAL_STORAGE_API_PRIVATE_KEY = "turnkeyApiPrivateKey";
const LOCAL_STORAGE_API_PUBLIC_KEY = "turnkeyApiPublicKey";

export class LocalStorageStamper {
  private publicKey: string | null;
  private privateKey: string | null;
  private apiKeyStamper: ApiKeyStamper | null;

  /**
   * Creates a new localStorage stamper.
   */
  constructor() {
    if (typeof window === "undefined") {
      throw new Error("Cannot initialize localStorage in non-browser environment");
    }

    this.publicKey = null;
    this.privateKey = null;
    this.apiKeyStamper = null;
  }

  /**
   * Initializes the stamper by generating a P-256 key pair and storing it in localStorage.
   */
  async init(): Promise<void> {
    // Check if keys already exist in localStorage
    const existingPublicKey = localStorage.getItem(LOCAL_STORAGE_EMBEDDED_PUBLIC_KEY);
    const existingPrivateKey = localStorage.getItem(LOCAL_STORAGE_EMBEDDED_PRIVATE_KEY);

    if (existingPublicKey && existingPrivateKey) {
      this.publicKey = existingPublicKey;
      return;
    }

    // Generate a new P-256 key pair
    const keyPair = generateP256KeyPair();

    // Store the keys in localStorage
    localStorage.setItem(LOCAL_STORAGE_EMBEDDED_PUBLIC_KEY, keyPair.publicKeyUncompressed);
    localStorage.setItem(LOCAL_STORAGE_EMBEDDED_PRIVATE_KEY, keyPair.privateKey);

    // Set the public key
    this.publicKey = keyPair.publicKeyUncompressed;
  }

  /**
   * Returns the public key, or `null` if no key pair has been generated.
   */
  getPublicKey(): string | null {
    return this.publicKey;
  }

  /**
   * Injects a credential bundle into localStorage and automatically decrypts it.
   * The decrypted key is stored in localStorage and used to initialize the `ApiKeyStamper`.
   */
  async injectCredentialBundle(encryptedBundle: string): Promise<void> {
    // Store the encrypted bundle in localStorage
    localStorage.setItem(LOCAL_STORAGE_CREDENTIAL_BUNDLE, encryptedBundle);

    // Decrypt the credential bundle using the embedded private key
    const embeddedPrivateKey = localStorage.getItem(LOCAL_STORAGE_EMBEDDED_PRIVATE_KEY);
    if (!embeddedPrivateKey) {
      throw new Error("No private key found in localStorage");
    }

    const decryptedKey = decryptCredentialBundle(encryptedBundle, embeddedPrivateKey);
    const publicKey = uint8ArrayToHexString(getPublicKey(decryptedKey, true));
    // Store the decrypted key in localStorage
    localStorage.setItem(LOCAL_STORAGE_API_PRIVATE_KEY, decryptedKey);
    localStorage.setItem(LOCAL_STORAGE_API_PUBLIC_KEY, publicKey);
    // Set the decrypted key in memory
    this.privateKey = decryptedKey;

    // Initialize the ApiKeyStamper with the decrypted key
    this.apiKeyStamper = new ApiKeyStamper({
      apiPublicKey: this.publicKey!,
      apiPrivateKey: this.privateKey,
    });
  }

  /**
   * Signs a payload using the `ApiKeyStamper`.
   */
  async stamp(payload: string): Promise<{ stampHeaderName: string; stampHeaderValue: string }> {
    if (!this.apiKeyStamper) {
      throw new Error("ApiKeyStamper not initialized. Call injectCredentialBundle() first.");
    }

    // Use the ApiKeyStamper to sign the payload
    return this.apiKeyStamper.stamp(payload);
  }
}
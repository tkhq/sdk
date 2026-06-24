/**
 * Encrypt-at-rest utilities for localStorage using the Web Crypto API.
 *
 * Overview
 * --------
 * Sensitive OAuth / session data that must survive a cross-origin redirect
 * (e.g. X OAuth on Android, where sessionStorage is wiped when the native app
 * opens) has to live in localStorage. To satisfy the Cure53 audit finding
 * TUR-02-004 ("critical user session data stored in plaintext in localStorage")
 * we encrypt every value with a non-extractable AES-GCM key.
 *
 * Key lifecycle
 * -------------
 * 1. On first use a 256-bit AES-GCM key is generated with `extractable: false`.
 * 2. The key is persisted in IndexedDB (the only browser store that can hold
 *    CryptoKey objects without serialisation).
 * 3. Subsequent calls retrieve the same key from IndexedDB so encrypted values
 *    remain readable across page reloads.
 *
 * Fallback behaviour
 * ------------------
 * If Web Crypto API or IndexedDB is unavailable (SSR, very old browsers, or
 * privacy mode that blocks IndexedDB) the module falls back to plaintext
 * localStorage so the auth flow is never broken.
 */

/** IndexedDB database name shared across the wallet-kit crypto helpers. */
const IDB_DB_NAME = "TurnkeyWalletKitCrypto";
/** Object-store name that holds the AES-GCM encryption key. */
const IDB_STORE_NAME = "EncryptionKeys";
/** Key name under which the single symmetric key is stored. */
const ENCRYPTION_KEY_ID = "oauth-storage-key";
/** AES-GCM IV length in bytes. */
const IV_LENGTH = 12;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Returns true when the Web Crypto subtle API is available in the current
 * environment (browser, Worker, Node ≥ 18 with globalThis.crypto).
 */
function isCryptoAvailable(): boolean {
  try {
    return (
      typeof globalThis !== "undefined" &&
      typeof globalThis.crypto !== "undefined" &&
      typeof globalThis.crypto.subtle !== "undefined"
    );
  } catch {
    return false;
  }
}

/**
 * Returns true when IndexedDB is available. IndexedDB is absent in SSR
 * environments (Node) and may be blocked in Firefox private-browsing mode.
 */
function isIndexedDbAvailable(): boolean {
  try {
    return typeof indexedDB !== "undefined" && indexedDB !== null;
  } catch {
    return false;
  }
}

/**
 * Opens (or creates) the wallet-kit crypto IndexedDB database.
 *
 * @returns A promise resolving to the IDBDatabase instance.
 */
function openCryptoDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_DB_NAME, 1);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
        db.createObjectStore(IDB_STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Retrieves the persisted AES-GCM CryptoKey from IndexedDB, or `null` if it
 * has not yet been created.
 *
 * @param db - Open IDBDatabase instance.
 * @returns The stored CryptoKey or `null`.
 */
function getKeyFromDb(db: IDBDatabase): Promise<CryptoKey | null> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE_NAME, "readonly");
    const store = tx.objectStore(IDB_STORE_NAME);
    const request = store.get(ENCRYPTION_KEY_ID);

    request.onsuccess = () => resolve((request.result as CryptoKey) ?? null);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Persists a CryptoKey into IndexedDB under the well-known key ID.
 *
 * @param db  - Open IDBDatabase instance.
 * @param key - The non-extractable AES-GCM CryptoKey to store.
 */
function storeKeyInDb(db: IDBDatabase, key: CryptoKey): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE_NAME, "readwrite");
    const store = tx.objectStore(IDB_STORE_NAME);
    store.put(key, ENCRYPTION_KEY_ID);

    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
    tx.onabort = () => {
      db.close();
      reject(tx.error);
    };
  });
}

/** Cached in-memory reference to avoid repeated IndexedDB round-trips. */
let cachedKey: CryptoKey | null = null;

/**
 * Returns the singleton AES-GCM encryption key for this origin, creating and
 * persisting it if it does not already exist.
 *
 * The returned key has `extractable: false` — it can never be exported from
 * the browser's key store, satisfying the audit requirement.
 *
 * @returns The AES-GCM CryptoKey, or `null` if crypto is unavailable.
 */
async function getOrCreateEncryptionKey(): Promise<CryptoKey | null> {
  if (!isCryptoAvailable() || !isIndexedDbAvailable()) {
    return null;
  }

  // Return the in-memory cached key to avoid IDB round-trips on every call.
  if (cachedKey) return cachedKey;

  try {
    const db = await openCryptoDb();

    // Check whether a key already exists.
    const existing = await getKeyFromDb(db);
    if (existing) {
      db.close();
      cachedKey = existing;
      return cachedKey;
    }

    // No key yet — generate a new non-extractable AES-GCM-256 key.
    const newKey = await globalThis.crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      false, // non-extractable
      ["encrypt", "decrypt"],
    );

    await storeKeyInDb(db, newKey);
    cachedKey = newKey;
    return cachedKey;
  } catch {
    // Any failure (IDB blocked, quota exceeded, etc.) → fall back to plaintext.
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Encrypts `value` with AES-GCM and writes the result to `localStorage` under
 * `storageKey`.
 *
 * The stored format is a JSON object:
 * ```json
 * { "iv": "<base64>", "data": "<base64>" }
 * ```
 *
 * Falls back to plaintext localStorage storage if the Web Crypto API or
 * IndexedDB is not available, so the auth flow is never interrupted.
 *
 * @param storageKey - The localStorage key to write to.
 * @param value      - The plaintext string to encrypt and store.
 */
export async function encryptAndStore(
  storageKey: string,
  value: string,
): Promise<void> {
  const key = await getOrCreateEncryptionKey();

  if (!key) {
    // Crypto unavailable — store plaintext as a graceful fallback.
    localStorage.setItem(storageKey, value);
    return;
  }

  try {
    const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const encodedValue = new TextEncoder().encode(value);

    const ciphertext = await globalThis.crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      encodedValue,
    );

    const stored = JSON.stringify({
      iv: bufferToBase64(iv),
      data: bufferToBase64(new Uint8Array(ciphertext)),
    });

    localStorage.setItem(storageKey, stored);
  } catch {
    // Encryption failed — fall back to plaintext so the auth flow continues.
    localStorage.setItem(storageKey, value);
  }
}

/**
 * Reads `storageKey` from `localStorage`, decrypts it if it was encrypted with
 * {@link encryptAndStore}, and returns the plaintext value.
 *
 * Returns `null` when the key is absent. Returns the raw stored string when
 * the value is not in the encrypted envelope format (e.g. plaintext written
 * by an older version of the SDK or during a fallback write).
 *
 * @param storageKey - The localStorage key to read from.
 * @returns The decrypted plaintext, or `null` if the key does not exist.
 */
export async function retrieveAndDecrypt(
  storageKey: string,
): Promise<string | null> {
  const raw = localStorage.getItem(storageKey);
  if (raw === null) return null;

  // Try to parse as our encrypted envelope.
  let envelope: { iv: string; data: string } | null = null;
  try {
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof parsed.iv === "string" &&
      typeof parsed.data === "string"
    ) {
      envelope = parsed as { iv: string; data: string };
    }
  } catch {
    // Not JSON at all — treat as legacy plaintext.
  }

  if (!envelope) {
    // Legacy plaintext value — return as-is.
    return raw;
  }

  const key = await getOrCreateEncryptionKey();
  if (!key) {
    // Crypto unavailable — we can't decrypt; return raw (will be the JSON string).
    return raw;
  }

  try {
    const iv = base64ToBuffer(envelope.iv);
    const data = base64ToBuffer(envelope.data);

    const decrypted = await globalThis.crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      data,
    );

    return new TextDecoder().decode(decrypted);
  } catch {
    // Decryption failed (e.g. different key origin or corrupted data).
    // Return null so the caller can treat this as a missing value and re-initiate the flow.
    return null;
  }
}

/**
 * Removes an encrypted (or plaintext) value from localStorage.
 *
 * This is a thin wrapper around `localStorage.removeItem` provided for
 * symmetry with {@link encryptAndStore} / {@link retrieveAndDecrypt}.
 *
 * @param storageKey - The localStorage key to remove.
 */
export function removeStoredValue(storageKey: string): void {
  localStorage.removeItem(storageKey);
}

// ---------------------------------------------------------------------------
// Internal encoding helpers
// ---------------------------------------------------------------------------

/**
 * Encodes a Uint8Array as a URL-safe base64 string.
 *
 * @param buffer - The bytes to encode.
 * @returns Base64-encoded string.
 */
function bufferToBase64(buffer: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < buffer.byteLength; i++) {
    binary += String.fromCharCode(buffer[i]!);
  }
  return btoa(binary);
}

/**
 * Decodes a base64 string back into a Uint8Array.
 *
 * @param base64 - The base64 string to decode.
 * @returns Decoded bytes.
 */
function base64ToBuffer(base64: string): Uint8Array {
  const binary = atob(base64);
  const buffer = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    buffer[i] = binary.charCodeAt(i);
  }
  return buffer;
}

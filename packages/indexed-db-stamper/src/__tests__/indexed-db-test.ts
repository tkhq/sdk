import { test, expect, beforeEach } from "@jest/globals";
import { IndexedDbStamper } from "../index";
import { jest } from "@jest/globals";

// Helper to mock browser APIs for IndexedDB and crypto.subtle
function setupBrowserEnvironment() {
  if (typeof window === "undefined") {
    (global as any).window = {};
  }

  // Mock IndexedDB
  const dbData: Record<string, any> = {};
  const fakeStore = {
    get: jest.fn((key: string) => {
      const result = dbData[key] ?? null;
      const request = {
        result,
        onsuccess: null as ((this: any, ev: any) => any) | null,
      };
      setTimeout(() => {
        request.onsuccess?.call(request, {});
      }, 0);
      return request;
    }),
    put: jest.fn((value: any, key: string) => {
      dbData[key] = value;
    }),
  };

  const fakeTx = {
    objectStore: () => fakeStore,
    oncomplete: null as (() => void) | null,
    onerror: null as (() => void) | null,
    onabort: null as (() => void) | null,
  };

  const fakeDb = {
    transaction: () => fakeTx,
  };

  const indexedDBMock = {
    open: jest.fn(() => {
      const request = {
        result: fakeDb,
        onupgradeneeded: null as (() => void) | null,
        onsuccess: null as (() => void) | null,
        onerror: null as (() => void) | null,
      };
      setTimeout(() => {
        request.onsuccess?.();
      }, 0);
      return request;
    }),
  };

  (global as any).indexedDB = indexedDBMock;

  // Properly typed CryptoKeys
  const fakePublicKey: CryptoKey = {
    algorithm: { name: "ECDSA", namedCurve: "P-256" } as EcKeyAlgorithm,
    extractable: true,
    type: "public",
    usages: ["verify"],
  };

  const fakePrivateKey: CryptoKey = {
    algorithm: { name: "ECDSA", namedCurve: "P-256" } as EcKeyAlgorithm,
    extractable: false,
    type: "private",
    usages: ["sign"],
  };

  const fakeKeyPair: CryptoKeyPair = {
    publicKey: fakePublicKey,
    privateKey: fakePrivateKey,
  };

  const fakePublicKeyBytes = new Uint8Array(65).fill(1);

  (global as any).crypto = {
    subtle: {
      generateKey: jest.fn(
        () => Promise.resolve(fakeKeyPair) as Promise<CryptoKeyPair>,
      ),
      exportKey: jest.fn(async (_format: string, _key: CryptoKey) => {
        return fakePublicKeyBytes.buffer;
      }),
      sign: jest.fn(async (_algo: any, _key: CryptoKey, data: ArrayBuffer) => {
        const sig = new Uint8Array(64);
        sig.set(new Uint8Array(data).slice(0, 32));
        return sig.buffer;
      }),
    },
  };
}

beforeEach(() => {
  setupBrowserEnvironment();
});

test("throws when instantiated outside of a browser environment", () => {
  const originalWindow = global.window;
  // @ts-ignore
  delete global.window;

  expect(() => {
    new IndexedDbStamper();
  }).toThrow("IndexedDB is only available in the browser");

  global.window = originalWindow;
});

test("initializes and generates keypair if not present", async () => {
  const stamper = new IndexedDbStamper();
  await stamper.init();

  const pubKey = stamper.getPublicKey();
  expect(pubKey).toBeDefined();
  expect(typeof pubKey).toBe("string");
  expect(pubKey!.length).toBeGreaterThan(0);
});

test("produces a valid stamp object", async () => {
  const stamper = new IndexedDbStamper();
  await stamper.init();

  const payload = "hello world";
  const result = await stamper.stamp(payload);

  expect(result).toHaveProperty("stampHeaderName", "X-Stamp");
  expect(result).toHaveProperty("stampHeaderValue");

  const decoded = JSON.parse(
    Buffer.from(result.stampHeaderValue, "base64url").toString("utf8"),
  );

  expect(decoded).toHaveProperty("publicKey");
  expect(decoded).toHaveProperty("scheme", "SIGNATURE_SCHEME_TK_API_P256");
  expect(decoded).toHaveProperty("signature");
  expect(typeof decoded.signature).toBe("string");
});

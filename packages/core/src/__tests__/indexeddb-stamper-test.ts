import { describe, expect, jest, afterEach, it } from "@jest/globals";
import { TurnkeyError, TurnkeyErrorCodes } from "@turnkey/sdk-types";

// `@utils` is a tsconfig path alias that jest doesn't resolve. The other suites
// here stub it virtually rather than mapping it in jest.config, and mapping it
// would break them: their virtual mocks only apply while it stays unresolvable.
jest.mock(
  "@utils",
  () => ({
    __esModule: true,
    assertValidP256ECDSAKeyPair: jest.fn(),
  }),
  { virtual: true },
);

import { IndexedDbStamper } from "../__stampers__/api/web/stamper";

/**
 * `createKeyPair` generates a key and then persists it. The persist step can
 * fail on its own — most visibly on iOS WebKit, which wraps a CryptoKey with a
 * Keychain-held master key before writing it to IndexedDB and throws
 * DataCloneError when that key can't be read. The generated key is fine; the
 * device just won't store it, so it gets its own error code.
 */

const realWindow = (globalThis as Record<string, unknown>)["window"];
const realIndexedDB = (globalThis as Record<string, unknown>)["indexedDB"];

/**
 * Just enough IndexedDB for `openDb` + `storeKeyPair`. A real implementation
 * (fake-indexeddb) pulls in a dependency and, in this workspace, a large
 * lockfile re-resolution; the surface under test is four methods.
 *
 * `put` is the injection point. Note `storeKeyPair` assigns `tx.oncomplete`
 * *after* calling `put`, so completion has to be deferred a tick.
 */
function installFakeIndexedDB(put: () => void) {
  const store = { put };
  const tx: Record<string, unknown> = { objectStore: () => store };
  const db = {
    objectStoreNames: { contains: () => true },
    createObjectStore: () => store,
    transaction: () => {
      queueMicrotask(() => (tx["oncomplete"] as (() => void) | undefined)?.());
      return tx;
    },
    close: () => {},
  };

  (globalThis as Record<string, unknown>)["window"] = globalThis;
  (globalThis as Record<string, unknown>)["indexedDB"] = {
    open: () => {
      const request: Record<string, unknown> = { result: db };
      queueMicrotask(() =>
        (request["onsuccess"] as (() => void) | undefined)?.(),
      );
      return request;
    },
  };
}

const throwing = (error: unknown) => () => {
  throw error;
};

describe("IndexedDbStamper.createKeyPair storage failures", () => {
  afterEach(() => {
    (globalThis as Record<string, unknown>)["window"] = realWindow;
    (globalThis as Record<string, unknown>)["indexedDB"] = realIndexedDB;
    jest.restoreAllMocks();
  });

  it("succeeds when the store accepts the key", async () => {
    installFakeIndexedDB(() => {});

    const publicKey = await new IndexedDbStamper().createKeyPair();

    expect(publicKey).toMatch(/^0[23][0-9a-f]{64}$/);
  });

  // WebKit throws this synchronously out of `put`, so `tx.onerror` never fires.
  it("maps a synchronous DataCloneError to API_KEY_STORAGE_UNAVAILABLE", async () => {
    installFakeIndexedDB(throwing(new Error("The object can not be cloned.")));

    const error = await new IndexedDbStamper().createKeyPair().catch((e) => e);

    expect(error).toBeInstanceOf(TurnkeyError);
    expect(error.code).toBe(TurnkeyErrorCodes.API_KEY_STORAGE_UNAVAILABLE);
  });

  // Any refusal, not a known list of exception names: browsers disagree on what
  // they throw here and new ones keep appearing.
  it("maps an unrecognised storage failure to the same code", async () => {
    installFakeIndexedDB(
      throwing(new Error("Connection to Indexed Database server lost")),
    );

    const error = await new IndexedDbStamper().createKeyPair().catch((e) => e);

    expect(error).toBeInstanceOf(TurnkeyError);
    expect(error.code).toBe(TurnkeyErrorCodes.API_KEY_STORAGE_UNAVAILABLE);
  });

  // The original is what tells an integrator which browser fault they hit, and
  // it is exactly what the react-wallet-kit modals used to discard.
  it("preserves the underlying error as cause", async () => {
    const underlying = new Error("The object can not be cloned.");
    installFakeIndexedDB(throwing(underlying));

    const error = await new IndexedDbStamper().createKeyPair().catch((e) => e);

    expect(error.cause).toBe(underlying);
  });
});

import { describe, expect, it, jest } from "@jest/globals";

jest.mock(
  "@polyfills/window",
  () => ({
    __esModule: true,
    default: {
      localStorage: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
      },
    },
  }),
  { virtual: true },
);
jest.mock("@utils", () => ({ __esModule: true, parseSession: jest.fn() }), {
  virtual: true,
});

import { TurnkeyClient } from "../__clients__/core";

/**
 * An in-memory stand-in for `WebStorageManager` that reproduces the part that
 * matters here: `clearSession` reads the session-key index, filters it, and
 * writes it back, with an `await` in between. Concurrent clears therefore lose
 * updates the same way the real read-modify-write does.
 */
function createStorageManager(sessionKeys: string[]) {
  const sessions = new Map(
    sessionKeys.map((k) => [k, { publicKey: `pk-${k}`, token: `jwt-${k}` }]),
  );
  let index = [...sessionKeys];

  const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

  return {
    listSessionKeys: async () => [...index],
    getSession: async (sessionKey: string) => sessions.get(sessionKey),
    clearSession: async (sessionKey: string) => {
      const current = [...index];
      await tick();
      sessions.delete(sessionKey);
      index = current.filter((k) => k !== sessionKey);
    },
  };
}

function createClient(sessionKeys: string[]) {
  const client = new TurnkeyClient({ organizationId: "org-id" });
  const storageManager = createStorageManager(sessionKeys);
  (client as any).storageManager = storageManager;
  (client as any).deleteApiKeyPair = async () => {};
  return { client, storageManager };
}

describe("clearAllSessions", () => {
  it("removes every session before it resolves", async () => {
    const { client, storageManager } = createClient(["a", "b", "c", "d"]);

    await client.clearAllSessions();

    expect(await storageManager.listSessionKeys()).toEqual([]);
  });
});

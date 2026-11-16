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
 * A storage manager whose `clearSession` does real async work (like the
 * React Native AsyncStorage backend), so a fire-and-forget clear is
 * observable: the session is still readable right after clearSession is
 * called but before it settles.
 */
function createStorageManager() {
  let session: { publicKey: string; token: string } | undefined = {
    publicKey: "pk",
    token: "jwt",
  };

  return {
    session: () => session,
    getActiveSessionKey: async () => "default",
    getActiveSession: async () => session,
    getSession: async () => session,
    clearSession: async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
      session = undefined;
    },
  };
}

function createClient() {
  const client = new TurnkeyClient({ organizationId: "org-id" });
  const storageManager = createStorageManager();
  (client as any).storageManager = storageManager;
  (client as any).deleteApiKeyPair = async () => {};
  return { client, storageManager };
}

describe("logout", () => {
  it("clears the session from storage before it resolves", async () => {
    const { client, storageManager } = createClient();

    await client.logout();

    expect(storageManager.session()).toBeUndefined();
  });
});

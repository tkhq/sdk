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
import { SignatureFormat } from "@turnkey/api-key-stamper";

/**
 * A stamper that mirrors `CrossPlatformApiKeyStamper`'s relevant surface: a
 * single shared `temporaryPublicKey`, and a `sign` that yields to the event
 * loop mid-call. The signature it returns records the key it actually used,
 * so a call that picks up another call's key is observable.
 */
function createStamper(activeSessionKey: string) {
  const stamper: any = {
    temporaryPublicKey: undefined as string | undefined,
    getTemporaryPublicKey: () => stamper.temporaryPublicKey,
    setTemporaryPublicKey: (k: string | undefined) => {
      stamper.temporaryPublicKey = k;
    },
    getActiveKey: () => stamper.temporaryPublicKey ?? activeSessionKey,
    sign: async (
      _payload: string,
      _format: SignatureFormat,
      publicKeyHex?: string,
    ) => {
      const key = publicKeyHex ?? stamper.getActiveKey();
      await new Promise((resolve) => setTimeout(resolve, 0));
      const after = publicKeyHex ?? stamper.getActiveKey();
      // The key must not change out from under an in-flight signature.
      expect(after).toBe(key);
      return `sig-with-${key}`;
    },
  };
  return stamper;
}

function createClient(activeSessionKey: string) {
  const client = new TurnkeyClient({ organizationId: "org-id" });
  (client as any).apiKeyStamper = createStamper(activeSessionKey);
  return client;
}

describe("signWithApiKey", () => {
  it("signs with the requested key even under concurrency", async () => {
    const client = createClient("session-key");

    const [a, b] = await Promise.all([
      client.signWithApiKey({ message: "a", publicKey: "key-a" }),
      client.signWithApiKey({ message: "b", publicKey: "key-b" }),
    ]);

    expect(a).toBe("sig-with-key-a");
    expect(b).toBe("sig-with-key-b");
  });
});

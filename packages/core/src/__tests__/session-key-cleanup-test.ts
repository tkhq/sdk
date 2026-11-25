import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { TurnkeyErrorCodes } from "@turnkey/sdk-types";

jest.mock(
  "@polyfills/window",
  () => {
    const values = new Map<string, string>();
    return {
      __esModule: true,
      default: {
        localStorage: {
          getItem: (key: string) => values.get(key) ?? null,
          setItem: (key: string, value: string) => values.set(key, value),
          removeItem: (key: string) => values.delete(key),
          clear: () => values.clear(),
        },
      },
    };
  },
  { virtual: true },
);
jest.mock("@utils", () => jest.requireActual("../utils"), { virtual: true });

import WindowWrapper from "@polyfills/window";
import { TurnkeyClient } from "../__clients__/core";
import { CrossPlatformApiKeyStamper } from "../__stampers__/api/base";
import { WebStorageManager } from "../__storage__/web/storage";
import {
  Chain,
  SessionKey,
  StamperType,
  WalletInterfaceType,
  type WalletProvider,
} from "../__types__";

function sessionToken(publicKey: string): string {
  const payload = Buffer.from(
    JSON.stringify({
      exp: Math.floor(Date.now() / 1000) + 900,
      public_key: publicKey,
      session_type: "SESSION_TYPE_READ_WRITE",
      user_id: "user-id",
      organization_id: "org-id",
    }),
  ).toString("base64");
  return `header.${payload}.signature`;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

// Separate clients use separate storage managers but share persistent sessions
// and keys, as tabs on the same origin do.
function createSharedKeyStore() {
  const keys = new Set<string>();
  let nextKey = 0;
  return {
    keys,
    createKeyPair: jest.fn(async () => {
      const publicKey = `key-${++nextKey}`;
      keys.add(publicKey);
      return publicKey;
    }),
    listKeyPairs: jest.fn(async () => [...keys]),
    deleteKeyPair: jest.fn(async (publicKey: string) => {
      keys.delete(publicKey);
    }),
    sign: jest.fn(async (_payload: string, publicKey: string) => {
      if (!keys.has(publicKey)) {
        throw new Error(`Key not found for publicKey: ${publicKey}`);
      }
      return `signature:${publicKey}`;
    }),
  };
}

function createClient(keyStore: ReturnType<typeof createSharedKeyStore>) {
  const storage = new WebStorageManager();
  const stamper = new CrossPlatformApiKeyStamper(storage);
  (stamper as any).stamper = keyStore;
  const client = new TurnkeyClient({ organizationId: "org-id" }, stamper);
  (client as any).storageManager = storage;
  (client as any).passkeyStamper = {};
  (client as any).walletManager = { stamper: { setProvider: jest.fn() } };
  return { client, storage, stamper };
}

describe("session key cleanup", () => {
  beforeEach(() => {
    WindowWrapper.localStorage.clear();
  });

  it.each([
    { flow: "passkey", separateClients: false },
    { flow: "passkey", separateClients: true },
    { flow: "wallet", separateClients: false },
    { flow: "wallet", separateClients: true },
  ])(
    "preserves keys while $flow logins overlap (separate clients: $separateClients)",
    async ({ flow, separateClients }) => {
      const keyStore = createSharedKeyStore();
      const first = createClient(keyStore);
      const second = separateClients ? createClient(keyStore) : first;
      const prompts = [0, 1].map(() => ({
        started: deferred<string>(),
        approved: deferred<void>(),
      }));
      let nextPrompt = 0;
      const httpClient = {
        stampStampLogin: async (
          input: { publicKey: string },
          stampWith: StamperType,
        ) => {
          const prompt = prompts[nextPrompt++]!;
          prompt.started.resolve(input.publicKey);
          await prompt.approved.promise;
          return {
            publicKey: input.publicKey,
            stamp: {
              stampHeaderValue:
                stampWith === StamperType.Passkey
                  ? JSON.stringify({ credentialId: "id" })
                  : Buffer.from(
                      JSON.stringify({ publicKey: "11".repeat(32) }),
                    ).toString("base64url"),
            },
          };
        },
        sendSignedRequest: async (request: { publicKey: string }) => ({
          session: sessionToken(request.publicKey),
        }),
      };
      first.client.httpClient = httpClient as any;
      second.client.httpClient = httpClient as any;

      const walletProvider = {
        interfaceType: WalletInterfaceType.Solana,
        chainInfo: { namespace: Chain.Solana },
      } as WalletProvider;
      const login = (client: TurnkeyClient) =>
        flow === "passkey"
          ? client.loginWithPasskey()
          : client.loginWithWallet({ walletProvider });

      const loginA = login(first.client);
      const keyA = await prompts[0]!.started.promise;
      const loginB = login(second.client);
      const keyB = await prompts[1]!.started.promise;

      prompts[0]!.approved.resolve();
      await loginA;
      expect(keyStore.keys.has(keyB)).toBe(true);

      prompts[1]!.approved.resolve();
      await loginB;
      expect((await second.storage.getActiveSession())?.publicKey).toBe(keyB);
      await expect(second.stamper.sign("request")).resolves.toBe(
        `signature:${keyB}`,
      );
      expect(keyStore.keys.has(keyA)).toBe(false);
    },
  );

  it("only deletes the replaced session's key", async () => {
    const keyStore = createSharedKeyStore();
    const { client } = createClient(keyStore);
    keyStore.keys.add("old");
    keyStore.keys.add("new");
    keyStore.keys.add("pending");
    await client.storeSession({ sessionToken: sessionToken("old") });
    await client.storeSession({ sessionToken: sessionToken("new") });

    expect(keyStore.keys).toEqual(new Set(["new", "pending"]));
    expect(keyStore.deleteKeyPair).toHaveBeenCalledTimes(1);
    expect(keyStore.deleteKeyPair).toHaveBeenCalledWith("old");
  });

  it("retains a key when refreshing a session with the same key", async () => {
    const keyStore = createSharedKeyStore();
    const { client, stamper } = createClient(keyStore);
    keyStore.keys.add("shared");
    await client.storeSession({ sessionToken: sessionToken("shared") });
    await client.storeSession({ sessionToken: sessionToken("shared") });

    await expect(stamper.sign("request")).resolves.toBe("signature:shared");
    expect(keyStore.deleteKeyPair).not.toHaveBeenCalled();
  });

  it("retains the replaced key while another session references it", async () => {
    const keyStore = createSharedKeyStore();
    const { client } = createClient(keyStore);
    keyStore.keys.add("shared");
    keyStore.keys.add("new");
    await client.storeSession({ sessionToken: sessionToken("shared") });
    await client.storeSession({
      sessionToken: sessionToken("shared"),
      sessionKey: "other-session",
    });
    await client.storeSession({ sessionToken: sessionToken("new") });
    expect(keyStore.deleteKeyPair).not.toHaveBeenCalled();

    await client.storeSession({
      sessionToken: sessionToken("new"),
      sessionKey: "other-session",
    });
    expect(keyStore.keys).toEqual(new Set(["new"]));
  });

  it("rejects a missing key before changing the stored or active session", async () => {
    const keyStore = createSharedKeyStore();
    const { client, storage } = createClient(keyStore);
    keyStore.keys.add("old");
    await client.storeSession({
      sessionToken: sessionToken("old"),
      sessionKey: "existing-session",
    });

    await expect(
      client.storeSession({ sessionToken: sessionToken("missing") }),
    ).rejects.toMatchObject({
      code: TurnkeyErrorCodes.STORE_SESSION_ERROR,
      message: expect.stringContaining("missing"),
    });
    expect(
      await storage.getSession(SessionKey.DefaultSessionkey),
    ).toBeUndefined();
    expect(await storage.getActiveSessionKey()).toBe("existing-session");
    expect(keyStore.keys.has("old")).toBe(true);
  });

  it("does not delete keys when session storage fails", async () => {
    const keyStore = createSharedKeyStore();
    const { client, storage } = createClient(keyStore);
    keyStore.keys.add("old");
    keyStore.keys.add("new");
    await client.storeSession({ sessionToken: sessionToken("old") });
    jest
      .spyOn(storage, "storeSession")
      .mockRejectedValue(new Error("write failed"));

    await expect(
      client.storeSession({ sessionToken: sessionToken("new") }),
    ).rejects.toMatchObject({ code: TurnkeyErrorCodes.STORE_SESSION_ERROR });
    expect((await storage.getActiveSession())?.publicKey).toBe("old");
    expect(keyStore.deleteKeyPair).not.toHaveBeenCalled();
  });

  it("keeps a successful login usable if replaced-key cleanup fails", async () => {
    const keyStore = createSharedKeyStore();
    const { client, stamper } = createClient(keyStore);
    keyStore.keys.add("old");
    keyStore.keys.add("new");
    await client.storeSession({ sessionToken: sessionToken("old") });
    keyStore.deleteKeyPair.mockRejectedValue(new Error("delete failed"));

    await expect(
      client.storeSession({ sessionToken: sessionToken("new") }),
    ).resolves.toBeUndefined();
    await expect(stamper.sign("request")).resolves.toBe("signature:new");
  });

  it("clearSession retains a key another session still references", async () => {
    const keyStore = createSharedKeyStore();
    const { client, storage } = createClient(keyStore);
    keyStore.keys.add("shared");
    await client.storeSession({ sessionToken: sessionToken("shared") });
    await client.storeSession({
      sessionToken: sessionToken("shared"),
      sessionKey: "other-session",
    });

    await client.clearSession();
    expect(
      await storage.getSession(SessionKey.DefaultSessionkey),
    ).toBeUndefined();
    expect(keyStore.keys.has("shared")).toBe(true);
    expect(keyStore.deleteKeyPair).not.toHaveBeenCalled();

    await client.clearSession({ sessionKey: "other-session" });
    expect(keyStore.keys.has("shared")).toBe(false);
  });

  it("clearAllSessions clears every session and all unused keys", async () => {
    const keyStore = createSharedKeyStore();
    const { client } = createClient(keyStore);
    keyStore.keys.add("a");
    keyStore.keys.add("b");
    keyStore.keys.add("orphan");
    await client.storeSession({ sessionToken: sessionToken("a") });
    await client.storeSession({
      sessionToken: sessionToken("b"),
      sessionKey: "other-session",
    });

    await client.clearAllSessions();
    expect(await client.getAllSessions()).toBeUndefined();
    expect(keyStore.keys.size).toBe(0);
  });

  it("clearSession deletes the key of an unshared session", async () => {
    const keyStore = createSharedKeyStore();
    const { client } = createClient(keyStore);
    keyStore.keys.add("solo");
    keyStore.keys.add("pending");
    await client.storeSession({ sessionToken: sessionToken("solo") });

    await client.clearSession();
    expect(keyStore.keys).toEqual(new Set(["pending"]));
  });
});

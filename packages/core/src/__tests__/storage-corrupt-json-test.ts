import { describe, expect, it, jest } from "@jest/globals";

const mockStore = new Map<string, string>();

jest.mock(
  "@polyfills/window",
  () => ({
    __esModule: true,
    default: {
      localStorage: {
        getItem: (key: string) =>
          mockStore.has(key) ? mockStore.get(key)! : null,
        setItem: (key: string, value: string) => {
          mockStore.set(key, value);
        },
        removeItem: (key: string) => {
          mockStore.delete(key);
        },
      },
    },
  }),
  { virtual: true },
);
jest.mock(
  "@utils",
  () => ({ __esModule: true, parseSession: (s: unknown) => s }),
  { virtual: true },
);

import { WebStorageManager } from "../__storage__/web/storage";

describe("WebStorageManager.getStorageValue", () => {
  it("treats an unparseable value as absent", async () => {
    const manager = new WebStorageManager();
    mockStore.set("@turnkey/session/v1", "{not json");

    await expect(
      manager.getStorageValue("@turnkey/session/v1"),
    ).resolves.toBeUndefined();
  });

  it("still returns a stored value", async () => {
    const manager = new WebStorageManager();
    await manager.setStorageValue("@turnkey/session/v2", "a-value");

    await expect(manager.getStorageValue("@turnkey/session/v2")).resolves.toBe(
      "a-value",
    );
  });
});

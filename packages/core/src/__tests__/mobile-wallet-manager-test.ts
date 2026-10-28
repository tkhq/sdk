import { afterEach, describe, expect, it, jest } from "@jest/globals";

jest.mock("@utils", () => jest.requireActual("../utils"), { virtual: true });

// stand-in for `WalletConnectClient` whose `init()` and `pair()` the test
// resolves or rejects by hand, so we can observe the manager while
// WalletConnect is still starting up
const mockClient = {
  init: jest.fn<() => Promise<void>>(),
  pair: jest.fn<() => Promise<string>>(),
  getSession: () => null,
  onSessionUpdate: () => {},
  onSessionEvent: () => {},
  onSessionDelete: () => {},
  onPairingExpire: () => {},
};

jest.mock("../__wallet__/wallet-connect/client", () => ({
  WalletConnectClient: jest.fn(() => mockClient),
}));

import { MobileWalletManager } from "../__wallet__/mobile/manager";
import { Chain, type TWalletManagerConfig } from "../__types__";

const CONFIG = {
  walletConnect: { projectId: "project-id", appMetadata: {} },
  chains: { ethereum: { walletConnectNamespaces: ["eip155:1"] } },
  features: { auth: true },
} as unknown as TWalletManagerConfig;

// a promise plus the functions that settle it
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// lets the manager's background initialization advance between steps
async function flushPromises() {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

describe("MobileWalletManager WalletConnect initialization", () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it("does not wait for WalletConnect to finish initializing", async () => {
    const clientInit = deferred<void>();
    mockClient.init.mockReturnValue(clientInit.promise);

    const manager = new MobileWalletManager(CONFIG);
    await manager.init(CONFIG);

    // init resolved even though WalletConnect is still starting up, and the
    // WalletConnect provider is listed in a loading state
    const [provider] = await manager.getProviders();
    expect(provider!.isLoading).toBe(true);
    expect(provider!.uri).toBeUndefined();

    clientInit.resolve();
  });

  it("ensureWalletConnectReady waits until WalletConnect is initialized", async () => {
    const clientInit = deferred<void>();
    mockClient.init.mockReturnValue(clientInit.promise);
    mockClient.pair.mockResolvedValue("wc:uri-1");

    const manager = new MobileWalletManager(CONFIG);
    await manager.init(CONFIG);

    let ready = false;
    const readyPromise = manager.ensureWalletConnectReady().then(() => {
      ready = true;
    });

    await flushPromises();
    expect(ready).toBe(false);

    clientInit.resolve();
    await readyPromise;

    const [provider] = await manager.getProviders();
    expect(provider!.isLoading).toBe(false);
    expect(provider!.uri).toBe("wc:uri-1");
  });

  it("removes WalletConnect when the client fails to initialize", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    mockClient.init.mockRejectedValue(new Error("relay unreachable"));

    const manager = new MobileWalletManager(CONFIG);
    await manager.init(CONFIG);
    await manager.ensureWalletConnectReady();

    expect(await manager.getProviders()).toEqual([]);
    await expect(manager.getProviders(Chain.Ethereum)).rejects.toThrow(
      "No wallet supports chain: ethereum",
    );
  });

  it("removes WalletConnect when pairing takes longer than 15 seconds", async () => {
    jest.useFakeTimers();
    mockClient.init.mockResolvedValue();
    // the pairing request never comes back
    mockClient.pair.mockReturnValue(new Promise(() => {}));

    const manager = new MobileWalletManager(CONFIG);
    await manager.init(CONFIG);
    await flushPromises();

    expect(await manager.getProviders()).toHaveLength(1);

    jest.advanceTimersByTime(15000);
    await manager.ensureWalletConnectReady();

    expect(await manager.getProviders()).toEqual([]);
  });
});

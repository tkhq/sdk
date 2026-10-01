import { describe, expect, jest, it } from "@jest/globals";
import type { WalletConnectClient } from "../__wallet__/wallet-connect/client";
import { WalletConnectWallet } from "../__wallet__/wallet-connect/base";

const CONNECTED_SESSION = {
  namespaces: { eip155: { accounts: ["eip155:1:0xabc"] } },
};

// minimal stand-in for `WalletConnectClient` that models single-use pairing
// URIs the same way the real client does: `pair()` starts a pending approval,
// and `approve()` consumes it whether the wallet approves or rejects
function createFakeClient() {
  const handlers: { sessionDelete?: () => void; pairingExpire?: () => void } =
    {};
  let session: unknown = null;
  let uriCount = 0;
  let pendingApproval = false;

  // what the wallet does with the connection request; mocked per test
  const walletResponse = jest.fn<() => Promise<unknown>>();

  const client = {
    onSessionUpdate: () => {},
    onSessionEvent: () => {},
    onSessionDelete: (fn: () => void) => {
      handlers.sessionDelete = fn;
    },
    onPairingExpire: (fn: () => void) => {
      handlers.pairingExpire = fn;
    },
    getSession: () => session,
    pair: jest.fn(async () => {
      if (pendingApproval) {
        throw new Error("WalletConnect: Pairing already in progress");
      }
      pendingApproval = true;
      return `wc:uri-${++uriCount}`;
    }),
    approve: jest.fn(async () => {
      if (!pendingApproval) {
        throw new Error("WalletConnect: call pair() before approve()");
      }
      pendingApproval = false;
      return walletResponse();
    }),
    cancelPairing: jest.fn(async () => {
      pendingApproval = false;
    }),
    disconnect: jest.fn(async () => {
      session = null;
    }),
  };

  return {
    client,
    handlers,
    walletResponse,
    setSession: (s: unknown) => {
      session = s;
    },
  };
}

async function createWallet() {
  const fake = createFakeClient();
  const wallet = new WalletConnectWallet(
    fake.client as unknown as WalletConnectClient,
    undefined,
    { ethereumNamespaces: ["eip155:1"], solanaNamespaces: [] },
  );
  await wallet.init();

  const events: (string | undefined)[] = [];
  const [provider] = await wallet.getProviders();
  (provider!.provider as any).features["standard:events"].on(
    "change",
    (evt?: { type: string }) => events.push(evt?.type),
  );

  const currentUri = async () => (await wallet.getProviders())[0]!.uri;

  return { ...fake, wallet, provider: provider!, events, currentUri };
}

describe("WalletConnectWallet pairing URI regeneration", () => {
  it("regenerates the URI and rethrows when approval is rejected", async () => {
    const { client, walletResponse, wallet, provider, events, currentUri } =
      await createWallet();
    expect(await currentUri()).toBe("wc:uri-1");

    const rejection = new Error("User rejected the request");
    walletResponse.mockRejectedValueOnce(rejection);

    await expect(wallet.connectWalletAccount(provider)).rejects.toBe(rejection);

    expect(client.cancelPairing).toHaveBeenCalledTimes(1);
    expect(await currentUri()).toBe("wc:uri-2");
    expect(events).toEqual(["proposalExpired"]);
  });

  it("can connect again after a rejected attempt", async () => {
    const { walletResponse, wallet, provider, setSession } =
      await createWallet();

    walletResponse.mockRejectedValueOnce(new Error("rejected"));
    await expect(wallet.connectWalletAccount(provider)).rejects.toThrow();

    walletResponse.mockImplementationOnce(async () => {
      setSession(CONNECTED_SESSION);
      return CONNECTED_SESSION;
    });
    await expect(wallet.connectWalletAccount(provider)).resolves.toBe("0xabc");
  });

  it("regenerates the URI before notifying when the wallet ends the session", async () => {
    const { handlers, setSession, events, currentUri } = await createWallet();
    setSession(CONNECTED_SESSION);

    // the wallet deletes the session, so it's gone by the time the event fires
    setSession(null);
    await handlers.sessionDelete!();

    expect(await currentUri()).toBe("wc:uri-2");
    expect(events).toEqual(["disconnect"]);
  });

  it("does not re-pair while a connected session is active", async () => {
    const { client, walletResponse, wallet, provider, setSession, currentUri } =
      await createWallet();

    walletResponse.mockImplementationOnce(async () => {
      setSession(CONNECTED_SESSION);
      throw new Error("approval failed after the session was established");
    });
    await expect(wallet.connectWalletAccount(provider)).rejects.toThrow();

    expect(client.cancelPairing).not.toHaveBeenCalled();
    expect(client.pair).toHaveBeenCalledTimes(1);
    expect(await currentUri()).toBe("wc:uri-1");
  });

  it("shares one regeneration between concurrent triggers", async () => {
    const { client, handlers } = await createWallet();

    await Promise.all([handlers.pairingExpire!(), handlers.sessionDelete!()]);

    // one pair() from init, one from the shared regeneration
    expect(client.pair).toHaveBeenCalledTimes(2);
  });
});

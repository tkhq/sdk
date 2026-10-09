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

import { Transaction } from "ethers";

import { WalletConnectWallet } from "../__wallet__/wallet-connect/base";
import { Chain, SignIntent, WalletInterfaceType } from "../__types__";

const SESSION_ADDRESS = "0x1111111111111111111111111111111111111111";
const STALE_ADDRESS = "0x2222222222222222222222222222222222222222";

function makeSession(address?: string) {
  return {
    namespaces: address
      ? { eip155: { accounts: [`eip155:1:${address}`] } }
      : { eip155: { accounts: [] } },
  } as any;
}

/**
 * A WalletConnect client that only has a session once `approve()` has been
 * called, mirroring a fresh pairing.
 */
function createClient() {
  let session: any = makeSession();
  const requests: { method: string; params: any }[] = [];

  return {
    requests,
    onSessionUpdate: () => {},
    onSessionEvent: () => {},
    onSessionDelete: () => {},
    onPairingExpire: () => {},
    getSession: () => session,
    approve: async () => {
      session = makeSession(SESSION_ADDRESS);
      return session;
    },
    request: async (_chain: string, method: string, params: any) => {
      requests.push({ method, params });
      return "0xsignature";
    },
  };
}

function createWallet(client: ReturnType<typeof createClient>) {
  return new (WalletConnectWallet as any)(client, undefined, {
    ethereumNamespaces: ["eip155:1"],
    solanaNamespaces: [],
  });
}

/** A provider descriptor whose cached address is out of date. */
const staleProvider = {
  interfaceType: WalletInterfaceType.WalletConnect,
  chainInfo: { namespace: Chain.Ethereum, chainId: 1 },
  connectedAddresses: [STALE_ADDRESS],
} as any;

describe("WalletConnectWallet.sign", () => {
  it("signs a message with the account from the freshly approved session", async () => {
    const client = createClient();
    const wallet = createWallet(client);

    await wallet.sign("0xdeadbeef", staleProvider, SignIntent.SignMessage);

    expect(client.requests[0]!.method).toBe("personal_sign");
    expect(client.requests[0]!.params[1]).toBe(SESSION_ADDRESS);
  });

  it("sends a transaction from the session account, not the cached one", async () => {
    const client = createClient();
    const wallet = createWallet(client);

    const tx = Transaction.from({
      to: STALE_ADDRESS,
      value: 1n,
      nonce: 0,
      gasLimit: 21000n,
      chainId: 1,
    });

    await wallet.sign(
      tx.unsignedSerialized,
      staleProvider,
      SignIntent.SignAndSendTransaction,
    );

    const sent = client.requests[0]!;
    expect(sent.params[0].from).toBe(SESSION_ADDRESS);
  });
});

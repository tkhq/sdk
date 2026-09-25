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

import { WalletConnectWallet } from "../__wallet__/wallet-connect/base";
import { Chain, SignIntent, WalletInterfaceType } from "../__types__";

const ADDRESS = "0x1111111111111111111111111111111111111111";
// The wallet approves Polygon, not the first chain we asked for.
const APPROVED_CHAIN = "eip155:137";

function createClient(accounts = [`${APPROVED_CHAIN}:${ADDRESS}`]) {
  // An already-established pairing, as after an app reload.
  let session: any = {
    namespaces: { eip155: { accounts } },
  };
  const requests: { chain: string; method: string }[] = [];

  return {
    requests,
    onSessionUpdate: () => {},
    onSessionEvent: () => {},
    onSessionDelete: () => {},
    onPairingExpire: () => {},
    getSession: () => session,
    approve: async () => {
      session = {
        namespaces: { eip155: { accounts } },
      };
      return session;
    },
    request: async (chain: string, method: string) => {
      requests.push({ chain, method });
      return "0xsignature";
    },
  };
}

const provider = {
  interfaceType: WalletInterfaceType.WalletConnect,
  chainInfo: { namespace: Chain.Ethereum, chainId: 1 },
  connectedAddresses: [ADDRESS],
} as any;

describe("WalletConnectWallet chain selection", () => {
  it("targets the chain the wallet approved, not the first requested one", async () => {
    const client = createClient();
    const wallet = new (WalletConnectWallet as any)(client, undefined, {
      // Ethereum mainnet is requested first, but only Polygon is granted.
      ethereumNamespaces: ["eip155:1", APPROVED_CHAIN],
      solanaNamespaces: [],
    });

    await wallet.sign("0xdeadbeef", provider, SignIntent.SignMessage);

    expect(client.requests[0]).toMatchObject({
      chain: APPROVED_CHAIN,
      method: "personal_sign",
    });
  });

  it("signs on the selected chain when multiple session chains are approved", async () => {
    const client = createClient([
      `eip155:1:${ADDRESS}`,
      `${APPROVED_CHAIN}:${ADDRESS}`,
    ]);
    const wallet = new (WalletConnectWallet as any)(client, undefined, {
      ethereumNamespaces: ["eip155:1", APPROVED_CHAIN],
      solanaNamespaces: [],
    });

    await wallet.switchChain(provider, "0x89");
    await wallet.sign("0xdeadbeef", provider, SignIntent.SignMessage);

    expect(client.requests).toEqual([
      { chain: "eip155:1", method: "wallet_switchEthereumChain" },
      { chain: APPROVED_CHAIN, method: "personal_sign" },
    ]);
  });
});

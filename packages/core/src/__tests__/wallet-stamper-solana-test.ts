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

jest.mock("@turnkey/crypto", () => ({ compressRawPublicKey: jest.fn() }), {
  virtual: true,
});
jest.mock("../utils", () => ({
  getSignatureSchemeFromProvider: () => "test-solana-scheme",
  isEthereumProvider: () => false,
  isSolanaProvider: (provider: any) =>
    provider.chainInfo.namespace === "solana",
}));

import { bs58, decodeBase64urlToString } from "@turnkey/encoding";

import { WalletStamper } from "../__wallet__/stamper";
import { SolanaWallet } from "../__wallet__/web/native/solana";
import { WalletConnectWallet } from "../__wallet__/wallet-connect/base";
import { Chain, WalletInterfaceType } from "../__types__";

const signingAddress = bs58.encode(new Uint8Array(32).fill(1));
const switchedAddress = bs58.encode(new Uint8Array(32).fill(2));
const signingPublicKey = "01".repeat(32);

async function stampValue(stamper: WalletStamper, provider: any) {
  const stamp = await stamper.stamp("payload", provider);
  return JSON.parse(decodeBase64urlToString(stamp.stampHeaderValue));
}

describe("WalletStamper.stamp (Solana)", () => {
  it("uses the account passed to native signing when the active account switches", async () => {
    const signingAccount = { address: signingAddress };
    const switchedAccount = { address: switchedAddress };
    let accountReads = 0;
    const signMessage = jest.fn(
      async ({ account }: { account: typeof signingAccount }) => [
        {
          signedMessage: new Uint8Array(),
          signature: new Uint8Array([account === signingAccount ? 1 : 2]),
        },
      ],
    );
    const wallet = {
      get accounts() {
        // The old getPublicKey() reads the account three times before sign().
        // Switch immediately afterward to expose the gap between those calls.
        return [accountReads++ < 3 ? signingAccount : switchedAccount];
      },
      features: { "solana:signMessage": { signMessage } },
    };
    const provider = {
      interfaceType: WalletInterfaceType.Solana,
      chainInfo: { namespace: Chain.Solana },
      provider: wallet,
      connectedAddresses: [signingAddress],
    } as any;

    const { publicKey, signature } = await stampValue(
      new WalletStamper(new SolanaWallet()),
      provider,
    );

    expect(signMessage).toHaveBeenCalledWith({
      account: signingAccount,
      message: new TextEncoder().encode("payload"),
    });
    expect(signature).toBe("01");
    expect(publicKey).toBe(signingPublicKey);
  });

  it("approves a missing WalletConnect session before signing", async () => {
    const session = {
      namespaces: {
        solana: { accounts: [`solana:mainnet:${signingAddress}`] },
      },
    };
    let activeSession: typeof session | null = null;
    const approve = jest.fn(async () => {
      activeSession = session;
      return session;
    });
    const request = jest.fn(async () => {
      // The key in the stamp must stay tied to the requested account even if
      // the active WalletConnect account changes during approval.
      session.namespaces.solana.accounts[0] = `solana:mainnet:${switchedAddress}`;
      return { signature: bs58.encode(new Uint8Array([1, 2, 3])) };
    });
    const client = {
      getSession: () => activeSession,
      approve,
      request,
      onSessionUpdate: jest.fn(),
      onSessionEvent: jest.fn(),
      onSessionDelete: jest.fn(),
      onPairingExpire: jest.fn(),
    } as any;
    const wallet = new WalletConnectWallet(client, undefined, {
      ethereumNamespaces: [],
      solanaNamespaces: ["solana:mainnet"],
    });
    const provider = {
      interfaceType: WalletInterfaceType.WalletConnect,
      chainInfo: { namespace: Chain.Solana },
      connectedAddresses: [],
    } as any;

    const { publicKey, signature } = await stampValue(
      new WalletStamper(wallet),
      provider,
    );

    expect(approve).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith(
      "solana:mainnet",
      "solana_signMessage",
      {
        pubkey: signingAddress,
        message: bs58.encode(new TextEncoder().encode("payload")),
      },
    );
    expect(signature).toBe("010203");
    expect(publicKey).toBe(signingPublicKey);
  });
});

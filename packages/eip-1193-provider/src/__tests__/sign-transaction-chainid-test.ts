import { describe, it, expect, jest } from "@jest/globals";

// The provider verifies the chain id over RPC on startup; stub the node.
jest.mock("viem/utils", () => ({
  ...(jest.requireActual("viem/utils") as object),
  getHttpRpcClient: () => ({
    request: async ({ body }: { body: { method: string } }) => {
      if (body.method === "eth_chainId") return { result: "0x7a69" };
      throw new Error(`unexpected rpc method: ${body.method}`);
    },
  }),
}));

import { parseTransaction, type Hex } from "viem";
import { privateKeyToAccount, sign } from "viem/accounts";
import type { UUID } from "crypto";

import { createEIP1193Provider } from "../";

const PRIVATE_KEY: Hex = `0x${"11".repeat(32)}`;
const account = privateKeyToAccount(PRIVATE_KEY);

const ORGANIZATION_ID = "00000000-0000-0000-0000-000000000000" as UUID;
const WALLET_ID = "00000000-0000-0000-0000-000000000001" as UUID;

const CHAIN = {
  chainId: "0x7a69", // 31337
  chainName: "Anvil",
  rpcUrls: ["http://127.0.0.1:8545"],
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
};

function fakeTurnkeyClient() {
  return {
    name: "TurnkeyClient",
    signTransaction: async ({ parameters }: any) => {
      const signature = await sign({
        hash: `0x${"22".repeat(32)}`,
        privateKey: PRIVATE_KEY,
      });
      return {
        activity: {
          id: "id",
          status: "ACTIVITY_STATUS_COMPLETED",
          type: "ACTIVITY_TYPE_SIGN_TRANSACTION_V2",
          result: {
            signTransactionResult: {
              // echo the unsigned tx so the test can read its chainId
              signedTransaction: parameters.unsignedTransaction,
            },
          },
        },
      };
    },
  };
}

async function setup() {
  return createEIP1193Provider({
    turnkeyClient: fakeTurnkeyClient() as any,
    organizationId: ORGANIZATION_ID,
    walletId: WALLET_ID,
    chains: [CHAIN],
  });
}

const baseTx = {
  from: account.address,
  to: account.address,
  value: "0x0",
} as const;

describe("eth_signTransaction chainId binding", () => {
  it("defaults an omitted chainId to the active chain", async () => {
    const provider = await setup();
    const signed = (await provider.request({
      method: "eth_signTransaction",
      params: [{ ...baseTx }],
    } as any)) as Hex;

    expect(parseTransaction(signed).chainId).toBe(31337);
  });

  it("accepts a transaction whose chainId matches the active chain", async () => {
    const provider = await setup();
    const signed = (await provider.request({
      method: "eth_signTransaction",
      params: [{ ...baseTx, chainId: "0x7a69" }],
    } as any)) as Hex;

    expect(parseTransaction(signed).chainId).toBe(31337);
  });

  it("rejects a transaction targeting a different chain than the active one", async () => {
    const provider = await setup();
    await expect(
      provider.request({
        method: "eth_signTransaction",
        params: [{ ...baseTx, chainId: "0x1" }],
      } as any),
    ).rejects.toThrow();
  });
});

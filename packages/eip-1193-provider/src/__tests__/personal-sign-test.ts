import { describe, it, expect, jest } from "@jest/globals";

// The provider checks the chain id over RPC on startup. These tests are about
// what gets signed, so the node is stubbed out.
jest.mock("viem/utils", () => ({
  ...(jest.requireActual("viem/utils") as object),
  getHttpRpcClient: () => ({
    request: async ({ body }: { body: { method: string } }) => {
      if (body.method === "eth_chainId") return { result: "0x7a69" };
      throw new Error(`unexpected rpc method: ${body.method}`);
    },
  }),
}));

import {
  hashMessage,
  stringToHex,
  verifyMessage,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount, sign } from "viem/accounts";
import type { UUID } from "crypto";

import { createEIP1193Provider } from "../";

const PRIVATE_KEY: Hex = `0x${"11".repeat(32)}`;
const account = privateKeyToAccount(PRIVATE_KEY);

const ORGANIZATION_ID = "00000000-0000-0000-0000-000000000000" as UUID;
const WALLET_ID = "00000000-0000-0000-0000-000000000001" as UUID;

const CHAIN = {
  chainId: "0x7a69",
  chainName: "Anvil",
  rpcUrls: ["http://127.0.0.1:8545"],
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
};

/**
 * Stands in for a Turnkey client. It honours `HASH_FUNCTION_NO_OP` by signing
 * the payload exactly as given, so the payloads it records are exactly what
 * the provider asked Turnkey to sign.
 */
function fakeTurnkeyClient() {
  const payloads: string[] = [];

  return {
    payloads,
    signRawPayload: async ({
      payload,
      hashFunction,
    }: {
      payload: Hex;
      hashFunction: string;
    }) => {
      expect(hashFunction).toBe("HASH_FUNCTION_NO_OP");
      payloads.push(payload);

      const signature = await sign({ hash: payload, privateKey: PRIVATE_KEY });

      return {
        activity: {
          status: "ACTIVITY_STATUS_COMPLETED",
          result: {
            signRawPayloadResult: {
              r: signature.r.slice(2),
              s: signature.s.slice(2),
              v: String(Number(signature.v) - 27),
            },
          },
        },
      };
    },
  };
}

async function setup() {
  const turnkeyClient = fakeTurnkeyClient();
  const provider = await createEIP1193Provider({
    turnkeyClient: turnkeyClient as any,
    organizationId: ORGANIZATION_ID,
    walletId: WALLET_ID,
    chains: [CHAIN],
  });

  return { provider, turnkeyClient };
}

describe.each(["personal_sign", "eth_sign"] as const)("%s", (method) => {
  const paramsFor = (message: Hex, address: Address) =>
    method === "personal_sign" ? [message, address] : [address, message];

  it("signs the EIP-191 hash of the message, not the message itself", async () => {
    const { provider, turnkeyClient } = await setup();
    const message = stringToHex("A man, a plan, a canal, Panama");

    const signature = (await provider.request({
      method,
      params: paramsFor(message, account.address),
    } as any)) as Hex;

    expect(turnkeyClient.payloads).toEqual([hashMessage({ raw: message })]);
    await expect(
      verifyMessage({
        address: account.address,
        message: { raw: message },
        signature,
      }),
    ).resolves.toBe(true);
  });

  it("handles a message longer than 32 bytes", async () => {
    const { provider, turnkeyClient } = await setup();
    const message = stringToHex(
      "This message is definitely longer than thirty-two bytes.",
    );

    const signature = (await provider.request({
      method,
      params: paramsFor(message, account.address),
    } as any)) as Hex;

    expect(turnkeyClient.payloads).toEqual([hashMessage({ raw: message })]);
    await expect(
      verifyMessage({
        address: account.address,
        message: { raw: message },
        signature,
      }),
    ).resolves.toBe(true);
  });
});

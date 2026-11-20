import { describe, expect, jest, test } from "@jest/globals";
import {
  createWalletClient,
  custom,
  hashTypedData,
  parseSignature,
  recoverTypedDataAddress,
  type TypedDataDefinition,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { createAccountWithAddress, signTypedData } from "../index";

const signer = privateKeyToAccount(`0x${"11".repeat(32)}`);
const typedData = {
  domain: {
    name: "Test",
    version: "1",
    chainId: 1,
    verifyingContract: "0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC",
  },
  types: { Message: [{ name: "value", type: "uint256" }] },
  primaryType: "Message",
  message: { value: 42n },
} as const;

function setup() {
  // Sign the serialized payload, not the original input: this detects domain loss.
  const signRawPayload = jest.fn(async ({ payload }: { payload: string }) => {
    const signature = parseSignature(
      await signer.signTypedData(JSON.parse(payload)),
    );
    return {
      activity: { status: "ACTIVITY_STATUS_COMPLETED" },
      r: signature.r.slice(2),
      s: signature.s.slice(2),
      v: String(signature.yParity),
    };
  });
  const client = { signRawPayload } as unknown as Parameters<
    typeof createAccountWithAddress
  >[0]["client"];
  const account = createAccountWithAddress({
    client,
    organizationId: "test-org",
    signWith: signer.address,
  });
  return { account, client, signRawPayload };
}

const { domain: _domain, ...withoutDomain } = typedData;
const cases: { name: string; data: TypedDataDefinition }[] = [
  { name: "implicit domain type", data: typedData },
  {
    name: "explicit domain type",
    data: {
      ...typedData,
      types: {
        ...typedData.types,
        EIP712Domain: [
          { name: "name", type: "string" },
          { name: "version", type: "string" },
          { name: "chainId", type: "uint256" },
          { name: "verifyingContract", type: "address" },
        ],
      },
    },
  },
  { name: "empty domain", data: { ...typedData, domain: {} } },
  { name: "omitted domain", data: withoutDomain },
  {
    name: "zero chain ID",
    data: { ...typedData, domain: { ...typedData.domain, chainId: 0 } },
  },
  {
    name: "bigint chain ID",
    data: { ...typedData, domain: { ...typedData.domain, chainId: 11155111n } },
  },
  {
    name: "salted domain",
    data: {
      ...typedData,
      domain: { ...typedData.domain, salt: `0x${"22".repeat(32)}` },
    },
  },
];

describe("typed-data serialization", () => {
  test.each(cases)("signs the original $name", async ({ data }) => {
    const { account, signRawPayload } = setup();
    const original = structuredClone(data);
    const signature = await account.signTypedData(data);
    const payload = JSON.parse(signRawPayload.mock.calls[0]![0].payload);

    expect(hashTypedData(payload)).toBe(hashTypedData(data));
    expect(await recoverTypedDataAddress({ ...data, signature })).toBe(
      signer.address,
    );
    expect(data).toEqual(original);
    expect(signRawPayload).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "test-org",
        signWith: signer.address,
        encoding: "PAYLOAD_ENCODING_EIP712",
        hashFunction: "HASH_FUNCTION_NO_OP",
      }),
    );
  });

  test("matches wallet-client signing for an implicit domain type", async () => {
    const { account } = setup();
    const walletClient = createWalletClient({
      account,
      transport: custom({
        request: async () => {
          throw new Error("Local account signing should not make RPC requests");
        },
      }),
    });

    const accountSignature = await account.signTypedData(typedData);
    const walletSignature = await walletClient.signTypedData(typedData);

    expect(accountSignature).toBe(walletSignature);
    for (const signature of [accountSignature, walletSignature]) {
      expect(await recoverTypedDataAddress({ ...typedData, signature })).toBe(
        signer.address,
      );
    }
  });

  test("preserves explicitly supplied domain types", async () => {
    const { client, signRawPayload } = setup();
    const data = {
      ...typedData,
      types: { ...typedData.types, EIP712Domain: [] },
    };

    await signTypedData(client, data, "test-org", signer.address);

    const payload = JSON.parse(signRawPayload.mock.calls[0]![0].payload);
    expect(payload.types.EIP712Domain).toEqual([]);
    expect(payload.domain).toEqual(typedData.domain);
  });
});

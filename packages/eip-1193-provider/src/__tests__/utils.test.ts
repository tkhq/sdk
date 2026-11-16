import { describe, expect, it } from "@jest/globals";
import { parseTransaction } from "viem";
import { preprocessTransaction } from "../utils";

const transaction = {
  from: "0x1111111111111111111111111111111111111111",
  to: "0x2222222222222222222222222222222222222222",
  chainId: "0x1",
  nonce: "0x2",
  gas: "0x5208",
  value: "0x3",
  data: "0x1234",
} as const;

const accessList = [
  {
    address: "0x3333333333333333333333333333333333333333",
    storageKeys: [
      "0x0000000000000000000000000000000000000000000000000000000000000001",
    ],
  },
] as const;

describe("preprocessTransaction", () => {
  it.each([
    {
      name: "legacy",
      input: { ...transaction, type: "0x0", gasPrice: "0xa" },
      expected: { type: "legacy", gasPrice: 10n },
    },
    {
      name: "EIP-2930",
      input: { ...transaction, type: "0x1", gasPrice: "0xa", accessList },
      expected: { type: "eip2930", gasPrice: 10n, accessList },
    },
    {
      name: "EIP-1559",
      input: {
        ...transaction,
        type: "0x2",
        maxFeePerGas: "0xa",
        maxPriorityFeePerGas: "0x1",
        accessList,
      },
      expected: {
        type: "eip1559",
        maxFeePerGas: 10n,
        maxPriorityFeePerGas: 1n,
        accessList,
      },
    },
  ] as const)(
    "preserves $name transaction fields when serialized",
    ({ input, expected }) => {
      const serialized = preprocessTransaction(input);

      expect(serialized).not.toMatch(/^0x/);
      expect(parseTransaction(`0x${serialized}`)).toMatchObject({
        to: transaction.to,
        chainId: 1,
        nonce: 2,
        gas: 21000n,
        value: 3n,
        data: transaction.data,
        ...expected,
      });
    },
  );

  it("defaults transactions without a type to EIP-1559", () => {
    const serialized = preprocessTransaction({
      ...transaction,
      maxFeePerGas: "0xa",
      maxPriorityFeePerGas: "0x1",
    });

    expect(parseTransaction(`0x${serialized}`).type).toBe("eip1559");
  });

  it("rejects a priority fee above the maximum fee", () => {
    expect(() =>
      preprocessTransaction({
        ...transaction,
        type: "0x2",
        maxFeePerGas: "0x1",
        maxPriorityFeePerGas: "0xa",
      }),
    ).toThrow();
  });

  it.each([
    { type: "0x0", fee: "maxFeePerGas" },
    { type: "0x0", fee: "maxPriorityFeePerGas" },
    { type: "0x1", fee: "maxFeePerGas" },
    { type: "0x1", fee: "maxPriorityFeePerGas" },
  ] as const)(
    "ignores $fee on a $type transaction received as JSON",
    ({ type, fee }) => {
      const validRequest = { ...transaction, type, gasPrice: "0xb" } as const;
      const request = JSON.parse(
        JSON.stringify({ ...validRequest, [fee]: "0xa" }),
      );

      expect(preprocessTransaction(request)).toBe(
        preprocessTransaction(validRequest),
      );
    },
  );

  it("rejects an EIP-1559 transaction without a chain ID", () => {
    expect(() =>
      preprocessTransaction({
        type: "0x2",
        to: transaction.to,
        maxFeePerGas: "0xa",
      }),
    ).toThrow();
  });
});

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
jest.mock(
  "@utils",
  () => ({
    __esModule: true,
    parseSession: jest.fn(),
  }),
  { virtual: true },
);

import { TurnkeyClient } from "../__clients__/core";
import { StamperType } from "../__types__";

function createClient() {
  const client = new TurnkeyClient({
    organizationId: "org-id",
  });
  const solSendTransaction = jest.fn(async () => ({
    sendTransactionStatusId: "v1-status-id",
  }));
  const solSendTransactionV2 = jest.fn(async () => ({
    sendTransactionStatusId: "v2-status-id",
  }));

  (client as any).storageManager = {
    getActiveSession: async () => undefined,
  };
  (client as any).httpClient = {
    solSendTransaction,
    solSendTransactionV2,
  };

  return { client, solSendTransaction, solSendTransactionV2 };
}

describe("solSendTransaction helper", () => {
  it("routes signWith transactions to the v1 activity", async () => {
    const { client, solSendTransaction, solSendTransactionV2 } = createClient();

    await expect(
      client.solSendTransaction({
        organizationId: "org-id",
        stampWith: StamperType.Passkey,
        transaction: {
          unsignedTransaction: "AA==",
          signWith: "signer-a",
          caip2: "solana:devnet",
        },
      }),
    ).resolves.toBe("v1-status-id");

    expect(solSendTransaction).toHaveBeenCalledWith(
      {
        organizationId: "org-id",
        unsignedTransaction: "AA==",
        signWith: "signer-a",
        caip2: "solana:devnet",
      },
      StamperType.Passkey,
    );
    expect(solSendTransactionV2).not.toHaveBeenCalled();
  });

  it("routes signWiths transactions to the v2 activity", async () => {
    const { client, solSendTransaction, solSendTransactionV2 } = createClient();

    await expect(
      client.solSendTransaction({
        organizationId: "org-id",
        stampWith: StamperType.Passkey,
        transaction: {
          unsignedTransaction: "00",
          signWiths: ["signer-a", "signer-b"],
          caip2: "solana:devnet",
          sponsor: true,
        },
      }),
    ).resolves.toBe("v2-status-id");

    expect(solSendTransactionV2).toHaveBeenCalledWith(
      {
        organizationId: "org-id",
        unsignedTransaction: "00",
        signWiths: ["signer-a", "signer-b"],
        caip2: "solana:devnet",
        sponsor: true,
      },
      StamperType.Passkey,
    );
    expect(solSendTransaction).not.toHaveBeenCalled();
  });
});

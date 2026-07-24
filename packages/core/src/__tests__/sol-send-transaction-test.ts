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
    defaultStamperType: StamperType.Passkey,
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

describe("solSendTransaction", () => {
  it("uses v2 when ordered signers are provided", async () => {
    const { client, solSendTransaction, solSendTransactionV2 } = createClient();

    await expect(
      client.solSendTransaction({
        organizationId: "org-id",
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
        unsignedTransaction: "00",
        signWiths: ["signer-a", "signer-b"],
        caip2: "solana:devnet",
        sponsor: true,
        organizationId: "org-id",
      },
      StamperType.Passkey,
    );
    expect(solSendTransaction).not.toHaveBeenCalled();
  });

  it("keeps legacy single-signer requests on v1", async () => {
    const { client, solSendTransaction, solSendTransactionV2 } = createClient();

    await expect(
      client.solSendTransaction({
        organizationId: "org-id",
        transaction: {
          unsignedTransaction: "AA==",
          signWith: "signer-a",
          caip2: "solana:devnet",
        },
      }),
    ).resolves.toBe("v1-status-id");

    expect(solSendTransaction).toHaveBeenCalledWith(
      {
        unsignedTransaction: "AA==",
        signWith: "signer-a",
        caip2: "solana:devnet",
        organizationId: "org-id",
      },
      StamperType.Passkey,
    );
    expect(solSendTransactionV2).not.toHaveBeenCalled();
  });
});

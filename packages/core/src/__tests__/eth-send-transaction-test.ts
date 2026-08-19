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

function createClient(): {
  client: TurnkeyClient;
  ethSendTransaction: jest.Mock;
  ethSendTransactionV2: jest.Mock;
} {
  const client = new TurnkeyClient({
    organizationId: "org-id",
  });

  (client as any).storageManager = {
    getActiveSession: async () => undefined,
  };

  const ethSendTransaction = jest.fn(async () => ({
    sendTransactionStatusId: "status-id",
  }));
  const ethSendTransactionV2 = jest.fn(async () => ({
    sendTransactionStatusId: "status-id-v2",
  }));

  (client as any).httpClient = {
    ethSendTransaction,
    ethSendTransactionV2,
  };

  return { client, ethSendTransaction, ethSendTransactionV2 };
}

describe("ethSendTransaction", () => {
  it("forwards an explicit stampWith to the v1 endpoint", async () => {
    const { client, ethSendTransaction } = createClient();

    await client.ethSendTransaction({
      organizationId: "org-id",
      stampWith: StamperType.Passkey,
      transaction: {
        from: "0xfrom",
        to: "0xto",
        caip2: "eip155:1",
      },
    });

    expect(ethSendTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "0xfrom",
        to: "0xto",
        caip2: "eip155:1",
        organizationId: "org-id",
      }),
      StamperType.Passkey,
    );
  });

  it("forwards an explicit stampWith to the v2 endpoint", async () => {
    const { client, ethSendTransactionV2 } = createClient();

    await client.ethSendTransaction({
      organizationId: "org-id",
      stampWith: StamperType.Passkey,
      transaction: {
        from: "0xfrom",
        caip2: "eip155:1",
        calls: [{ to: "0xto" }],
      },
    });

    expect(ethSendTransactionV2).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "0xfrom",
        caip2: "eip155:1",
        calls: [{ to: "0xto" }],
        organizationId: "org-id",
      }),
      StamperType.Passkey,
    );
  });
});

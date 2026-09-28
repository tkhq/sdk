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
import {
  TurnkeyActivityConsensusNeededError,
  TurnkeyActivityError,
} from "@turnkey/http";

function createClient() {
  const client = new TurnkeyClient({
    organizationId: "org-id",
  });
  const activity = {
    id: "activity-id",
    status: "ACTIVITY_STATUS_COMPLETED",
    type: "ACTIVITY_TYPE_SOL_SEND_TRANSACTION",
  };
  const solSendTransaction = jest.fn(async () => ({
    activity,
    sendTransactionStatusId: "v1-status-id",
  }));
  const solSendTransactionV2 = jest.fn(async () => ({
    activity: {
      ...activity,
      type: "ACTIVITY_TYPE_SOL_SEND_TRANSACTION_V2",
    },
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

  it("surfaces failed activity details", async () => {
    const { client, solSendTransaction } = createClient();
    solSendTransaction.mockResolvedValueOnce({
      activity: {
        id: "failed-activity-id",
        status: "ACTIVITY_STATUS_FAILED",
        type: "ACTIVITY_TYPE_SOL_SEND_TRANSACTION",
        failure: { message: "Transaction denied by policy" },
      },
      sendTransactionStatusId: "",
    } as any);

    let error: unknown;
    try {
      await client.solSendTransaction({
        organizationId: "org-id",
        stampWith: StamperType.Passkey,
        transaction: {
          unsignedTransaction: "AA==",
          signWith: "signer-a",
          caip2: "solana:devnet",
        },
      });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(TurnkeyActivityError);
    expect(error).toMatchObject({
      message: "Transaction denied by policy",
      activityId: "failed-activity-id",
      activityStatus: "ACTIVITY_STATUS_FAILED",
      activityType: "ACTIVITY_TYPE_SOL_SEND_TRANSACTION",
    });
  });

  it("surfaces consensus-needed activity details", async () => {
    const { client, solSendTransaction } = createClient();
    solSendTransaction.mockResolvedValueOnce({
      activity: {
        id: "consensus-activity-id",
        status: "ACTIVITY_STATUS_CONSENSUS_NEEDED",
        type: "ACTIVITY_TYPE_SOL_SEND_TRANSACTION",
      },
      sendTransactionStatusId: "",
    } as any);

    let error: unknown;
    try {
      await client.solSendTransaction({
        organizationId: "org-id",
        stampWith: StamperType.Passkey,
        transaction: {
          unsignedTransaction: "AA==",
          signWith: "signer-a",
          caip2: "solana:devnet",
        },
      });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(TurnkeyActivityConsensusNeededError);
    expect(error).toMatchObject({
      message: "Send transaction activity requires consensus",
      activityId: "consensus-activity-id",
      activityStatus: "ACTIVITY_STATUS_CONSENSUS_NEEDED",
      activityType: "ACTIVITY_TYPE_SOL_SEND_TRANSACTION",
    });
  });
});

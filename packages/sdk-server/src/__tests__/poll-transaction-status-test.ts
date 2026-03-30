import { afterEach, describe, expect, it, jest } from "@jest/globals";
import {
  type TGetSendTransactionStatusResponse,
  TurnkeyErrorCodes,
} from "@turnkey/sdk-types";

import { TurnkeyApiClient } from "../sdk-client";

function createClientWithStatusResponse(
  response: TGetSendTransactionStatusResponse,
): TurnkeyApiClient {
  const client = new TurnkeyApiClient({
    stamper: {
      stamp: async () => ({
        stampHeaderName: "X-Stamp",
        stampHeaderValue: "stamp",
      }),
    },
    apiBaseUrl: "https://mocked.turnkey.com",
    organizationId: "org-id",
  });

  client.getSendTransactionStatus = async () => response;

  return client;
}

describe("pollTransactionStatus", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it("throws a turnkey error for failed transactions", async () => {
    jest.useFakeTimers();

    const response: TGetSendTransactionStatusResponse = {
      txStatus: "FAILED",
      error: {
        message: "execution reverted: Slippage check failed",
      },
    };

    const client = createClientWithStatusResponse(response);
    const promise = client.pollTransactionStatus({
      organizationId: "org-id",
      sendTransactionStatusId: "status-id",
      pollingIntervalMs: 10,
    });
    const rejectedError = promise.catch((error) => error);

    await jest.advanceTimersByTimeAsync(10);

    const error = await rejectedError;

    expect(error).toMatchObject({
      code: TurnkeyErrorCodes.POLL_TRANSACTION_STATUS_ERROR,
      message: "execution reverted: Slippage check failed",
      cause: response,
    });
  });

  it("falls back to the terminal status when no structured error is present", async () => {
    jest.useFakeTimers();

    const response: TGetSendTransactionStatusResponse = {
      txStatus: "CANCELLED",
    };

    const client = createClientWithStatusResponse(response);
    const promise = client.pollTransactionStatus({
      organizationId: "org-id",
      sendTransactionStatusId: "status-id",
      pollingIntervalMs: 10,
    });
    const rejectedError = promise.catch((error) => error);

    await jest.advanceTimersByTimeAsync(10);

    const error = await rejectedError;

    expect(error).toMatchObject({
      code: TurnkeyErrorCodes.POLL_TRANSACTION_STATUS_ERROR,
      message: "Transaction CANCELLED",
      cause: response,
    });
  });

  it("resolves once the transaction reaches a terminal success state", async () => {
    jest.useFakeTimers();

    const response: TGetSendTransactionStatusResponse = {
      txStatus: "COMPLETED",
      eth: {
        txHash: "0x123",
      },
    };

    const client = createClientWithStatusResponse(response);
    const promise = client.pollTransactionStatus({
      organizationId: "org-id",
      sendTransactionStatusId: "status-id",
      pollingIntervalMs: 10,
    });

    await jest.advanceTimersByTimeAsync(10);

    await expect(promise).resolves.toEqual(response);
  });
});

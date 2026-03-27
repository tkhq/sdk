import { afterEach, describe, expect, it, jest } from "@jest/globals";
import {
  type TGetSendTransactionStatusResponse,
  TurnkeyErrorCodes,
} from "@turnkey/sdk-types";

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

function createClientWithStatusResponse(
  response: TGetSendTransactionStatusResponse,
): TurnkeyClient {
  const client = new TurnkeyClient({
    organizationId: "org-id",
  });

  (client as any).storageManager = {
    getActiveSession: async () => undefined,
  };
  (client as any).httpClient = {
    getSendTransactionStatus: async () => response,
  };

  return client;
}

describe("pollTransactionStatus", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it("throws a TurnkeyError with the terminal status payload for failed EVM transactions", async () => {
    jest.useFakeTimers();

    const response: TGetSendTransactionStatusResponse = {
      txStatus: "FAILED",
      error: {
        message: "execution reverted: Slippage check failed",
        revertChain: [
          {
            address: "0xrouter",
            errorType: "ERROR_TYPE_CUSTOM",
            displayMessage: "SlippageCheckFailed(minOut=1000, actualOut=995)",
            custom: {
              errorName: "SlippageCheckFailed",
              paramsJson: '{"minOut":"1000","actualOut":"995"}',
            },
          },
        ],
        eth: {
          revertChain: [
            {
              address: "0xrouter",
              errorType: "ERROR_TYPE_CUSTOM",
              displayMessage: "SlippageCheckFailed(minOut=1000, actualOut=995)",
              custom: {
                errorName: "SlippageCheckFailed",
                paramsJson: '{"minOut":"1000","actualOut":"995"}',
              },
            },
          ],
        },
      },
    };

    const client = createClientWithStatusResponse(response);
    const promise = client.pollTransactionStatus({
      organizationId: "org-id",
      sendTransactionStatusId: "status-id",
      stampWith: StamperType.Passkey,
      pollingIntervalMs: 10,
    });
    const rejectedError = promise.catch((error) => error);

    await jest.advanceTimersByTimeAsync(10);

    const error = await rejectedError;

    expect(error).toMatchObject({
      name: "TurnkeyError",
      code: TurnkeyErrorCodes.POLL_TRANSACTION_STATUS_ERROR,
      message: "execution reverted: Slippage check failed",
      cause: response,
    });
    expect((error as any).cause?.error?.eth?.revertChain).toEqual(
      response.error?.eth?.revertChain,
    );
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
      stampWith: StamperType.Passkey,
      pollingIntervalMs: 10,
    });
    const rejectedError = promise.catch((error) => error);

    await jest.advanceTimersByTimeAsync(10);

    const error = await rejectedError;

    expect(error).toMatchObject({
      name: "TurnkeyError",
      code: TurnkeyErrorCodes.POLL_TRANSACTION_STATUS_ERROR,
      message: "Transaction CANCELLED",
      cause: response,
    });
  });
});

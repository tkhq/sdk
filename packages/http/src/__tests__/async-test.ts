import { fetch } from "../universal";
import { test, expect, jest, beforeEach } from "@jest/globals";
import {
  TurnkeyApi,
  init,
  withAsyncPolling,
  TurnkeyActivityError,
} from "../index";
import { readFixture } from "../__fixtures__/shared";
import type { TActivity } from "../shared";

jest.mock("cross-fetch");

beforeEach(async () => {
  jest.resetAllMocks();
  const { privateKey, publicKey } = await readFixture();

  init({
    apiPublicKey: publicKey,
    apiPrivateKey: privateKey,
    baseUrl: "https://mocked.turnkey.com",
  });
});

const sampleCreatePrivateKeysInput: TurnkeyApi.TCreatePrivateKeysInput = {
  body: {
    type: "ACTIVITY_TYPE_CREATE_PRIVATE_KEYS_V2",
    parameters: {
      privateKeys: [
        {
          privateKeyName: "hello",
          curve: "CURVE_SECP256K1",
          addressFormats: ["ADDRESS_FORMAT_ETHEREUM"],
          privateKeyTags: [],
        },
      ],
    },
    organizationId: "89881fc7-6ff3-4b43-b962-916698f8ff58",
    timestampMs: String(Date.now()),
  },
};

test("`withAsyncPolling` should return data after activity completion", async () => {
  const mutation = withAsyncPolling({
    request: TurnkeyApi.createPrivateKeys,
  });

  const mockedFetch = fetch as jest.MockedFunction<typeof fetch>;

  const { expectedCallCount } = chainMockResponseSequence(mockedFetch, [
    {
      activity: {
        status: "ACTIVITY_STATUS_CREATED",
        type: "ACTIVITY_TYPE_CREATE_PRIVATE_KEYS_V2",
      },
    },
    {
      activity: {
        status: "ACTIVITY_STATUS_PENDING",
        type: "ACTIVITY_TYPE_CREATE_PRIVATE_KEYS_V2",
      },
    },
    {
      activity: {
        status: "ACTIVITY_STATUS_COMPLETED",
        type: "ACTIVITY_TYPE_CREATE_PRIVATE_KEYS_V2",
      },
    },
  ]);

  const result = await mutation(sampleCreatePrivateKeysInput);

  expect(fetch).toHaveBeenCalledTimes(expectedCallCount);
  expect(result).toMatchInlineSnapshot(`
    {
      "status": "ACTIVITY_STATUS_COMPLETED",
      "type": "ACTIVITY_TYPE_CREATE_PRIVATE_KEYS_V2",
    }
  `);
});

test("`withAsyncPolling` should throw a rich error when activity requires consensus", async () => {
  const mutation = withAsyncPolling({
    request: TurnkeyApi.createPrivateKeys,
  });

  const mockedFetch = fetch as jest.MockedFunction<typeof fetch>;

  const { expectedCallCount } = chainMockResponseSequence(mockedFetch, [
    {
      activity: {
        status: "ACTIVITY_STATUS_PENDING",
        type: "ACTIVITY_TYPE_CREATE_PRIVATE_KEYS_V2",
        id: "ee916c38-8151-460d-91c0-8bdbf5a9b20e",
      },
    },
    {
      activity: {
        status: "ACTIVITY_STATUS_CONSENSUS_NEEDED",
        type: "ACTIVITY_TYPE_CREATE_PRIVATE_KEYS_V2",
        id: "ee916c38-8151-460d-91c0-8bdbf5a9b20e",
      },
    },
  ]);

  try {
    await mutation(sampleCreatePrivateKeysInput);

    expect("the mutation above must throw").toEqual("an error");
  } catch (error) {
    expect(error).toBeInstanceOf(TurnkeyActivityError);
    const richError = error as TurnkeyActivityError;
    const { message, activityId, activityStatus, activityType } = richError;

    expect({
      message,
      activityId,
      activityStatus,
      activityType,
    }).toMatchInlineSnapshot(`
      {
        "activityId": "ee916c38-8151-460d-91c0-8bdbf5a9b20e",
        "activityStatus": "ACTIVITY_STATUS_CONSENSUS_NEEDED",
        "activityType": "ACTIVITY_TYPE_CREATE_PRIVATE_KEYS_V2",
        "message": "Consensus needed for activity ee916c38-8151-460d-91c0-8bdbf5a9b20e",
      }
    `);
  }

  expect(fetch).toHaveBeenCalledTimes(expectedCallCount);
});

test("`withAsyncPolling` should throw a rich error when activity is rejected", async () => {
  const mutation = withAsyncPolling({
    request: TurnkeyApi.createPrivateKeys,
  });

  const mockedFetch = fetch as jest.MockedFunction<typeof fetch>;

  const { expectedCallCount } = chainMockResponseSequence(mockedFetch, [
    {
      activity: {
        status: "ACTIVITY_STATUS_PENDING",
        type: "ACTIVITY_TYPE_CREATE_PRIVATE_KEYS_V2",
        id: "ee916c38-8151-460d-91c0-8bdbf5a9b20e",
      },
    },
    {
      activity: {
        status: "ACTIVITY_STATUS_PENDING",
        type: "ACTIVITY_TYPE_CREATE_PRIVATE_KEYS_V2",
        id: "ee916c38-8151-460d-91c0-8bdbf5a9b20e",
      },
    },
    {
      activity: {
        status: "ACTIVITY_STATUS_REJECTED",
        type: "ACTIVITY_TYPE_CREATE_PRIVATE_KEYS_V2",
        id: "ee916c38-8151-460d-91c0-8bdbf5a9b20e",
      },
    },
  ]);

  try {
    await mutation(sampleCreatePrivateKeysInput);

    expect("the mutation above must throw").toEqual("an error");
  } catch (error) {
    expect(error).toBeInstanceOf(TurnkeyActivityError);
    const richError = error as TurnkeyActivityError;
    const { message, activityId, activityStatus, activityType } = richError;

    expect({
      message,
      activityId,
      activityStatus,
      activityType,
    }).toMatchInlineSnapshot(`
      {
        "activityId": "ee916c38-8151-460d-91c0-8bdbf5a9b20e",
        "activityStatus": "ACTIVITY_STATUS_REJECTED",
        "activityType": "ACTIVITY_TYPE_CREATE_PRIVATE_KEYS_V2",
        "message": "Activity ee916c38-8151-460d-91c0-8bdbf5a9b20e was rejected",
      }
    `);
  }

  expect(fetch).toHaveBeenCalledTimes(expectedCallCount);
});

test("`withAsyncPolling` should throw a rich error when activity fails", async () => {
  const mutation = withAsyncPolling({
    request: TurnkeyApi.createPrivateKeys,
  });

  const mockedFetch = fetch as jest.MockedFunction<typeof fetch>;

  const { expectedCallCount } = chainMockResponseSequence(mockedFetch, [
    {
      activity: {
        status: "ACTIVITY_STATUS_FAILED",
        type: "ACTIVITY_TYPE_CREATE_PRIVATE_KEYS_V2",
        id: "ee916c38-8151-460d-91c0-8bdbf5a9b20e",
      },
    },
  ]);

  try {
    await mutation(sampleCreatePrivateKeysInput);

    expect("the mutation above must throw").toEqual("an error");
  } catch (error) {
    expect(error).toBeInstanceOf(TurnkeyActivityError);
    const richError = error as TurnkeyActivityError;
    const { message, activityId, activityStatus, activityType } = richError;

    expect({
      message,
      activityId,
      activityStatus,
      activityType,
    }).toMatchInlineSnapshot(`
      {
        "activityId": "ee916c38-8151-460d-91c0-8bdbf5a9b20e",
        "activityStatus": "ACTIVITY_STATUS_FAILED",
        "activityType": "ACTIVITY_TYPE_CREATE_PRIVATE_KEYS_V2",
        "message": "Activity ee916c38-8151-460d-91c0-8bdbf5a9b20e failed",
      }
    `);
  }

  expect(fetch).toHaveBeenCalledTimes(expectedCallCount);
});

test("`withAsyncPolling` should also work with synchronous activity endpoints", async () => {
  const mutation = withAsyncPolling({
    request: TurnkeyApi.signTransaction,
  });

  const mockedFetch = fetch as jest.MockedFunction<typeof fetch>;

  const { expectedCallCount } = chainMockResponseSequence(mockedFetch, [
    {
      activity: {
        status: "ACTIVITY_STATUS_COMPLETED",
        type: "ACTIVITY_TYPE_SIGN_TRANSACTION",
      },
    },
  ]);

  const result = await mutation({
    body: {
      type: "ACTIVITY_TYPE_SIGN_TRANSACTION_V2",
      parameters: {
        signWith: "9725c4f7-8387-4990-9128-1d2218bef256",
        type: "TRANSACTION_TYPE_ETHEREUM",
        unsignedTransaction:
          "02e801808459682f008509d4ae542e8252089440f008f4c17075efca092ae650655f6693aeced00180c0",
      },
      organizationId: "89881fc7-6ff3-4b43-b962-916698f8ff58",
      timestampMs: String(Date.now()),
    },
  });

  expect(fetch).toHaveBeenCalledTimes(expectedCallCount);
  expect(result).toMatchInlineSnapshot(`
    {
      "status": "ACTIVITY_STATUS_COMPLETED",
      "type": "ACTIVITY_TYPE_SIGN_TRANSACTION",
    }
  `);
});

test("typecheck only: `withAsyncPolling` only works with mutations that return an activity", () => {
  // Legit ones
  withAsyncPolling({ request: TurnkeyApi.createApiKeys });
  withAsyncPolling({ request: TurnkeyApi.createInvitations });
  withAsyncPolling({ request: TurnkeyApi.createPolicy });
  withAsyncPolling({ request: TurnkeyApi.createPrivateKeys });
  withAsyncPolling({ request: TurnkeyApi.deleteApiKeys });
  withAsyncPolling({ request: TurnkeyApi.deleteInvitation });
  withAsyncPolling({ request: TurnkeyApi.deletePolicy });
  withAsyncPolling({ request: TurnkeyApi.signRawPayload });
  withAsyncPolling({ request: TurnkeyApi.signTransaction });
  withAsyncPolling({ request: TurnkeyApi.getActivity });

  // Invalid ones
  // @ts-expect-error
  withAsyncPolling({ request: TurnkeyApi.postGetOrganization });
  // @ts-expect-error
  withAsyncPolling({ request: TurnkeyApi.postGetPolicy });
  // @ts-expect-error
  withAsyncPolling({ request: TurnkeyApi.postGetUser });
  // @ts-expect-error
  withAsyncPolling({ request: TurnkeyApi.postGetActivities });
  // @ts-expect-error
  withAsyncPolling({ request: TurnkeyApi.postGetPolicies });
  // @ts-expect-error
  withAsyncPolling({ request: TurnkeyApi.postGetPrivateKeys });
  // @ts-expect-error
  withAsyncPolling({ request: TurnkeyApi.postGetUsers });
  // @ts-expect-error
  withAsyncPolling({ request: TurnkeyApi.postGetWhoami });
  // @ts-expect-error
  withAsyncPolling({ request: TurnkeyApi.postGetPrivateKey });
});

function createMockResponse(result: { activity: Partial<TActivity> }) {
  const response: any = {};
  response.status = 200;
  response.ok = true;
  response.json = async () => result;
  return Promise.resolve(response);
}

function chainMockResponseSequence(
  mockedFetch: jest.MockedFunction<typeof fetch>,
  responseSequence: Array<{ activity: Partial<TActivity> }>
): { expectedCallCount: number } {
  let cursor = mockedFetch;

  for (const item of responseSequence) {
    cursor = cursor.mockReturnValueOnce(createMockResponse(item));
  }

  return {
    expectedCallCount: responseSequence.length,
  };
}

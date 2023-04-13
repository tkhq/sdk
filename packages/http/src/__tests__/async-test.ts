import fetch from "isomorphic-unfetch";
import { test, expect, jest, beforeEach } from "@jest/globals";
import {
  PublicApiService,
  init,
  withAsyncPolling,
  TurnkeyActivityError,
} from "../index";
import { readFixture } from "../__fixtures__/shared";
import type { TActivity } from "../shared";

jest.mock("isomorphic-unfetch");

beforeEach(async () => {
  jest.resetAllMocks();
  const { privateKey, publicKey } = await readFixture();

  init({
    apiPublicKey: publicKey,
    apiPrivateKey: privateKey,
    baseUrl: "https://mocked.turnkey.io",
  });
});

const sampleCreatePrivateKeysInput: PublicApiService.TPostCreatePrivateKeysInput =
  {
    body: {
      type: "ACTIVITY_TYPE_CREATE_PRIVATE_KEYS",
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
    request: PublicApiService.postCreatePrivateKeys,
  });

  const mockedFetch = fetch as jest.MockedFunction<typeof fetch>;

  const { expectedCallCount } = chainMockResponseSequence(mockedFetch, [
    {
      activity: {
        status: "ACTIVITY_STATUS_CREATED",
        type: "ACTIVITY_TYPE_CREATE_PRIVATE_KEYS",
      },
    },
    {
      activity: {
        status: "ACTIVITY_STATUS_PENDING",
        type: "ACTIVITY_TYPE_CREATE_PRIVATE_KEYS",
      },
    },
    {
      activity: {
        status: "ACTIVITY_STATUS_COMPLETED",
        type: "ACTIVITY_TYPE_CREATE_PRIVATE_KEYS",
      },
    },
  ]);

  const result = await mutation(sampleCreatePrivateKeysInput);

  expect(fetch).toHaveBeenCalledTimes(expectedCallCount);
  expect(result).toMatchInlineSnapshot(`
    {
      "status": "ACTIVITY_STATUS_COMPLETED",
      "type": "ACTIVITY_TYPE_CREATE_PRIVATE_KEYS",
    }
  `);
});

test("`withAsyncPolling` should throw a rich error when activity requires consensus", async () => {
  const mutation = withAsyncPolling({
    request: PublicApiService.postCreatePrivateKeys,
  });

  const mockedFetch = fetch as jest.MockedFunction<typeof fetch>;

  const { expectedCallCount } = chainMockResponseSequence(mockedFetch, [
    {
      activity: {
        status: "ACTIVITY_STATUS_PENDING",
        type: "ACTIVITY_TYPE_CREATE_PRIVATE_KEYS",
        id: "ee916c38-8151-460d-91c0-8bdbf5a9b20e",
      },
    },
    {
      activity: {
        status: "ACTIVITY_STATUS_CONSENSUS_NEEDED",
        type: "ACTIVITY_TYPE_CREATE_PRIVATE_KEYS",
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
        "activityType": "ACTIVITY_TYPE_CREATE_PRIVATE_KEYS",
        "message": "Consensus needed for activity ee916c38-8151-460d-91c0-8bdbf5a9b20e",
      }
    `);
  }

  expect(fetch).toHaveBeenCalledTimes(expectedCallCount);
});

test("`withAsyncPolling` should throw a rich error when activity is rejected", async () => {
  const mutation = withAsyncPolling({
    request: PublicApiService.postCreatePrivateKeys,
  });

  const mockedFetch = fetch as jest.MockedFunction<typeof fetch>;

  const { expectedCallCount } = chainMockResponseSequence(mockedFetch, [
    {
      activity: {
        status: "ACTIVITY_STATUS_PENDING",
        type: "ACTIVITY_TYPE_CREATE_PRIVATE_KEYS",
        id: "ee916c38-8151-460d-91c0-8bdbf5a9b20e",
      },
    },
    {
      activity: {
        status: "ACTIVITY_STATUS_PENDING",
        type: "ACTIVITY_TYPE_CREATE_PRIVATE_KEYS",
        id: "ee916c38-8151-460d-91c0-8bdbf5a9b20e",
      },
    },
    {
      activity: {
        status: "ACTIVITY_STATUS_REJECTED",
        type: "ACTIVITY_TYPE_CREATE_PRIVATE_KEYS",
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
        "activityType": "ACTIVITY_TYPE_CREATE_PRIVATE_KEYS",
        "message": "Activity ee916c38-8151-460d-91c0-8bdbf5a9b20e was rejected",
      }
    `);
  }

  expect(fetch).toHaveBeenCalledTimes(expectedCallCount);
});

test("`withAsyncPolling` should throw a rich error when activity fails", async () => {
  const mutation = withAsyncPolling({
    request: PublicApiService.postCreatePrivateKeys,
  });

  const mockedFetch = fetch as jest.MockedFunction<typeof fetch>;

  const { expectedCallCount } = chainMockResponseSequence(mockedFetch, [
    {
      activity: {
        status: "ACTIVITY_STATUS_FAILED",
        type: "ACTIVITY_TYPE_CREATE_PRIVATE_KEYS",
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
        "activityType": "ACTIVITY_TYPE_CREATE_PRIVATE_KEYS",
        "message": "Activity ee916c38-8151-460d-91c0-8bdbf5a9b20e failed",
      }
    `);
  }

  expect(fetch).toHaveBeenCalledTimes(expectedCallCount);
});

test("`withAsyncPolling` should also work with synchronous activity endpoints", async () => {
  const mutation = withAsyncPolling({
    request: PublicApiService.postSignTransaction,
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
      type: "ACTIVITY_TYPE_SIGN_TRANSACTION",
      parameters: {
        privateKeyId: "9725c4f7-8387-4990-9128-1d2218bef256",
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
  withAsyncPolling({ request: PublicApiService.postCreateApiKeys });
  withAsyncPolling({ request: PublicApiService.postCreateInvitations });
  withAsyncPolling({ request: PublicApiService.postCreatePolicy });
  withAsyncPolling({ request: PublicApiService.postCreatePrivateKeys });
  withAsyncPolling({ request: PublicApiService.postDeleteApiKeys });
  withAsyncPolling({ request: PublicApiService.postDeleteInvitation });
  withAsyncPolling({ request: PublicApiService.postDeletePolicy });
  withAsyncPolling({ request: PublicApiService.postSignRawPayload });
  withAsyncPolling({ request: PublicApiService.postSignTransaction });
  withAsyncPolling({ request: PublicApiService.postGetActivity });

  // Invalid ones
  // @ts-expect-error
  withAsyncPolling({ request: PublicApiService.postGetOrganization });
  // @ts-expect-error
  withAsyncPolling({ request: PublicApiService.postGetPolicy });
  // @ts-expect-error
  withAsyncPolling({ request: PublicApiService.postGetUser });
  // @ts-expect-error
  withAsyncPolling({ request: PublicApiService.postGetActivities });
  // @ts-expect-error
  withAsyncPolling({ request: PublicApiService.postGetPolicies });
  // @ts-expect-error
  withAsyncPolling({ request: PublicApiService.postGetPrivateKeys });
  // @ts-expect-error
  withAsyncPolling({ request: PublicApiService.postGetUsers });
  // @ts-expect-error
  withAsyncPolling({ request: PublicApiService.postGetWhoami });
  // @ts-expect-error
  withAsyncPolling({ request: PublicApiService.postGetPrivateKey });
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

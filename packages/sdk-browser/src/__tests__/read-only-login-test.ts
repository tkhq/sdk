import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from "@jest/globals";
import {
  TurnkeyActivityConsensusNeededError,
  TurnkeyActivityError,
  type TActivityStatus,
} from "@turnkey/http";
import { SessionType } from "@turnkey/sdk-types";
import {
  TurnkeyBrowserClient,
  TurnkeyPasskeyClient,
} from "../__clients__/browser-clients";
import WindowWrapper from "../__polyfills__/window";
import { AuthClient } from "../__types__/base";
import { StorageKeys } from "../storage";

const sessionResult = {
  userId: "user-id",
  organizationId: "organization-id",
  session: "new-session-token",
  sessionExpiry: "2000000000000",
};
const existingSession = {
  sessionType: SessionType.READ_ONLY,
  userId: "existing-user-id",
  organizationId: "organization-id",
  expiry: 1900000000000,
  token: "existing-session-token",
};
const config = {
  apiBaseUrl: "https://mocked.turnkey.com",
  organizationId: "organization-id",
  activityPoller: { intervalMs: 0, numRetries: 0 },
  stamper: {
    rpId: "localhost",
    stamp: async () => ({
      stampHeaderName: "X-Stamp",
      stampHeaderValue: "test-stamp",
    }),
  },
};

function activityResponse(status: TActivityStatus): Response {
  return new Response(
    JSON.stringify({
      activity: {
        id: "activity-id",
        organizationId: sessionResult.organizationId,
        type: "ACTIVITY_TYPE_CREATE_READ_ONLY_SESSION",
        status,
        result:
          status === "ACTIVITY_STATUS_COMPLETED"
            ? { createReadOnlySessionResult: sessionResult }
            : {},
      },
    }),
  );
}

describe.each([
  {
    name: "login",
    authClient: AuthClient.Passkey,
    login: (client: TurnkeyBrowserClient) => client.login(),
  },
  {
    name: "loginWithPasskey",
    authClient: AuthClient.Passkey,
    login: (client: TurnkeyBrowserClient) =>
      client.loginWithPasskey({ sessionType: SessionType.READ_ONLY }),
  },
  {
    name: "loginWithWallet",
    authClient: AuthClient.Wallet,
    login: (client: TurnkeyBrowserClient) =>
      client.loginWithWallet({ sessionType: SessionType.READ_ONLY }),
  },
  {
    name: "refreshSession",
    authClient: AuthClient.Passkey,
    login: (client: TurnkeyBrowserClient) =>
      client.refreshSession({ sessionType: SessionType.READ_ONLY }),
  },
])("$name READ_ONLY", ({ name, authClient, login }) => {
  let stored: Map<string, string>;
  let client: TurnkeyBrowserClient;
  let fetchMock: jest.SpiedFunction<typeof fetch>;

  beforeEach(() => {
    stored = new Map([
      [StorageKeys.Session, JSON.stringify(existingSession)],
      [StorageKeys.Client, JSON.stringify(AuthClient.Passkey)],
    ]);
    jest
      .spyOn(WindowWrapper.localStorage, "getItem")
      .mockImplementation((key) => stored.get(key) ?? null);
    jest
      .spyOn(WindowWrapper.localStorage, "setItem")
      .mockImplementation((key, value) => stored.set(key, value));
    fetchMock = jest.spyOn(globalThis, "fetch");
    client =
      authClient === AuthClient.Wallet
        ? new TurnkeyBrowserClient(config, authClient)
        : new TurnkeyPasskeyClient(config);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test.each<TActivityStatus>([
    "ACTIVITY_STATUS_AUTHENTICATORS_NEEDED",
    "ACTIVITY_STATUS_FAILED",
    "ACTIVITY_STATUS_REJECTED",
    "ACTIVITY_STATUS_CONSENSUS_NEEDED",
    "ACTIVITY_STATUS_CREATED",
    "ACTIVITY_STATUS_PENDING",
  ])("rejects %s without changing storage", async (status) => {
    fetchMock.mockImplementation(async () => activityResponse(status));
    const before = new Map(stored);

    const result = login(client);
    await expect(result).rejects.toBeInstanceOf(
      status === "ACTIVITY_STATUS_CONSENSUS_NEEDED"
        ? TurnkeyActivityConsensusNeededError
        : TurnkeyActivityError,
    );
    await expect(result).rejects.toMatchObject({
      activityId: "activity-id",
      activityStatus: status,
    });
    expect(WindowWrapper.localStorage.setItem).not.toHaveBeenCalled();
    expect(stored).toEqual(before);
    if (status === "ACTIVITY_STATUS_AUTHENTICATORS_NEEDED") {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    }
  });

  test("stops polling when a pending activity requires MFA", async () => {
    fetchMock
      .mockImplementationOnce(async () =>
        activityResponse("ACTIVITY_STATUS_PENDING"),
      )
      .mockImplementation(async () =>
        activityResponse("ACTIVITY_STATUS_AUTHENTICATORS_NEEDED"),
      );
    const before = new Map(stored);

    const result = login(client);
    await expect(result).rejects.toBeInstanceOf(TurnkeyActivityError);
    await expect(result).rejects.toMatchObject({
      activityId: "activity-id",
      activityStatus: "ACTIVITY_STATUS_AUTHENTICATORS_NEEDED",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(WindowWrapper.localStorage.setItem).not.toHaveBeenCalled();
    expect(stored).toEqual(before);
  });

  test.each([false, true])(
    "stores a completed session (initially pending: %s)",
    async (pending) => {
      if (pending) {
        fetchMock.mockImplementationOnce(async () =>
          activityResponse("ACTIVITY_STATUS_PENDING"),
        );
      }
      fetchMock.mockImplementation(async () =>
        activityResponse("ACTIVITY_STATUS_COMPLETED"),
      );

      const result = await login(client);

      expect(JSON.parse(stored.get(StorageKeys.Session)!)).toEqual({
        sessionType: SessionType.READ_ONLY,
        userId: sessionResult.userId,
        organizationId: sessionResult.organizationId,
        expiry: Number(sessionResult.sessionExpiry),
        token: sessionResult.session,
      });
      expect(JSON.parse(stored.get(StorageKeys.Client)!)).toBe(authClient);
      expect(fetchMock).toHaveBeenCalledTimes(pending ? 2 : 1);
      if (name === "login") {
        expect(result).toMatchObject(sessionResult);
      } else {
        expect(result).toBeUndefined();
      }
    },
  );
});

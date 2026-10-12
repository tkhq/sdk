import { afterEach, expect, jest, test } from "@jest/globals";

import { TurnkeySDKClientBase } from "../__generated__/sdk-client-base";
import { getAuthProxyConfig } from "../utils";

const originalFetch = global.fetch;
const originalRequest = global.Request;

afterEach(() => {
  global.fetch = originalFetch;
  global.Request = originalRequest;
});

test("authenticated requests reject redirects", async () => {
  const mockedFetch = jest
    .fn<typeof fetch>()
    .mockImplementation(async () => new Response("{}", { status: 200 }));
  global.fetch = mockedFetch;

  const client = new TurnkeySDKClientBase({
    apiBaseUrl: "https://mocked.turnkey.com",
    authProxyUrl: "https://mocked.turnkey.com",
    authProxyConfigId: "config-id",
    organizationId: "organization-id",
    apiKeyStamper: {
      stamp: async () => ({
        stampHeaderName: "X-Stamp",
        stampHeaderValue: "stamp",
      }),
    },
  });

  await client.request("/request", {});
  expect(mockedFetch.mock.lastCall![1]?.redirect).toBe("error");

  await client.sendSignedRequest({
    url: "https://mocked.turnkey.com/request",
    body: "{}",
    stamp: {
      stampHeaderName: "X-Stamp",
      stampHeaderValue: "stamp",
    },
  });
  expect(mockedFetch.mock.lastCall![1]?.redirect).toBe("error");

  await client.authProxyRequest("/request", {});
  expect(mockedFetch.mock.lastCall![1]?.redirect).toBe("error");

  await getAuthProxyConfig("config-id", "https://mocked.turnkey.com");
  expect(mockedFetch.mock.lastCall![1]?.redirect).toBe("error");
});

test("requests fail before sending when redirect blocking is unsupported", async () => {
  const redirectedRequest = jest.fn();
  const mockedFetch = jest.fn<typeof fetch>().mockImplementation(async () => {
    redirectedRequest();
    return new Response("{}", { status: 200 });
  });
  global.fetch = mockedFetch;
  global.Request = class {
    constructor(_input: RequestInfo | URL, _init?: RequestInit) {}
  } as unknown as typeof Request;

  const client = new TurnkeySDKClientBase({
    apiBaseUrl: "https://mocked.turnkey.com",
    organizationId: "organization-id",
    apiKeyStamper: {
      stamp: async () => ({
        stampHeaderName: "X-Stamp",
        stampHeaderValue: "stamp",
      }),
    },
  });

  await expect(client.request("/request", {})).rejects.toThrow(
    "This runtime does not support redirect blocking.",
  );
  expect(mockedFetch).not.toHaveBeenCalled();
  expect(redirectedRequest).not.toHaveBeenCalled();
});

import { afterEach, expect, jest, test } from "@jest/globals";

import { TurnkeySDKClientBase } from "../__generated__/sdk-client-base";
import { getAuthProxyConfig } from "../utils";

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
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

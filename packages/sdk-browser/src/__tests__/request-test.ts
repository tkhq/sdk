import { afterEach, expect, jest, test } from "@jest/globals";

import { TurnkeySDKClientBase } from "../__generated__/sdk-client-base";

jest.mock("@polyfills/window", () => ({}), { virtual: true });

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
});

test("requests reject redirects", async () => {
  const mockedFetch = jest
    .fn<typeof fetch>()
    .mockResolvedValue(new Response("{}", { status: 200 }));
  global.fetch = mockedFetch;

  const client = new TurnkeySDKClientBase({
    apiBaseUrl: "https://mocked.turnkey.com",
    organizationId: "organization-id",
    readOnlySession: "session",
  });

  await client.request("/request", {});

  expect(mockedFetch.mock.lastCall![1]?.redirect).toBe("error");
});

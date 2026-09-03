import { afterEach, expect, jest, test } from "@jest/globals";

import { TurnkeySDKClientBase } from "../__generated__/sdk-client-base";
import { TurnkeyBrowserSDK } from "../sdk-client";

jest.mock("@polyfills/window", () => ({}));

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

test("server-sign requests do not forward their body after a redirect", async () => {
  const redirectedRequest = jest.fn();
  const mockedFetch = jest
    .fn<typeof fetch>()
    .mockImplementation(async (_input, init) => {
      if (init?.redirect !== "error") {
        redirectedRequest(init?.body, init?.headers);
        return new Response("{}", { status: 200 });
      }

      throw new TypeError("redirect mode is set to error");
    });
  global.fetch = mockedFetch;

  const client = new TurnkeyBrowserSDK({
    apiBaseUrl: "https://mocked.turnkey.com",
    defaultOrganizationId: "organization-id",
    serverSignUrl: "https://server-sign.example",
  });

  await expect(
    client.serverSign("emailAuth", [
      {
        email: "user@example.com",
        organizationId: "organization-id",
        targetPublicKey: "public-key",
      },
    ]),
  ).rejects.toThrow("redirect mode is set to error");
  expect(redirectedRequest).not.toHaveBeenCalled();
});

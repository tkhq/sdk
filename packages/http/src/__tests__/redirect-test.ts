import { fetch } from "../universal";
import { beforeEach, expect, jest, test } from "@jest/globals";
import { TurnkeyClient } from "../__generated__/services/coordinator/public/v1/public_api.client";

jest.mock("cross-fetch");

const mockedFetch = fetch as jest.MockedFunction<typeof fetch>;

const client = new TurnkeyClient(
  { baseUrl: "https://mocked.turnkey.com" },
  {
    stamp: async () => ({
      stampHeaderName: "X-Stamp",
      stampHeaderValue: "stamp",
    }),
  },
);

beforeEach(() => {
  mockedFetch.mockReset();
});

test("does not follow redirects", async () => {
  mockedFetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({}),
  } as any);

  await client.request("/request", {});

  // "manual", not "error": Cloudflare Workers rejects "error".
  expect(mockedFetch.mock.lastCall?.[1]?.redirect).toBe("manual");
});

test.each([301, 302, 307, 308])("refuses a %i redirect", async (status) => {
  mockedFetch.mockResolvedValue({
    ok: false,
    status,
    json: async () => ({}),
  } as any);

  await expect(client.request("/request", {})).rejects.toThrow(
    `redirected (${status})`,
  );
  expect(mockedFetch).toHaveBeenCalledTimes(1);
});

test("refuses an opaque browser redirect", async () => {
  mockedFetch.mockResolvedValue({
    ok: false,
    status: 0,
    type: "opaqueredirect",
    json: async () => ({}),
  } as any);

  await expect(client.request("/request", {})).rejects.toThrow("redirected");
});

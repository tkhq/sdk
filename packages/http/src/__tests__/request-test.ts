import fetch, { Response } from "node-fetch";
import { test, expect, jest } from "@jest/globals";
import { PublicApiService, init } from "../index";
import { readFixture } from "../__fixtures__/shared";

jest.mock("node-fetch");

test("requests are stamped after initialization", async () => {
  const { privateKey, publicKey } = await readFixture();

  init({
    apiPublicKey: publicKey,
    apiPrivateKey: privateKey,
    baseUrl: "https://mocked.turnkey.io",
  });

  const mockedFetch = fetch as jest.MockedFunction<typeof fetch>;

  const response = new Response();
  response.status = 200;
  response.ok = true;
  response.json = async () => ({});

  mockedFetch.mockReturnValue(Promise.resolve(response));

  await PublicApiService.postGetWhoami({
    body: {
      organizationId: "89881fc7-6ff3-4b43-b962-916698f8ff58",
    },
  });

  expect(fetch).toHaveBeenCalledTimes(1);

  const stamp = mockedFetch.mock.lastCall![1]?.headers?.["X-Stamp"];
  expect(stamp).toBeTruthy();
});

import { test, expect, jest } from "@jest/globals";

import { readFixture } from "../__fixtures__/shared";
import { Turnkey } from "../index";
import { fetch } from "../universal";

jest.mock("cross-fetch");

test("requests are stamped after client creation", async () => {
  const { privateKey, publicKey } = await readFixture();

  const turnkeyServerClient = new Turnkey({
    apiBaseUrl: "https://mocked.turnkey.com",
    apiPrivateKey: privateKey,
    apiPublicKey: publicKey,
    defaultOrganizationId: "89881fc7-6ff3-4b43-b962-916698f8ff58",
  });

  const mockedFetch = fetch as jest.MockedFunction<typeof fetch>;

  const response: any = {};
  response.status = 200;
  response.ok = true;
  response.json = async () => ({});

  mockedFetch.mockReturnValue(Promise.resolve(response));

  await turnkeyServerClient.apiClient().getWhoami({
    organizationId: "89881fc7-6ff3-4b43-b962-916698f8ff58",
  });

  expect(fetch).toHaveBeenCalledTimes(1);

  const stamp = (mockedFetch.mock.lastCall![1]?.headers as any)?.["X-Stamp"];
  expect(stamp).toBeTruthy();
});

test("requests return grpc status details as part of their errors", async () => {
  const { privateKey, publicKey } = await readFixture();

  const turnkeyServerClient = new Turnkey({
    apiBaseUrl: "https://mocked.turnkey.com",
    apiPrivateKey: privateKey,
    apiPublicKey: publicKey,
    defaultOrganizationId: "89881fc7-6ff3-4b43-b962-916698f8ff58",
  });

  const mockedFetch = fetch as jest.MockedFunction<typeof fetch>;

  const response: any = {};
  response.status = 200;
  response.ok = false;
  response.json = async () => ({
    code: 1,
    message: "invalid request",
    details: [
      {
        "@type": "type.googleapis.com/google.rpc.BadRequest",
        fieldViolations: [
          {
            field: "privateKeys.0.privateKeyName",
            description: "This field must be unique.",
          },
        ],
      },
    ],
  });

  mockedFetch.mockReturnValue(Promise.resolve(response));

  try {
    // Arbitrary request URL
    await turnkeyServerClient.apiClient().getWhoami({
      organizationId: "89881fc7-6ff3-4b43-b962-916698f8ff58",
    });
  } catch (e: any) {
    expect(e.message).toEqual(
      `Turnkey error 1: invalid request (Details: [{\"@type\":\"type.googleapis.com/google.rpc.BadRequest\",\"fieldViolations\":[{\"field\":\"privateKeys.0.privateKeyName\",\"description\":\"This field must be unique.\"}]}])`
    );
    expect(e.details.length).toEqual(1);
    expect(e.details[0].fieldViolations.length).toEqual(1);
    expect(e.details[0].fieldViolations[0].field).toEqual(
      "privateKeys.0.privateKeyName"
    );
    expect(e.details[0].fieldViolations[0].description).toEqual(
      "This field must be unique."
    );
  }
});

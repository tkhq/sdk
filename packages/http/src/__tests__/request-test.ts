import { fetch } from "../universal";
import { test, expect, jest, beforeEach, describe } from "@jest/globals";
import { TurnkeyApi, TurnkeyClient, init } from "../index";
import { ApiKeyStamper } from "@turnkey/api-key-stamper";
import { readFixture } from "../__fixtures__/shared";

jest.mock("cross-fetch");

describe("Test requests with TurnkeyClient", () => {
  let turnkeyClient: TurnkeyClient;

  beforeEach(async () => {
    jest.resetAllMocks();
    const { privateKey, publicKey } = await readFixture();

    turnkeyClient = new TurnkeyClient(
      { baseUrl: "https://mocked.turnkey.com" },
      new ApiKeyStamper({
        apiPublicKey: publicKey,
        apiPrivateKey: privateKey,
      })
    );
  });

  test("requests are stamped after initialization", async () => {
    const mockedFetch = fetch as jest.MockedFunction<typeof fetch>;

    const response: any = {};
    response.status = 200;
    response.ok = true;
    response.json = async () => ({});

    mockedFetch.mockReturnValue(Promise.resolve(response));

    await turnkeyClient.getWhoami({
      organizationId: "89881fc7-6ff3-4b43-b962-916698f8ff58",
    });

    expect(fetch).toHaveBeenCalledTimes(1);

    const stamp = (mockedFetch.mock.lastCall![1]?.headers as any)?.["X-Stamp"];
    expect(stamp).toBeTruthy();
  });

  test("requests return grpc status details as part of their errors", async () => {
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
      await turnkeyClient.getWhoami({
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
});

describe("Test requests with deprecated TurnkeyApi", () => {
  beforeEach(async () => {
    jest.resetAllMocks();
  });
  
  test("requests are stamped after initialization", async () => {
    const { privateKey, publicKey } = await readFixture();

    init({
      apiPublicKey: publicKey,
      apiPrivateKey: privateKey,
      baseUrl: "https://mocked.turnkey.com",
    });

    const mockedFetch = fetch as jest.MockedFunction<typeof fetch>;

    const response: any = {};
    response.status = 200;
    response.ok = true;
    response.json = async () => ({});

    mockedFetch.mockReturnValue(Promise.resolve(response));

    await TurnkeyApi.getWhoami({
      body: {
        organizationId: "89881fc7-6ff3-4b43-b962-916698f8ff58",
      },
    });

    expect(fetch).toHaveBeenCalledTimes(1);

    const stamp = (mockedFetch.mock.lastCall![1]?.headers as any)?.["X-Stamp"];
    expect(stamp).toBeTruthy();
  });

  test("requests return grpc status details as part of their errors", async () => {
    const { privateKey, publicKey } = await readFixture();

    init({
      apiPublicKey: publicKey,
      apiPrivateKey: privateKey,
      baseUrl: "https://mocked.turnkey.com",
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
      await TurnkeyApi.getWhoami({
        body: {
          organizationId: "89881fc7-6ff3-4b43-b962-916698f8ff58",
        },
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
});
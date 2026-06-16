import { fetch } from "../universal";
import { beforeEach, test, expect, jest } from "@jest/globals";
import { TurnkeyApi, init } from "../index";
import { readFixture } from "../__fixtures__/shared";
import {
  parseGrpcGatewayStream,
  requestStream,
  TurnkeyRequestError,
} from "../base";

jest.mock("cross-fetch");

beforeEach(() => {
  const mockedFetch = fetch as jest.MockedFunction<typeof fetch>;
  mockedFetch.mockClear();
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
      `Turnkey error 1: invalid request (Details: [{\"@type\":\"type.googleapis.com/google.rpc.BadRequest\",\"fieldViolations\":[{\"field\":\"privateKeys.0.privateKeyName\",\"description\":\"This field must be unique.\"}]}])`,
    );

    expect(e.details.length).toEqual(1);
    expect(e.details[0].fieldViolations.length).toEqual(1);
    expect(e.details[0].fieldViolations[0].field).toEqual(
      "privateKeys.0.privateKeyName",
    );
    expect(e.details[0].fieldViolations[0].description).toEqual(
      "This field must be unique.",
    );
  }
});

test("streaming requests are stamped and yield grpc-gateway result frames", async () => {
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
  response.body = chunkBody(
    '{"result":{"podName":"pod-a"}}\n',
    '{"result":{"podName":"pod-b"}}\n',
  );

  mockedFetch.mockReturnValue(Promise.resolve(response));

  const body = {
    organizationId: "89881fc7-6ff3-4b43-b962-916698f8ff58",
    deploymentId: "deployment-id",
  };

  const results = await collect(
    requestStream<{ podName: string }, typeof body>({
      uri: "/public/v1/query/get_enclave_debug_logs",
      method: "POST",
      body,
    }),
  );

  expect(results).toEqual([{ podName: "pod-a" }, { podName: "pod-b" }]);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(mockedFetch.mock.lastCall![0]).toEqual(
    "https://mocked.turnkey.com/public/v1/query/get_enclave_debug_logs",
  );
  expect(mockedFetch.mock.lastCall![1]?.body).toEqual(JSON.stringify(body));

  const stamp = (mockedFetch.mock.lastCall![1]?.headers as any)?.["X-Stamp"];
  expect(stamp).toBeTruthy();
});

test("grpc-gateway stream parser handles split frames", async () => {
  const results = await collect(
    parseGrpcGatewayStream<{ podName: string }>(
      chunkBody(
        '{"result":{"podName":"pod-a"}}\n{"res',
        'ult":{"podName":"pod-b"}}\n',
      ),
      (status) => new TurnkeyRequestError(status),
    ),
  );

  expect(results).toEqual([{ podName: "pod-a" }, { podName: "pod-b" }]);
});

test("grpc-gateway stream parser supports ReadableStream bodies", async () => {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(
        new TextEncoder().encode('{"result":{"podName":"pod-a"}}\n'),
      );
      controller.close();
    },
  });

  const results = await collect(
    parseGrpcGatewayStream<{ podName: string }>(
      stream,
      (status) => new TurnkeyRequestError(status),
    ),
  );

  expect(results).toEqual([{ podName: "pod-a" }]);
});

test("grpc-gateway stream parser throws TurnkeyRequestError on error frames", async () => {
  await expect(
    collect(
      parseGrpcGatewayStream<{ podName: string }>(
        chunkBody(
          '{"result":{"podName":"pod-a"}}\n',
          '{"error":{"code":7,"message":"permission denied","details":null}}\n',
        ),
        (status) => new TurnkeyRequestError(status),
      ),
    ),
  ).rejects.toThrow("Turnkey error 7: permission denied");
});

test("streaming requests return grpc status details as part of non-OK errors", async () => {
  const { privateKey, publicKey } = await readFixture();

  init({
    apiPublicKey: publicKey,
    apiPrivateKey: privateKey,
    baseUrl: "https://mocked.turnkey.com",
  });

  const mockedFetch = fetch as jest.MockedFunction<typeof fetch>;

  const response: any = {};
  response.status = 403;
  response.ok = false;
  response.json = async () => ({
    code: 7,
    message: "permission denied",
    details: null,
  });

  mockedFetch.mockReturnValue(Promise.resolve(response));

  await expect(
    collect(
      requestStream({
        uri: "/public/v1/query/get_enclave_debug_logs",
        method: "POST",
        body: {
          organizationId: "89881fc7-6ff3-4b43-b962-916698f8ff58",
        },
      }),
    ),
  ).rejects.toThrow("Turnkey error 7: permission denied");
});

async function collect<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const results: T[] = [];
  for await (const item of iterable) {
    results.push(item);
  }
  return results;
}

async function* chunkBody(...chunks: string[]): AsyncGenerator<string> {
  for (const chunk of chunks) {
    yield chunk;
  }
}

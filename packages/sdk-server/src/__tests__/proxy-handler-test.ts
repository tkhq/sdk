import { describe, expect, it } from "@jest/globals";
import type { Request, Response } from "express";

import type { NextApiRequest, NextApiResponse } from "../__types__/base";
import { TurnkeyServerSDK } from "../sdk-client";

const serverConfig = {
  apiBaseUrl: "https://api.turnkey.com",
  apiPublicKey: `02${"ab".repeat(32)}`,
  apiPrivateKey: "ab".repeat(32),
  defaultOrganizationId: "00000000-0000-0000-0000-000000000000",
};

const next = () => undefined;

function createSdk(): TurnkeyServerSDK {
  return new TurnkeyServerSDK(serverConfig);
}

function createMockResponse() {
  const sent: Array<{ status: number; body: unknown }> = [];
  let statusCode = 200;
  let headersSent = false;

  const response = {
    get headersSent() {
      return headersSent;
    },
    status(code: number) {
      statusCode = code;
      return response;
    },
    send(body: unknown) {
      if (headersSent) {
        throw Object.assign(
          new Error("Cannot set headers after they are sent to the client"),
          { code: "ERR_HTTP_HEADERS_SENT" },
        );
      }
      headersSent = true;
      sent.push({ status: statusCode, body });
    },
    json(body: unknown) {
      response.send(body);
    },
  };

  return { response, sent };
}

describe("proxy handlers", () => {
  it("answers 400 once when express body omits methodName", async () => {
    const { response, sent } = createMockResponse();
    const handler = createSdk().expressProxyHandler({});

    await handler(
      { body: {} } as Request,
      response as unknown as Response,
      next,
    );

    expect(sent).toEqual([
      { status: 400, body: "methodName and params are required." },
    ]);
  });

  it("answers 400 once when express body omits params", async () => {
    const { response, sent } = createMockResponse();
    const handler = createSdk().expressProxyHandler({});

    await handler(
      { body: { methodName: "oauth" } } as Request,
      response as unknown as Response,
      next,
    );

    expect(sent).toEqual([
      { status: 400, body: "methodName and params are required." },
    ]);
  });

  it("answers 400 once when express body is missing", async () => {
    const { response, sent } = createMockResponse();
    const handler = createSdk().expressProxyHandler({});

    await handler(
      { body: undefined } as Request,
      response as unknown as Response,
      next,
    );

    expect(sent).toEqual([
      { status: 400, body: "methodName and params are required." },
    ]);
  });

  it("answers 401 once for a method outside the allowlist", async () => {
    const { response, sent } = createMockResponse();
    const handler = createSdk().expressProxyHandler({});

    await handler(
      { body: { methodName: "getWhoami", params: [{}] } } as Request,
      response as unknown as Response,
      next,
    );

    expect(sent).toEqual([{ status: 401, body: "Unauthorized proxy method" }]);
  });

  it("returns the proxied result once for an allowed method", async () => {
    const sdk = createSdk();
    sdk.apiProxy = async () => ({ ok: true });
    const { response, sent } = createMockResponse();

    await sdk.expressProxyHandler({})(
      { body: { methodName: "oauth", params: [{ foo: "bar" }] } } as Request,
      response as unknown as Response,
      next,
    );

    expect(sent).toEqual([{ status: 200, body: { ok: true } }]);
  });

  it("answers 500 once when the proxied method throws", async () => {
    const sdk = createSdk();
    sdk.apiProxy = async () => {
      throw new Error("boom");
    };
    const { response, sent } = createMockResponse();

    await sdk.expressProxyHandler({})(
      { body: { methodName: "oauth", params: [{}] } } as Request,
      response as unknown as Response,
      next,
    );

    expect(sent).toEqual([{ status: 500, body: "boom" }]);
  });

  it("does not send again when headers were already sent", async () => {
    const sdk = createSdk();
    const { response, sent } = createMockResponse();
    sdk.apiProxy = async () => {
      response.send("partial");
      throw new Error("boom");
    };

    await sdk.expressProxyHandler({})(
      { body: { methodName: "oauth", params: [{}] } } as Request,
      response as unknown as Response,
      next,
    );

    expect(sent).toEqual([{ status: 200, body: "partial" }]);
  });

  it("answers 400 once from the next handler", async () => {
    const { response, sent } = createMockResponse();
    const handler = createSdk().nextProxyHandler({});

    await handler(
      { body: {}, query: {} } as NextApiRequest,
      response as unknown as NextApiResponse,
    );

    expect(sent).toEqual([
      { status: 400, body: "methodName and params are required." },
    ]);
  });
});

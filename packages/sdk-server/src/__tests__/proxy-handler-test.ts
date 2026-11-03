import { describe, expect, test } from "@jest/globals";
import type { Request, Response } from "express";

import type { NextApiRequest, NextApiResponse } from "../__types__/base";
import { TurnkeyServerSDK } from "../sdk-client";

const serverConfig = {
  apiBaseUrl: "https://api.turnkey.com",
  apiPublicKey: "public-key",
  apiPrivateKey: "private-key",
  defaultOrganizationId: "organization-id",
};

// Express throws ERR_HTTP_HEADERS_SENT on a second send. Without a return
// after the 400, that rejection escapes the async handler and exits Node.
function createResponse() {
  let sent = false;

  return {
    statusCode: 0,
    body: undefined as unknown,
    status(statusCode: number) {
      this.statusCode = statusCode;
      return this;
    },
    send(body: unknown) {
      if (sent) {
        throw Object.assign(
          new Error("Cannot set headers after they are sent to the client"),
          { code: "ERR_HTTP_HEADERS_SENT" },
        );
      }
      sent = true;
      this.body = body;
    },
    json(body: unknown) {
      this.send(body);
    },
  };
}

const incompleteBodies = [{}, { methodName: "emailAuth" }, { params: [{}] }];

describe("proxy handler validation", () => {
  test.each(incompleteBodies)(
    "expressProxyHandler responds 400 once for %j",
    async (body) => {
      const response = createResponse();

      await expect(
        new TurnkeyServerSDK(serverConfig).expressProxyHandler({})(
          { body } as Request,
          response as unknown as Response,
        ),
      ).resolves.toBeUndefined();

      expect(response.statusCode).toBe(400);
      expect(response.body).toBe("methodName and params are required.");
    },
  );

  test.each(incompleteBodies)(
    "nextProxyHandler responds 400 once for %j",
    async (body) => {
      const response = createResponse();

      await expect(
        new TurnkeyServerSDK(serverConfig).nextProxyHandler({})(
          { body } as NextApiRequest,
          response as unknown as NextApiResponse,
        ),
      ).resolves.toBeUndefined();

      expect(response.statusCode).toBe(400);
      expect(response.body).toBe("methodName and params are required.");
    },
  );
});

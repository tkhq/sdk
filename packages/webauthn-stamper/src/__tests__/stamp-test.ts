import * as crypto from "crypto";

import { test, expect, beforeAll, jest } from "@jest/globals";
import { WebauthnStamper } from "../index";

// Ugly but necessary: we mock webauthn assertions to return a static value
// This lets us assert against it.
jest.mock("../webauthn-json", () => {
  return {
    get: (_: any) => {
      return {
        toJSON: () => {
          return {
            id: "credential-id",
            response: {
              authenticatorData: "authenticator-data",
              clientDataJSON: "client-data-json",
              signature: "the-signature",
            },
          };
        },
      };
    },
  };
});

beforeAll(() => {
  // @ts-expect-error -- we just need `crypto.subtle.digest` to work (used to compute challenge digests)
  globalThis.crypto = crypto.webcrypto;
});

test("uses provided signature to make stamp", async function () {
  const stamper = new WebauthnStamper({
    rpId: "some-rpid",
  });
  const challenge = "random-challenge";
  const stamp = await stamper.stamp(challenge);

  expect(stamp.stampHeaderName).toBe("X-Stamp-Webauthn");

  // We expect the stamp to be a valid JSON string after that
  expect(JSON.parse(stamp.stampHeaderValue)).toEqual({
    authenticatorData: "authenticator-data",
    clientDataJson: "client-data-json",
    credentialId: "credential-id",
    signature: "the-signature",
  });
});

import { test, expect } from "@jest/globals";
import { ApiKeyStamper } from "../index";
import { readFixture } from "../__fixtures__/shared";
import { assertValidSignature } from "./shared";

test("uses provided signature to make stamp", async function () {
  const { privateKey, publicKey, pemPublicKey } = await readFixture();

  const stamper = new ApiKeyStamper({
    apiPublicKey: publicKey,
    apiPrivateKey: privateKey,
  });
  const messageToSign = "hello from TKHQ!";
  const stamp = await stamper.stamp(messageToSign);

  expect(stamp.stampHeaderName).toBe("X-Stamp");

  // We expect the stamp to be base64url encoded
  const decodedStamp = JSON.parse(
    Buffer.from(stamp.stampHeaderValue, "base64url").toString()
  );
  // ...with 3 keys.
  expect(Object.keys(decodedStamp)).toEqual([
    "publicKey",
    "scheme",
    "signature",
  ]);

  // We assert against these keys one-by-one because P256 signatures aren't deterministic.
  // Can't snapshot!
  expect(decodedStamp["publicKey"]).toBe(publicKey);
  expect(decodedStamp["scheme"]).toBe("SIGNATURE_SCHEME_TK_API_P256");
  assertValidSignature({
    content: messageToSign,
    pemPublicKey: pemPublicKey,
    signature: decodedStamp["signature"],
  });
});

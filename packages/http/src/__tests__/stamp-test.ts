import * as crypto from "crypto";
import { test, expect } from "@jest/globals";
import { stamp } from "../stamp";
import { readFixture } from "../__fixtures__/shared";

test("sign", async () => {
  const { privateKey, publicKey, pemPublicKey } = await readFixture();

  const actualStamp = stamp({
    content: "hello",
    privateKey,
    publicKey,
  });
  expect(actualStamp.publicKey).toBe(publicKey);
  expect(actualStamp.scheme).toBe("SIGNATURE_SCHEME_TK_API_P256");

  // We cannot assert against actualStamp.signature directly, because P-256 signatures are not deterministic
  const verify = crypto.createVerify("SHA256");
  verify.update("hello");
  verify.end();
  const verified = verify.verify(pemPublicKey, actualStamp.signature, "hex");
  expect(verified).toBe(true);
});

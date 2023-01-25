import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { test, expect } from "@jest/globals";
import { stamp } from "../stamp";

const FIXTURES_DIR = path.resolve(__dirname, "..", "__fixtures__");

test("sign", async () => {
  const privateKey = await fs.promises.readFile(
    path.resolve(FIXTURES_DIR, "api-key.private"),
    "utf-8"
  );

  // These two formats represent the same public key
  const publicKey = await fs.promises.readFile(
    path.resolve(FIXTURES_DIR, "api-key.public"),
    "utf-8"
  );
  const pemPublicKey = await fs.promises.readFile(
    path.resolve(FIXTURES_DIR, "api-key.public.pem"),
    "utf-8"
  );

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

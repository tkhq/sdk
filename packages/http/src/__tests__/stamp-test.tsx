import { test, expect } from "@jest/globals";
import { stamp } from "../stamp";
import * as crypto from "crypto";

// Taken from https://github.com/tkhq/tkcli/blob/33ad5b5a5ca64c8b4cdb2d2994453278c31921cc/internal/apikey/apikey_test.go#L46
test("sign", () => {
  const privateKey =
    "487f361ddfd73440e707f4daa6775b376859e8a3c9f29b3bb694a12927c0213c";

  // These two formats represent the same public key
  // They're currently checked in at docs/fixtures/public_key.pem and docs/fixtures/tk_api_key.public
  // The process to go from PEM encoding to compressed public key format is explained in docs/public_api.md
  const publicKey =
    "02f739f8c77b32f4d5f13265861febd76e7a9c61a1140d296b8c16302508870316";
  const pemPublicKey = `-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE9zn4x3sy9NXxMmWGH+vXbnqcYaEU
DSlrjBYwJQiHAxbCSXCteBHM2dp/G4jyAr66x3BmPvWLpoNGGG3XeCAN1A==
-----END PUBLIC KEY-----`;

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

import { test, expect } from "@jest/globals";
import * as fs from "fs";
import * as path from "path";

import { hpkeDecrypt } from "../crypto";
import { decryptSecretBundle, importSecretsPurposeBinding } from "../turnkey";
import {
  uint8ArrayFromHexString,
  uint8ArrayToHexString,
} from "@turnkey/encoding";

// Captured from a real `export_secrets` activity against api.turnkey.com. The
// embedded private key was single-use and the plaintext is demo data, so the
// fixture carries no live credentials.
const fixture = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, "../__fixtures__/secret-payload.json"),
    "utf8",
  ),
);

test("decryptSecretBundle verifies the enclave signature and returns the plaintext", async () => {
  const plaintext = await decryptSecretBundle({
    secretPayload: fixture.secretPayload,
    embeddedPrivateKey: fixture.embeddedPrivateKey,
    organizationId: fixture.organizationId,
  });

  expect(plaintext).toBe(fixture.plaintext);
});

// Vector from the ImportSecrets ingress AAD spec (enclave_encrypt_v2).
test("importSecretsPurposeBinding matches the enclave_encrypt_v2 vector", () => {
  const properties = [
    { key: "kind", value: "credit-card" },
    { key: "dual-agent-consensus", value: "true" },
  ];
  const binding = importSecretsPurposeBinding("corp-amex", properties);
  expect(uint8ArrayToHexString(binding)).toBe(
    "00000028454e435259505445445f494e47524553535f505552504f53455f494d504f52545f5345435245545300000009636f72702d616d657800000002000000046b696e640000000b6372656469742d63617264000000146475616c2d6167656e742d636f6e73656e7375730000000474727565",
  );

  const decrypt = (purposeBinding: Uint8Array) =>
    new TextDecoder().decode(
      hpkeDecrypt({
        ciphertextBuf: uint8ArrayFromHexString(
          "9afdba7451b5eacebb7e76a45b9860f968263279fb6b3ae3324a570ff48b0e8149dcc7af23a46ce01a319ca760a40f27da4cb738ccb0d5141ad3ce9738ce99d07e7bce10de3b58ee5454",
        ),
        encappedKeyBuf: uint8ArrayFromHexString(
          "04d65a93977caa3d1b081852ff57a79e465f1660577304baead505dd3a48589cf350185e895372df6221ea3a137557e473fddb6755f05bd507c3c533fce9c91285",
        ),
        receiverPriv:
          "1111111111111111111111111111111111111111111111111111111111111111",
        purposeBinding,
      }),
    );

  expect(decrypt(binding)).toBe(
    '{"number":"4111111111111111","expiry":"12/30","cvv":"123"}',
  );
  expect(() => decrypt(new Uint8Array())).toThrow();
  expect(() =>
    decrypt(importSecretsPurposeBinding("corp-visa", properties)),
  ).toThrow();
});

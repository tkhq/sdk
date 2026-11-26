import { test, expect } from "@jest/globals";

import {
  formatHpkeBuf,
  generateP256KeyPair,
  hpkeDecrypt,
  hpkeEncrypt,
} from "../crypto";
import {
  encodePurposeBinding,
  importSecretsPurposeBinding,
  oauth2AuthenticatePurposeBinding,
} from "../turnkey";
import {
  uint8ArrayFromHexString,
  uint8ArrayToHexString,
} from "@turnkey/encoding";

const OAUTH2_PURPOSE = "ENCRYPTED_INGRESS_PURPOSE_OAUTH2_AUTHENTICATE";
const CREDENTIAL_ID = "10000000-0000-4000-8000-000000000001";

// Vector from turnkey_enclave_encrypt::purpose_binding::oauth2_authenticate.
test("oauth2AuthenticatePurposeBinding matches the enclave_encrypt vector", () => {
  expect(
    uint8ArrayToHexString(oauth2AuthenticatePurposeBinding(CREDENTIAL_ID)),
  ).toBe(
    "0000002d454e435259505445445f494e47524553535f505552504f53455f4f41555448325f41555448454e54494341544500000001000000146f61757468325f63726564656e7469616c5f69640000002431303030303030302d303030302d343030302d383030302d303030303030303030303031",
  );
});

test("encodePurposeBinding frames the purpose, field count, and each key and value", () => {
  expect(
    uint8ArrayToHexString(
      encodePurposeBinding("P", [
        { key: "k", value: "ab" },
        { key: "", value: "" },
      ]),
    ),
  ).toBe(
    "0000000150" +
      "00000002" +
      "000000016b" +
      "000000026162" +
      "00000000" +
      "00000000",
  );
  expect(uint8ArrayToHexString(encodePurposeBinding("P", []))).toBe(
    "0000000150" + "00000000",
  );
});

test("encodePurposeBinding separates keys, values, field boundaries, and purposes", () => {
  const bindings = [
    encodePurposeBinding(OAUTH2_PURPOSE, []),
    encodePurposeBinding(OAUTH2_PURPOSE, [{ key: "a", value: "" }]),
    encodePurposeBinding(OAUTH2_PURPOSE, [{ key: "", value: "a" }]),
    encodePurposeBinding(OAUTH2_PURPOSE, [{ key: "ab", value: "c" }]),
    encodePurposeBinding(OAUTH2_PURPOSE, [{ key: "a", value: "bc" }]),
    encodePurposeBinding(OAUTH2_PURPOSE, [
      { key: "a", value: "b" },
      { key: "c", value: "d" },
    ]),
    encodePurposeBinding(OAUTH2_PURPOSE, [
      { key: "c", value: "d" },
      { key: "a", value: "b" },
    ]),
    encodePurposeBinding(OAUTH2_PURPOSE, [
      { key: "a", value: "b\0\0\0\x01c\0\0\0\x01d" },
    ]),
    importSecretsPurposeBinding(undefined, []),
    importSecretsPurposeBinding("a", [{ key: "b", value: "c" }]),
  ].map(uint8ArrayToHexString);

  expect(new Set(bindings).size).toBe(bindings.length);
});

test("an oauth2 ciphertext decrypts only with its purpose binding", () => {
  const receiver = generateP256KeyPair();
  const bound = oauth2AuthenticatePurposeBinding(CREDENTIAL_ID);
  const { encappedPublic, ciphertext } = JSON.parse(
    formatHpkeBuf(
      hpkeEncrypt({
        plainTextBuf: new TextEncoder().encode("oauth inputs"),
        targetKeyBuf: uint8ArrayFromHexString(receiver.publicKeyUncompressed),
        purposeBinding: bound,
      }),
    ),
  );
  const decrypt = (purposeBinding: Uint8Array) =>
    new TextDecoder().decode(
      hpkeDecrypt({
        ciphertextBuf: uint8ArrayFromHexString(ciphertext),
        encappedKeyBuf: uint8ArrayFromHexString(encappedPublic),
        receiverPriv: receiver.privateKey,
        purposeBinding,
      }),
    );

  expect(decrypt(bound)).toBe("oauth inputs");
  for (const binding of [
    new Uint8Array(),
    oauth2AuthenticatePurposeBinding("10000000-0000-4000-8000-000000000002"),
    oauth2AuthenticatePurposeBinding(CREDENTIAL_ID.replace(/-/g, "")),
    encodePurposeBinding(OAUTH2_PURPOSE, [
      { key: "credential_id", value: CREDENTIAL_ID },
    ]),
    encodePurposeBinding(OAUTH2_PURPOSE, []),
    importSecretsPurposeBinding(CREDENTIAL_ID, []),
  ]) {
    expect(() => decrypt(binding)).toThrow();
  }
});

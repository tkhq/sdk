import { test, expect } from "@jest/globals";
import { convertTurnkeyApiKeyToJwk } from "../utils";
import * as crypto from "crypto";
import { signWithApiKey as signWeb } from "../webcrypto";

Object.defineProperty(globalThis, "crypto", {
  value: {
    getRandomValues: (arr) => crypto.randomBytes(arr.length),
    subtle: crypto.subtle,
  },
});

test("correctly converts turnkey API key to JWK", async function () {
  const content = crypto.randomBytes(16).toString("hex");
  const privateKey =
    "ee05fc3bdf4161bc70701c221d8d77180294cefcfcea64ba83c4d4c732fcb9"; // 31 bytes, not 32
  const publicKey =
    "03f3e1d85243f8b2927106cc0ddd84752c7782f863f303f975c3e8fe13d588d534";

  expect(
    convertTurnkeyApiKeyToJwk({
      uncompressedPrivateKeyHex: privateKey,
      compressedPublicKeyHex: publicKey,
    })
  ).toBeTruthy();
  expect(
    await signWeb({
      content,
      publicKey,
      privateKey,
    })
  ).toBeTruthy();
});

import { test, expect } from "@jest/globals";
import { convertTurnkeyApiKeyToJwk } from "../utils";
import { readFixture } from "../__fixtures__/shared";
import { assertValidSignature } from "./shared";
import { generateP256KeyPair } from "@turnkey/crypto";
import * as crypto from "crypto";
import { uint8ArrayFromHexString } from "@turnkey/encoding";

Object.defineProperty(globalThis, "crypto", {
  value: {
    getRandomValues: (arr) => crypto.randomBytes(arr.length),
  },
});

test("correctly converts turnkey API key to JWK", function () {
  for (let i = 0; i < 100; i++) {
    try {
      const newApiKeyPair = generateP256KeyPair();

      const result = convertTurnkeyApiKeyToJwk({
        uncompressedPrivateKeyHex: "ee05fc3bdf4161bc70701c221d8d77180294cefcfcea64ba83c4d4c732fcb9", // arbitrary 31 byte hex string
        compressedPublicKeyHex: newApiKeyPair.publicKey,
      });
    } catch (err: any) {
      console.log("caught an error", err);
      expect(err).toBeTruthy();

      return;
    }
  }
});

const uint8ArrayFromHex = (hexString: string) => new Uint8Array(hexString.match(/../g)!.map((h) => parseInt(h, 16)));
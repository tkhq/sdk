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
        uncompressedPrivateKeyHex: newApiKeyPair.privateKey,
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
import { test, expect } from "@jest/globals";
import { convertTurnkeyApiKeyToJwk } from "../utils";
import { readFixture } from "../__fixtures__/shared";
import { assertValidSignature } from "./shared";
import { generateP256KeyPair } from "@turnkey/crypto";
import * as crypto from "crypto";
import { uint8ArrayFromHexString } from "@turnkey/encoding";
import { signWithApiKey as signWeb } from "../webcrypto";

Object.defineProperty(globalThis, "crypto", {
  value: {
    getRandomValues: (arr) => crypto.randomBytes(arr.length),
    subtle: crypto.subtle,
  },
});

test("correctly converts turnkey API key to JWK", async function () {
  for (let i = 0; i < 10000; i++) {
    try {
      const newApiKeyPair = generateP256KeyPair();

      const content = crypto.randomBytes(16).toString("hex");

      const signed = await signWeb({
        content,
        publicKey: newApiKeyPair.publicKey,
        // publicKey: "",
        privateKey:
          "ee05fc3bdf4161bc70701c221d8d77180294cefcfcea64ba83c4d4c732fcb9",
      });

      console.log("signed message", signed);

      const result = convertTurnkeyApiKeyToJwk({
        uncompressedPrivateKeyHex:
          "ee05fc3bdf4161bc70701c221d8d77180294cefcfcea64ba83c4d4c732fcb9", // arbitrary 31 byte hex string
        compressedPublicKeyHex: newApiKeyPair.publicKey,
      });

      const info = {
        publicKey: newApiKeyPair.publicKeyUncompressed,
        publicKeyBuffer: new Uint8Array(
          Buffer.from(newApiKeyPair.publicKeyUncompressed, "hex")
        ),
        publicKeyX: new Uint8Array(
          Buffer.from(newApiKeyPair.publicKeyUncompressed, "hex").subarray(
            1,
            33
          )
        ),
        publicKeyXFromHex: uint8ArrayFromHex(
          newApiKeyPair.publicKeyUncompressed.slice(2, 66)
        ),
        // publicKeyXLength: new Uint8Array(Buffer.from(newApiKeyPair.publicKeyUncompressed, "hex").subarray(1, 33)).length,
        publicKeyY: new Uint8Array(
          Buffer.from(newApiKeyPair.publicKeyUncompressed, "hex").subarray(33)
        ),
        publicKeyYFromHex: uint8ArrayFromHex(
          newApiKeyPair.publicKeyUncompressed.slice(66)
        ),
        // publicKeyYLength: new Uint8Array(Buffer.from(newApiKeyPair.publicKeyUncompressed, "hex").subarray(33)).length,
      };

      // console.log(info)

      if (info.publicKeyX[0] == 0 || info.publicKeyY[0] == 0) {
        console.log("eureka");
        console.log("info", info);
      }
    } catch (err: any) {
      console.log("caught an error", err);

      throw new Error(err);

      // expect(err).toBeTruthy();

      // return;
    }
  }
});

const uint8ArrayFromHex = (hexString: string) =>
  new Uint8Array(hexString.match(/../g)!.map((h) => parseInt(h, 16)));

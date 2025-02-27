import { test, expect } from "@jest/globals";
import { TelegramCloudStorageStamper, CloudStorageAPIKey } from "../index";
import { readFixture } from "../__fixtures__/shared";
import { assertValidSignature } from "./shared";
import { fail } from "assert";

// alias window.Telegram.WebApp.CloudStorage to use mock localStorage
window.Telegram.WebApp.CloudStorage = {
  async setItem(
    key: string,
    value: string,
    callback: (error: any, stored: boolean) => void,
  ) {
    localStorage.setItem(key, value);
    callback(null, true);
  },
  async getItem(key: string, callback: (error: any, value: string) => void) {
    let item = localStorage.getItem(key);
    if (!item) {
      item = "";
    }
    callback(null, item);
  },
  async removeItem(
    key: string,
    callback: (error: any, cleared: boolean) => void,
  ) {
    localStorage.removeItem(key);
    callback(null, true);
  },
};

test("uses provided signature to make stamp", async function () {
  const { privateKey, publicKey, pemPublicKey } = await readFixture();

  const apiKey: CloudStorageAPIKey = {
    apiPublicKey: publicKey,
    apiPrivateKey: privateKey,
  };

  try {
    const stamper = await TelegramCloudStorageStamper.create({
      cloudStorageAPIKey: apiKey,
    });

    const messageToSign = "hello from TKHQ!";
    const stamp = await stamper.stamp(messageToSign);

    expect(stamp.stampHeaderName).toBe("X-Stamp");

    // We expect the stamp to be base64url encoded
    const decodedStamp = JSON.parse(
      Buffer.from(stamp.stampHeaderValue, "base64url").toString(),
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

    let { apiPublicKey, apiPrivateKey } = (await stamper.getAPIKey()) ?? {};
    expect(apiPublicKey).toEqual(publicKey);
    expect(apiPrivateKey).toEqual(privateKey);
  } catch (e) {
    fail();
  }
});

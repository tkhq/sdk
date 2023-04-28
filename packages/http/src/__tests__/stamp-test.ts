import * as crypto from "crypto";
import { test, expect } from "@jest/globals";
import { stamp } from "../universal";
import { readFixture } from "../__fixtures__/shared";
import { generateKeyPairWithOpenSsl } from "./shared";

test("sign with Turnkey fixture", async () => {
  const { privateKey, publicKey, pemPublicKey } = await readFixture();

  const content = crypto.randomBytes(16).toString("hex");

  const actualStamp = await stamp({
    content,
    privateKey,
    publicKey,
  });
  expect(actualStamp.publicKey).toBe(publicKey);
  expect(actualStamp.scheme).toBe("SIGNATURE_SCHEME_TK_API_P256");

  // We can't snapshot `actualStamp.signature` because P-256 signatures are not deterministic
  expect(
    assertValidSignature({
      content,
      pubKey: pemPublicKey,
      signature: actualStamp.signature,
    })
  ).toBe(true);

  // Sanity check
  expect(() => {
    assertValidSignature({
      content: "something else that wasn't stamped",
      pubKey: pemPublicKey,
      signature: actualStamp.signature,
    });
  }).toThrow();
});

test("sign with openssl generated key pairs", async () => {
  // Run 20 times, where each run spawns 10 keys in parallel -> 200 tests in total
  for (let i = 0; i < 20; i++) {
    await Promise.all(
      Array.from({ length: 10 }, () => true).map(async () => {
        const { privateKey, publicKey, pemPublicKey } =
          await generateKeyPairWithOpenSsl();

        // A string of random unicode characters
        const content = Array.from({ length: 64 }, () => {
          return String.fromCharCode(Math.floor(Math.random() * 65536));
        }).join("");

        const actualStamp = await stamp({
          content,
          privateKey,
          publicKey,
        });
        expect(actualStamp.publicKey).toBe(publicKey);
        expect(actualStamp.scheme).toBe("SIGNATURE_SCHEME_TK_API_P256");

        // We can't snapshot `actualStamp.signature` because P-256 signatures are not deterministic
        expect(
          assertValidSignature({
            content,
            pubKey: pemPublicKey,
            signature: actualStamp.signature,
          })
        ).toBe(true);

        // Sanity check
        expect(() => {
          assertValidSignature({
            content: "something else that wasn't stamped",
            pubKey: pemPublicKey,
            signature: actualStamp.signature,
          });
        }).toThrow();
      })
    );
  }
});

function assertValidSignature({
  content,
  pubKey,
  signature,
}: {
  content: string;
  pubKey: string;
  signature: string;
}): true {
  const verifier = crypto.createVerify("SHA256");
  verifier.update(content);
  verifier.end();

  if (verifier.verify(pubKey, signature, "hex")) {
    return true;
  }

  throw new Error(
    [
      `Invalid signature.`,
      `content: ${JSON.stringify(content)}`,
      `pubKey: ${JSON.stringify(pubKey)}`,
      `signature: ${JSON.stringify(signature)}`,
    ].join("\n")
  );
}

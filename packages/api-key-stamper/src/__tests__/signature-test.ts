import * as crypto from "crypto";
import { test, expect, beforeAll } from "@jest/globals";
import { signWithApiKey as signUniversal } from "../index";
import { assertValidSignature } from "./shared";
import { signWithApiKey as signNode } from "../nodecrypto";
import { signWithApiKey as signWeb } from "../webcrypto";
import { signWithApiKey as signPureJS } from "../purejs";

import { readFixture } from "../__fixtures__/shared";
import { generateKeyPairWithOpenSsl } from "./shared";

beforeAll(() => {
  // @ts-expect-error -- polyfilling the runtime for "webcrypto" and "universal"
  globalThis.crypto = crypto.webcrypto;
});

test.each([
  { impl: signNode, name: "sign (node crypto)" },
  { impl: signWeb, name: "sign (WebCrypto)" },
  { impl: signPureJS, name: "sign (PureJS)" },
  { impl: signUniversal, name: "sign (universal)" },
])("sign with Turnkey fixture: $name", async ({ impl: sign }) => {
  const { privateKey, publicKey, pemPublicKey } = await readFixture();

  const content = crypto.randomBytes(16).toString("hex");

  const signature = await sign({
    content,
    privateKey,
    publicKey,
  });

  // We can't snapshot `actualStamp.signature` because P-256 signatures are not deterministic
  expect(
    assertValidSignature({
      content,
      pemPublicKey,
      signature: signature,
    })
  ).toBe(true);

  // Sanity check
  expect(() => {
    assertValidSignature({
      content: "something else that wasn't stamped",
      pemPublicKey,
      signature: signature,
    });
  }).toThrow();
});

test.each([
  { impl: signNode, name: "stamp (node)" },
  { impl: signWeb, name: "stamp (WebCrypto)" },
  { impl: signUniversal, name: "stamp (universal)" },
])("sign with openssl generated key pairs: $name", async ({ impl: stamp }) => {
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

        const signature = await stamp({
          content,
          privateKey,
          publicKey,
        });

        // We can't snapshot `actualStamp.signature` because P-256 signatures are not deterministic
        expect(
          assertValidSignature({
            content,
            pemPublicKey,
            signature: signature,
          })
        ).toBe(true);

        // Sanity check
        expect(() => {
          assertValidSignature({
            content: "something else that wasn't stamped",
            pemPublicKey,
            signature: signature,
          });
        }).toThrow();
      })
    );
  }
});

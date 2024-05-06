import { p256 } from "@noble/curves/p256";
import { test, expect } from "@jest/globals";
import { stringToBase64urlString, p256Keygen, uint8ArrayToHexString } from "..";

// These test vectors can be verified with NodeJS:
//   $ node
//   > Buffer.from("<input value>").toString("base64url")
//   > <expected value>
test("stringToBase64urlString", async function () {
  // Trivial test string
  expect(stringToBase64urlString("hello")).toBe("aGVsbG8");

  // A private key
  expect(
    stringToBase64urlString(
      "5234d08dfa2c815f3097b8ba848a28172e85bec78886e8e201afccb166fc54c1"
    )
  ).toBe(
    "NTIzNGQwOGRmYTJjODE1ZjMwOTdiOGJhODQ4YTI4MTcyZTg1YmVjNzg4ODZlOGUyMDFhZmNjYjE2NmZjNTRjMQ"
  );

  // A sample API key stamp
  expect(
    stringToBase64urlString(
      `{"publicKey":"02f739f8c77b32f4d5f13265861febd76e7a9c61a1140d296b8c16302508870316","signature":"304402202a92c24e4b4de3cdb5c05a2b1f42264ba8139cf66b2d1ecf0a09987ab9a2fecb02203bfd91d8c5e87f78da8b5cf5ddb27c96cb00b848797d0fc73bf371892c423f81","scheme":"SIGNATURE_SCHEME_TK_API_P256"}`
    )
  ).toBe(
    "eyJwdWJsaWNLZXkiOiIwMmY3MzlmOGM3N2IzMmY0ZDVmMTMyNjU4NjFmZWJkNzZlN2E5YzYxYTExNDBkMjk2YjhjMTYzMDI1MDg4NzAzMTYiLCJzaWduYXR1cmUiOiIzMDQ0MDIyMDJhOTJjMjRlNGI0ZGUzY2RiNWMwNWEyYjFmNDIyNjRiYTgxMzljZjY2YjJkMWVjZjBhMDk5ODdhYjlhMmZlY2IwMjIwM2JmZDkxZDhjNWU4N2Y3OGRhOGI1Y2Y1ZGRiMjdjOTZjYjAwYjg0ODc5N2QwZmM3M2JmMzcxODkyYzQyM2Y4MSIsInNjaGVtZSI6IlNJR05BVFVSRV9TQ0hFTUVfVEtfQVBJX1AyNTYifQ"
  );
});

test("p256Keygen", async function () {
  const keygen = await p256Keygen();

  const publicKey = p256.getPublicKey(keygen.privateKey, true);
  const publicKeyString = uint8ArrayToHexString(publicKey);

  expect(publicKeyString).toBe(keygen.publicKey);
});

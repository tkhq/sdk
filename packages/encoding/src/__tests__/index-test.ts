import { test, expect } from "@jest/globals";
import {
  stringToBase64urlString,
  uint8ArrayFromHexString,
  uint8ArrayToHexString,
  base64StringToBase64UrlEncodedString,
} from "..";

// Test for stringToBase64urlString
// These test vectors can be verified with NodeJS:
//   $ node
//   > Buffer.from("<input value>").toString("base64url")
//   > <expected value>
test("stringToBase64urlString", async function () {
  // Trivial test string
  expect(stringToBase64urlString("hello")).toBe("aGVsbG8"); // "hello" => "aGVsbG8"

  // A private key
  expect(
    stringToBase64urlString(
      "5234d08dfa2c815f3097b8ba848a28172e85bec78886e8e201afccb166fc54c1"
    )
  ).toBe(
    "NTIzNGQwOGRmYTJjODE1ZjMwOTdiOGJhODQ4YTI4MTcyZTg1YmVjNzg4ODZlOGUyMDFhZmNjYjE2NmZjNTRjMQ" // Base64url encoded
  );

  // A sample API key stamp
  expect(
    stringToBase64urlString(
      `{"publicKey":"02f739f8c77b32f4d5f13265861febd76e7a9c61a1140d296b8c16302508870316","signature":"304402202a92c24e4b4de3cdb5c05a2b1f42264ba8139cf66b2d1ecf0a09987ab9a2fecb02203bfd91d8c5e87f78da8b5cf5ddb27c96cb00b848797d0fc73bf371892c423f81","scheme":"SIGNATURE_SCHEME_TK_API_P256"}`
    )
  ).toBe(
    "eyJwdWJsaWNLZXkiOiIwMmY3MzlmOGM3N2IzMmY0ZDVmMTMyNjU4NjFmZWJkNzZlN2E5YzYxYTExNDBkMjk2YjhjMTYzMDI1MDg4NzAzMTYiLCJzaWduYXR1cmUiOiIzMDQ0MDIyMDJhOTJjMjRlNGI0ZGUzY2RiNWMwNWEyYjFmNDIyNjRiYTgxMzljZjY2YjJkMWVjZjBhMDk5ODdhYjlhMmZlY2IwMjIwM2JmZDkxZDhjNWU4N2Y3OGRhOGI1Y2Y1ZGRiMjdjOTZjYjAwYjg0ODc5N2QwZmM3M2JmMzcxODkyYzQyM2Y4MSIsInNjaGVtZSI6IlNJR05BVFVSRV9TQ0hFTUVfVEtfQVBJX1AyNTYifQ" // Base64url encoded
  );
});

// Test for base64StringToBase64UrlEncodedString
test("base64StringToBase64UrlEncodedString", async function () {
  // "hello world" => "aGVsbG8gd29ybGQ"
  expect(base64StringToBase64UrlEncodedString("aGVsbG8gd29ybGQ=")).toBe(
    "aGVsbG8gd29ybGQ"
  );

  // "Some sample text" => "U29tZSBzYW1wbGUgdGV4dA"
  expect(base64StringToBase64UrlEncodedString("U29tZSBzYW1wbGUgdGV4dA==")).toBe(
    "U29tZSBzYW1wbGUgdGV4dA"
  );
});

// Test for uint8ArrayToHexString
test("uint8ArrayToHexString", async function () {
  const uint8Array = new Uint8Array([
    82, 52, 208, 143, 250, 44, 129, 95, 48, 151, 184, 186, 132, 138, 40, 23, 46,
    133, 190, 199, 136, 134, 232, 226, 1, 175, 204, 177, 102, 252, 84, 193,
  ]);
  const expectedHexString =
    "5234d08ffa2c815f3097b8ba848a28172e85bec78886e8e201afccb166fc54c1";
  expect(uint8ArrayToHexString(uint8Array)).toBe(expectedHexString); // Uint8Array => Hex string
});

// Test for uint8ArrayFromHexString
// Convert hex string to uint8 array
test("uint8ArrayFromHexString", async function () {
  const hexString =
    "5234d08dfa2c815f3097b8ba848a28172e85bec78886e8e201afccb166fc54c1";
  const expectedUint8Array = new Uint8Array([
    82, 52, 208, 141, 250, 44, 129, 95, 48, 151, 184, 186, 132, 138, 40, 23, 46,
    133, 190, 199, 136, 134, 232, 226, 1, 175, 204, 177, 102, 252, 84, 193,
  ]);
  expect(uint8ArrayFromHexString(hexString)).toEqual(expectedUint8Array); // Hex string => Uint8Array
});

import { test, expect } from "@jest/globals";
import {
  stringToBase64urlString,
  uint8ArrayFromHexString,
  uint8ArrayToHexString,
  base64StringToBase64UrlEncodedString,
  hexStringToBase64url,
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

  expect(uint8ArrayFromHexString("627566666572").toString()).toEqual(
    "98,117,102,102,101,114"
  );

  // Error case: empty string
  expect(() => {
    uint8ArrayFromHexString("");
  }).toThrow("cannot create uint8array from invalid hex string");
  // Error case: odd number of characters
  expect(() => {
    uint8ArrayFromHexString("123");
  }).toThrow("cannot create uint8array from invalid hex string");
  // Error case: bad characters outside of hex range
  expect(() => {
    uint8ArrayFromHexString("oops");
  }).toThrow("cannot create uint8array from invalid hex string");
  // Happy path: if length parameter is included, pad the resulting buffer
  expect(uint8ArrayFromHexString("01", 2).toString()).toEqual("0,1");
  // Happy path: if length parameter is omitted, do not pad the resulting buffer
  expect(uint8ArrayFromHexString("01").toString()).toEqual("1");
  // Error case: hex value cannot fit in desired length
  expect(() => {
    uint8ArrayFromHexString("0100", 1).toString(); // the number 256 cannot fit into 1 byte
  }).toThrow("hex value cannot fit in a buffer of 1 byte(s)");

  // TOO SHORT - test a hex string with less bytes than the "length" parameter provided
  const hexString2 =
    "5234d08dfa2c815f3097b8ba848a28172e85bec78886e8e201afccb166fc"; // length is 30 bytes, so must be padded with 2 0's at the beginning
  const expectedUint8Array2 = new Uint8Array([
    0, 0, 82, 52, 208, 141, 250, 44, 129, 95, 48, 151, 184, 186, 132, 138, 40,
    23, 46, 133, 190, 199, 136, 134, 232, 226, 1, 175, 204, 177, 102, 252,
  ]);
  expect(uint8ArrayFromHexString(hexString2, 32)).toEqual(expectedUint8Array2); // Hex string => Uint8Array

  // TOO LONG - test a hex string with less bytes than the "length" parameter provided -- Should error
  const hexString3 =
    "5234d08dfa2c815f3097b8ba848a28172e85bec78886e8e201afccb166fcfafbfcfd"; // length is 34 bytes, so no additional padding will be added
  expect(() => uint8ArrayFromHexString(hexString3, 32)).toThrow(
    "hex value cannot fit in a buffer of 32 byte(s)"
  );
});

// Test for hexStringToBase64url
test("hexStringToBase64url", async function () {
  expect(hexStringToBase64url("01")).toEqual("AQ");
  expect(hexStringToBase64url("01", 2)).toEqual("AAE");

  // extrapolate to larger numbers
  expect(hexStringToBase64url("ff")).toEqual("_w"); // max 1 byte
  expect(hexStringToBase64url("ff", 2)).toEqual("AP8"); // max 1 byte expressed in 2 bytes

  // error case
  expect(() => {
    hexStringToBase64url("0100", 1);
  }).toThrow("hex value cannot fit in a buffer of 1 byte(s)");
});

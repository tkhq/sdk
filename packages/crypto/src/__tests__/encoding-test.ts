// import {
//   base64urlEncode,
//   base64urlDecode,
//   base58checkDecode,
// } from "../encoding.ts";
// import { test, expect, describe } from "@jest/globals";

// describe("Encoding Utilities", () => {
//   // Test Base64 URL Encoding and Decoding
//   describe("Base64 URL", () => {
//     test("base64urlEncode should correctly encode data", () => {
//       const text = "Hello, world!";
//       const data = new TextEncoder().encode(text);
//       const encoded = base64urlEncode(data);
//       expect(encoded).toBe("SGVsbG8sIHdvcmxkIQ");
//     });

//     test("base64urlDecode should correctly decode data", () => {
//       const encoded = "SGVsbG8sIHdvcmxkIQ";
//       const decoded = base64urlDecode(encoded);
//       const text = new TextDecoder().decode(decoded);
//       expect(text).toBe("Hello, world!");
//     });

//     test("base64urlEncode and base64urlDecode should be inverse operations", () => {
//       const text = "Hello, world!";
//       const data = new TextEncoder().encode(text);
//       const encoded = base64urlEncode(data);
//       const decoded = base64urlDecode(encoded);
//       expect(new TextDecoder().decode(decoded)).toBe(text);
//     });
//   });

//   // Test Base58 Check Decoding
//   describe("Base58 Check", () => {
//     test("base58checkDecode should correctly decode a valid Bitcoin address", () => {
//       const bitcoinAddress = "1BoatSLRHtKNngkdXEeobR76b53LETtpyT"; // Actual BTC address
//       const expectedPublicKeyHash = Array.from(
//         new Uint8Array([
//           0, 118, 128, 173, 236, 142, 171, 202, 186, 198, 118, 190, 158, 131,
//           133, 74, 222, 11, 210, 44, 219,
//         ])
//       );
//       const decoded = base58checkDecode(bitcoinAddress);
//       const decodedArray = Array.from(decoded);
//       expect(decodedArray).toEqual(
//         expect.arrayContaining(expectedPublicKeyHash)
//       );
//     });

//     test("base58checkDecode should throw on invalid checksum", () => {
//       const invalidBitcoinAddress = "1BoatSLRHtKNngkdXEeobR76b53LETtpyQ"; // Altered last character of BTC address
//       expect(() => base58checkDecode(invalidBitcoinAddress)).toThrow(
//         "Invalid checksum"
//       );
//     });

//     test("base58checkDecode should throw on invalid character", () => {
//       const addressWithInvalidChar = "1BoatSLRHtKNngkdXEeobR76b53LETtpyl"; // lowercase 'l' is not in the Base58 alphabet
//       expect(() => base58checkDecode(addressWithInvalidChar)).toThrow(
//         "Invalid character found"
//       );
//     });
//   });
// });

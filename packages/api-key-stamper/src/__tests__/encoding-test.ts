import { test, expect } from "@jest/globals";
import { stringToBase64urlString } from "../encoding";

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
    "ewogICJwdWJsaWNLZXkiOiAiMDJmNzM5ZjhjNzdiMzJmNGQ1ZjEzMjY1ODYxZmViZDc2ZTdhOWM2MWExMTQwZDI5NmI4YzE2MzAyNTA4ODcwMzE2IiwKICAic2lnbmF0dXJlIjogIjMwNDUwMjIwNjRjZWQ5MWM3YTlhZWU2NTY2N2M0NmI3Nzg3OGVmNzRjYjgwNzgzZDEzMzE3NmQwZWIyMmMyYmM3YzRmZjg0MzAyMjEwMDgzYzc2ZGZlZjJjOTYxODY2NGJmOWY4Mzk3MTM0N2EwMTA2ZDNiM2FhNjViNjMwMjhhYzk3Yzk3YTc5MjhhZjAiLAogICJzY2hlbWUiOiAiU0lHTkFUVVJFX1NDSEVNRV9US19BUElfUDI1NiIKfQ"
  );
});

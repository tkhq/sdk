import { test, expect } from "@jest/globals";
import { pointDecode } from "../tink/elliptic_curves";
import { uint8ArrayFromHexString, uint8ArrayToHexString } from "@turnkey/encoding";
import { base64urlToBuffer, Base64urlString } from "../../../http/src/webauthn-json/base64url"

test("pointDecode -> uncompressed invalid", async function () {
    // Invalid uncompressed key (the last byte has been changed)
    const uncompPubKey = "0400d2eb47be2006c29db5fe9941dd686d19ddeea85a0328894f08091f6b5be9b366c4872345594c12a7f7c47c62dd8074542934820fce5ee0ddc55d6d1d8dd313"
    expect(() => pointDecode(uint8ArrayFromHexString(uncompPubKey))).toThrow("invalid uncompressed x and y coordinates");
});

test("pointDecode -> uncompressed valid", async function () {
    // Valid uncompressed public key with 00 as the first bit (test against 'x' field of JWK getting truncated)
    const uncompPubKey = "0400d2eb47be2006c29db5fe9941dd686d19ddeea85a0328894f08091f6b5be9b366c4872345594c12a7f7c47c62dd8074542934820fce5ee0ddc55d6d1d8dd312"
    const jwk = pointDecode(uint8ArrayFromHexString(uncompPubKey));
    expect(jwk.x).toBeDefined();
    expect(jwk.y).toBeDefined();

    // Convert x value to make sure it matches first half of uncompressed key WITHOUT truncating the first 0 bit
    let xString: string = jwk.x !== undefined ? jwk.x: "_";
    let xBase64Url: Base64urlString = xString;
    let xBytes = new Uint8Array(base64urlToBuffer(xBase64Url));
    let xHex = uint8ArrayToHexString(xBytes);
    expect(xHex).toBe(uncompPubKey.substring(2, 66))

    // Convert y value to make sure it's the same as second half of uncompressed key
    let yString: string = jwk.y !== undefined ? jwk.y: "_";
    let yBase64Url: Base64urlString = yString;
    let yBytes = new Uint8Array(base64urlToBuffer(yBase64Url));
    let yHex = uint8ArrayToHexString(yBytes);
    expect(yHex).toBe(uncompPubKey.substring(66, 130))
});
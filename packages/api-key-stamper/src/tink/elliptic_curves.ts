/**
 * Code modified from https://github.com/google/tink/blob/6f74b99a2bfe6677e3670799116a57268fd067fa/javascript/subtle/elliptic_curves.ts
 *
 * @license
 * Copyright 2020 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as Bytes from "./bytes";

/**
 * P-256 only
 */
function getModulus(): bigint {
  // https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.186-4.pdf (Appendix D).
  return BigInt(
    "115792089210356248762697446949407573530086143415290314195533631308" +
      "867097853951"
  );
}

/**
 * P-256 only
 */
function getB(): bigint {
  // https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.186-4.pdf (Appendix D).
  return BigInt(
    "0x5ac635d8aa3a93e7b3ebbd55769886bc651d06b0cc53b0f63bce3c3e27d2604b"
  );
}

/** Converts byte array to bigint. */
function byteArrayToInteger(bytes: Uint8Array): bigint {
  return BigInt("0x" + Bytes.toHex(bytes));
}

/** Converts bigint to byte array. */
function integerToByteArray(i: bigint): Uint8Array {
  let input = i.toString(16);
  // If necessary, prepend leading zero to ensure that input length is even.
  input = input.length % 2 === 0 ? input : "0" + input;
  return Bytes.fromHex(input);
}

/** Returns true iff the ith bit (in lsb order) of n is set. */
function testBit(n: bigint, i: number): boolean {
  const m = BigInt(1) << BigInt(i);
  return (n & m) !== BigInt(0);
}

/**
 * Computes a modular exponent.  Since JavaScript BigInt operations are not
 * constant-time, information about the inputs could leak.  Therefore, THIS
 * METHOD SHOULD ONLY BE USED FOR POINT DECOMPRESSION.
 *
 * @param b base
 * @param exp exponent
 * @param p modulus
 * @return b^exp modulo p
 */
function modPow(b: bigint, exp: bigint, p: bigint): bigint {
  if (exp === BigInt(0)) {
    return BigInt(1);
  }
  let result = b;
  const exponentBitString = exp.toString(2);
  for (let i = 1; i < exponentBitString.length; ++i) {
    result = (result * result) % p;
    if (exponentBitString[i] === "1") {
      result = (result * b) % p;
    }
  }
  return result;
}

/**
 * Computes a square root modulo an odd prime.  Since timing and exceptions can
 * leak information about the inputs, THIS METHOD SHOULD ONLY BE USED FOR
 * POINT DECOMPRESSION.
 *
 * @param x square
 * @param p prime modulus
 * @return square root of x modulo p
 */
function modSqrt(x: bigint, p: bigint): bigint {
  if (p <= BigInt(0)) {
    throw new Error("p must be positive");
  }
  const base = x % p;
  // The currently supported NIST curves P-256, P-384, and P-521 all satisfy
  // p % 4 == 3.  However, although currently a no-op, the following check
  // should be left in place in case other curves are supported in the future.
  if (testBit(p, 0) && /* istanbul ignore next */ testBit(p, 1)) {
    // Case p % 4 == 3 (applies to NIST curves P-256, P-384, and P-521)
    // q = (p + 1) / 4
    const q = (p + BigInt(1)) >> BigInt(2);
    const squareRoot = modPow(base, q, p);
    if ((squareRoot * squareRoot) % p !== base) {
      throw new Error("could not find a modular square root");
    }
    return squareRoot;
  }
  // Skipping other elliptic curve types that require Cipolla's algorithm.
  throw new Error("unsupported modulus value");
}

/**
 * Computes the y-coordinate of a point on an elliptic curve given its
 * x-coordinate.  Since timing and exceptions can leak information about the
 * inputs, THIS METHOD SHOULD ONLY BE USED FOR POINT DECOMPRESSION.
 *
 * P-256 only
 *
 * @param x x-coordinate
 * @param lsb least significant bit of the y-coordinate
 * @return y-coordinate
 */
function getY(x: bigint, lsb: boolean): bigint {
  const p = getModulus();
  const a = p - BigInt(3);
  const b = getB();
  const rhs = ((x * x + a) * x + b) % p;
  let y = modSqrt(rhs, p);
  if (lsb !== testBit(y, 0)) {
    y = (p - y) % p;
  }
  return y;
}

/**
 * Decodes a public key in _compressed_ format.
 *
 * P-256 only
 */
export function pointDecode(point: Uint8Array): JsonWebKey {
  const fieldSize = fieldSizeInBytes();

  if (point.length !== 1 + fieldSize) {
    throw new Error("compressed point has wrong length");
  }
  if (point[0] !== 2 && point[0] !== 3) {
    throw new Error("invalid format");
  }
  const lsb = point[0] === 3; // point[0] must be 2 (false) or 3 (true).
  const x = byteArrayToInteger(point.subarray(1, point.length));
  const p = getModulus();
  if (x < BigInt(0) || x >= p) {
    throw new Error("x is out of range");
  }
  const y = getY(x, lsb);
  const result: JsonWebKey = {
    kty: "EC",
    crv: "P-256",
    x: Bytes.toBase64(integerToByteArray(x), /* websafe */ true),
    y: Bytes.toBase64(integerToByteArray(y), /* websafe */ true),
    ext: true,
  };
  return result;
}

/**
 * P-256 only
 */
function fieldSizeInBytes(): number {
  return 32;
}

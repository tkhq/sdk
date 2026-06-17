import type { Transform } from "./types";
import { concat } from "./utils";

const INT32_MIN = -(2 ** 31);
const INT32_MAX = 2 ** 31 - 1;
const INT64_MIN = -(2n ** 63n);
const INT64_MAX = 2n ** 63n - 1n;

const SOME = Uint8Array.of(0x01);
const NONE = Uint8Array.of(0x00);

/**
 * Encodes a boolean value into a single-byte Uint8Array.
 */
export const encodeBool: Transform<boolean> = (value) => (value ? SOME : NONE);

/**
 * Encodes a 32-bit signed integer into a 4-byte Uint8Array in big-endian format.
 *
 * @throws {TypeError} If value is not an integer
 * @throws {RangeError} If value is out of range for int32
 */
export const encodeInt32: Transform<number> = (value) => {
  if (!Number.isInteger(value)) {
    throw new TypeError(`Expected int32 integer, got ${value}`);
  }

  if (value < INT32_MIN || value > INT32_MAX) {
    throw new RangeError(`Value ${value} out of range for int32`);
  }

  const out = new Uint8Array(4);
  const view = new DataView(out.buffer, out.byteOffset, out.byteLength);
  view.setInt32(0, value, false);

  return out;
};

/**
 * Encodes a 64-bit signed integer into an 8-byte Uint8Array in big-endian format.
 *
 * @throws {RangeError} If value is out of range for int64
 */
export const encodeInt64: Transform<string | number | bigint> = (value) => {
  const big = BigInt(value);

  if (big < INT64_MIN || big > INT64_MAX) {
    throw new RangeError(`Value ${big} out of range for int64`);
  }

  const out = new Uint8Array(8);
  const view = new DataView(out.buffer, out.byteOffset, out.byteLength);
  view.setBigInt64(0, big, false);

  return out;
};

/**
 * Encodes a UTF-8 string into a length-prefixed Uint8Array.
 *
 * The first 4 bytes represent the length of the string in bytes,
 * followed by the UTF-8 encoded string bytes.
 */
export const encodeString: Transform<string> = (value) =>
  encodeBytes(Buffer.from(value, "utf8"));

/**
 * Encodes a byte array with a 4-byte length prefix.
 *
 * The first 4 bytes represent the length of the byte array in bytes,
 * followed by the byte array itself.
 */
export const encodeBytes: Transform<Uint8Array> = (value) =>
  concat(encodeInt32(value.length), value);

/**
 * Encodes a hash value without a length prefix (hashes have a fixed size of 32 bytes).
 *
 * This is an identity function (the return value is the input, no copying is beinf done)
 */
export const encodeHash: Transform<Uint8Array> = (value) => value;

/**
 * Encodes a hexadecimal string into a length-prefixed byte array.
 *
 * The first 4 bytes represent the length of the decoded byte array in bytes,
 * followed by the decoded bytes from the hexadecimal string.
 */
export const encodeHexString: Transform<string> = (value) =>
  encodeBytes(Buffer.from(value, "hex"));

/**
 * Encodes an optional value:
 *
 * - encoded value prefixed with 0x01 if defined
 * - 0x00 if null or undefined
 */
export const encodeOptional = <T>(
  value: T | null | undefined,
  encodeFn: Transform<T>,
): Uint8Array => (value != null ? concat(SOME, encodeFn(value)) : NONE);

/**
 * Encodes a sequence of values with a 4-byte count prefix.
 *
 * The first 4 bytes represent the number of values in the sequence,
 * followed by the encoded values concatenated.
 */
export const encodeRepeated = <T>(
  values: T[],
  encodeFn: Transform<T>,
): Uint8Array => concat(encodeInt32(values.length), ...values.map(encodeFn));

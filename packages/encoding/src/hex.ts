/**
 * Converts a Uint8Array into a lowercase hex string.
 *
 * @param {Uint8Array} input - The input byte array.
 * @returns {string} - The resulting hex string.
 */
export function uint8ArrayToHexString(input: Uint8Array): string {
  return input.reduce(
    (result, x) => result + x.toString(16).padStart(2, "0"),
    "",
  );
}

/**
 * Creates a Uint8Array from a hex string.
 *
 * @param {string} hexString - The input hex string.
 * @param {number} [length] - Optional target length for the output. If specified,
 * the result will be padded with leading 0s or throw if it overflows.
 * @returns {Uint8Array} - The resulting byte array.
 * @throws {Error} - If the hex string is invalid or too long for the specified length.
 */
export const uint8ArrayFromHexString = (
  hexString: string,
  length?: number,
): Uint8Array => {
  const hexRegex = /^[0-9A-Fa-f]+$/;
  if (!hexString || hexString.length % 2 != 0 || !hexRegex.test(hexString)) {
    throw new Error(
      `cannot create uint8array from invalid hex string: "${hexString}"`,
    );
  }

  const buffer = new Uint8Array(
    hexString!.match(/../g)!.map((h: string) => parseInt(h, 16)),
  );

  if (!length) {
    return buffer;
  }
  if (hexString.length / 2 > length) {
    throw new Error(
      "hex value cannot fit in a buffer of " + length + " byte(s)",
    );
  }

  // If a length is specified, ensure we sufficiently pad
  let paddedBuffer = new Uint8Array(length);
  paddedBuffer.set(buffer, length - buffer.length);
  return paddedBuffer;
};

/**
 * Converts a hex string to an ASCII string.
 * @param {string} hexString - The input hex string to convert.
 * @returns {string} - The converted ASCII string.
 */
export function hexToAscii(hexString: string): string {
  let asciiStr = "";
  for (let i = 0; i < hexString.length; i += 2) {
    asciiStr += String.fromCharCode(parseInt(hexString.substr(i, 2), 16));
  }
  return asciiStr;
}

/**
 * Function to normalize padding of byte array with 0's to a target length.
 *
 * @param {Uint8Array} byteArray - The byte array to pad or trim.
 * @param {number} targetLength - The target length after padding or trimming.
 * @returns {Uint8Array} - The normalized byte array.
 */
export const normalizePadding = (
  byteArray: Uint8Array,
  targetLength: number,
): Uint8Array => {
  const paddingLength = targetLength - byteArray.length;

  // Add leading 0's to array
  if (paddingLength > 0) {
    const padding = new Uint8Array(paddingLength).fill(0);
    return new Uint8Array([...padding, ...byteArray]);
  }

  // Remove leading 0's from array
  if (paddingLength < 0) {
    const expectedZeroCount = paddingLength * -1;
    let zeroCount = 0;
    for (let i = 0; i < expectedZeroCount && i < byteArray.length; i++) {
      if (byteArray[i] === 0) {
        zeroCount++;
      }
    }
    // Check if the number of zeros found equals the number of zeroes expected
    if (zeroCount !== expectedZeroCount) {
      throw new Error(
        `invalid number of starting zeroes. Expected number of zeroes: ${expectedZeroCount}. Found: ${zeroCount}.`,
      );
    }
    return byteArray.slice(expectedZeroCount, expectedZeroCount + targetLength);
  }
  return byteArray;
};

/**
 * Compresses an uncompressed P-256 public key into its 33-byte compressed form.
 *
 * @param {Uint8Array} raw - The uncompressed public key (65 bytes, starting with 0x04).
 * @returns {Uint8Array} - The compressed public key (33 bytes, starting with 0x02 or 0x03).
 * @throws {Error} - If the input key is not a valid uncompressed P-256 key.
 */
export function pointEncode(raw: Uint8Array): Uint8Array {
  if (raw.length !== 65 || raw[0] !== 0x04) {
    throw new Error("Invalid uncompressed P-256 key");
  }

  const x = raw.slice(1, 33);
  const y = raw.slice(33, 65);

  if (x.length !== 32 || y.length !== 32) {
    throw new Error("Invalid x or y length");
  }

  const prefix = (y[31]! & 1) === 0 ? 0x02 : 0x03;

  const compressed = new Uint8Array(33);
  compressed[0] = prefix;
  compressed.set(x, 1);
  return compressed;
}

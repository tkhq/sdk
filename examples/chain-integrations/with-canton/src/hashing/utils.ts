/**
 * Concatenates multiple Uint8Arrays into a single Uint8Array.
 * @param parts - Variable number of Uint8Array objects to concatenate
 * @returns A new Uint8Array containing all parts concatenated in order
 */
export const concat = (...parts: Uint8Array[]): Uint8Array => {
  const size = parts.reduce((sum, { length }) => sum + length, 0);
  const out = new Uint8Array(size);

  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }

  return out;
};

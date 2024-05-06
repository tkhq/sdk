// Converts an ArrayBuffer to a hex-encoded string
export function buf2hex(buffer: ArrayBufferLike): string {
  return [...new Uint8Array(buffer)]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}

export function uint8ArrayToHexString(input: Uint8Array): string {
  return input.reduce(
    (result, x) => result + x.toString(16).padStart(2, "0"),
    ""
  );
}

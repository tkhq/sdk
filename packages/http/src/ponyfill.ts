/// <reference lib="dom" />

export const subtle =
  globalThis?.crypto?.subtle ?? require("crypto").webcrypto.subtle;

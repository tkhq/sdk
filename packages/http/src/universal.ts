/// <reference lib="dom" />

export const subtle =
  globalThis?.crypto?.subtle ?? require("crypto").webcrypto.subtle;

export const TextEncoder =
  globalThis?.TextEncoder ?? require("util").TextEncoder;

export const fetch = globalThis?.fetch ?? require("cross-fetch");

import { webcrypto } from "node:crypto";

// Some libs look for globalThis.crypto / crypto.subtle
Object.defineProperty(globalThis, "crypto", {
  value: webcrypto,
  configurable: true,
});

// These are usually present in Node 18+, but harmless to ensure:
Object.defineProperty(globalThis, "TextEncoder", { value: TextEncoder });
Object.defineProperty(globalThis, "TextDecoder", { value: TextDecoder });

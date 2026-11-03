import { TextDecoder, TextEncoder } from "node:util";

// jsdom does not provide the encoding globals used by the client dependencies.
Object.defineProperties(globalThis, {
  TextDecoder: { value: TextDecoder, configurable: true },
  TextEncoder: { value: TextEncoder, configurable: true },
});

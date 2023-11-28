/// <reference lib="dom" />
import { Buffer as nodeBuffer } from "buffer";
let buffer: typeof globalThis.Buffer;

if (typeof globalThis?.Buffer !== "undefined") {
  buffer = globalThis.Buffer;
} else {
  buffer = nodeBuffer;
}

export { buffer };

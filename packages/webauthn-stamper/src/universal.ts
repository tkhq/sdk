let buffer: typeof globalThis.Buffer;

if (typeof globalThis?.Buffer !== "undefined") {
  buffer = globalThis.Buffer;
} else {
  buffer = require("buffer");
}

export { buffer };

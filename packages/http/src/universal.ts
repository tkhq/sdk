/// <reference lib="dom" />
let fetch: typeof globalThis.fetch;

if (typeof globalThis?.fetch !== "undefined") {
  fetch = globalThis.fetch;
} else {
  fetch = require("cross-fetch");
}

export { fetch };

/// <reference lib="dom" />
import { fetch as xFetch } from "cross-fetch";
let fetch: typeof globalThis.fetch;

if (typeof globalThis?.fetch !== "undefined") {
  fetch = globalThis.fetch;
} else {
  fetch = xFetch;
}

export { fetch };

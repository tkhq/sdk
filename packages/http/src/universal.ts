/// <reference lib="dom" />
import type { TLegacyStamper } from "./shared";

let fetch: typeof globalThis.fetch;

if (typeof globalThis?.fetch !== "undefined") {
  fetch = globalThis.fetch;
} else {
  fetch = require("cross-fetch");
}

let stamp: TLegacyStamper;

if (typeof globalThis?.crypto?.subtle !== "undefined") {
  stamp = require("./stamp.webcrypto").stamp;
} else {
  stamp = require("./stamp.node").stamp;
}

export { fetch, stamp };

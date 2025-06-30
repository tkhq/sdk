// This is a temporary shim for bs58check@4.0.0
//
// See: https://github.com/bitcoinjs/bs58check/issues/47
//
// bs58check v4.0.0 uses ESM with only a default export, which causes compatibility
// issues with Metro (React Native). When importing the package using
// `import bs58check from 'bs58check'`, Metro applies multiple levels of wrapping,
// resulting in a structure like `{ default: { default: { encode, decode, ... } } }`.
//
// This shim unwraps the exports until it reaches the object that contains `.decode`,
// `.encode`, and `.decodeUnsafe`, allowing consistent usage across platforms.
//
// We can remove this shim once bs58check publishes a version that properly re-exports
// named methods from its ESM build

import * as raw from "bs58check";

type Bs58Check = {
  encode(payload: Uint8Array | number[]): string;
  decode(str: string): Uint8Array;
  decodeUnsafe(str: string): Uint8Array | undefined;
};

function unwrap(obj: any): any {
  let cur = obj;
  while (
    cur &&
    !(cur.encode && cur.decode && cur.decodeUnsafe) &&
    cur.default
  ) {
    cur = cur.default;
  }
  return cur;
}

const bs58check = unwrap(raw) as Bs58Check;

export default bs58check;

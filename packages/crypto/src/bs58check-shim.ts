// src/shims/bs58check-shim.ts
import * as raw from 'bs58check';

type Bs58Check = {
  encode(buf: Uint8Array): string;
  decode(str: string): Uint8Array;
  decodeUnsafe(str: string): Uint8Array | undefined;
};

function unwrap(obj: any): any {
  let cur = obj;
  while (cur && !cur.decode && cur.default) {
    cur = cur.default;
  }
  return cur;
}

const bs58check = unwrap(raw) as Bs58Check;

console.log('[bs58check-shim] final keys =', Object.keys(bs58check));

export default bs58check;

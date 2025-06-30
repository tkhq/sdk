// bs58check-shim.ts
import * as raw from 'bs58check';

console.log(
  '[bs58check-shim] raw keys =',
  Object.keys(raw),
  '— typeof raw.default =',
  typeof (raw as any).default
);

const bs58check =
  // if the object already has .decode we’re in CJS land
  typeof (raw as any).decode === 'function'
    ? (raw as any)
    // otherwise fall back to the default export
    : (raw as any).default;

console.log(
  '[bs58check-shim] final keys =',
  bs58check ? Object.keys(bs58check) : 'undefined',
  '— typeof .decode =',
  typeof bs58check?.decode
);

export default bs58check;

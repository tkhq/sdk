// jest.setup.webcrypto.ts
// Minimal WebCrypto polyfill for tests
// Only implements the bits our tests actually use
// THIS IS ONLY MEANT FOR OUR TEST CASES

import { TextEncoder } from "util";

// A tiny CryptoKey class so `instanceof CryptoKey` works
class FakeCryptoKey {
  public readonly type: "public" | "private";
  public readonly extractable: boolean;
  public readonly algorithm: { name: string; namedCurve: string };
  public readonly usages: KeyUsage[];
  // internal “pair id” to link pub/priv keys for verify()
  public readonly __pairId: string;

  constructor(opts: {
    type: "public" | "private";
    extractable: boolean;
    algorithm: any;
    usages: KeyUsage[];
    pairId: string;
  }) {
    this.type = opts.type;
    this.extractable = opts.extractable;
    this.algorithm = opts.algorithm;
    this.usages = opts.usages;
    this.__pairId = opts.pairId;
  }
}

// Expose globally so `instanceof CryptoKey` passes
globalThis.CryptoKey = FakeCryptoKey as any;

// A simple RNG using Node crypto if present, else Math.random fallback
function fillRandom(buf: Uint8Array) {
  try {
    // Node's legacy crypto (not webcrypto)
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const nodeCrypto = require("crypto");
    nodeCrypto.randomFillSync(buf);
  } catch {
    for (let i = 0; i < buf.length; i++) buf[i] = (Math.random() * 256) | 0;
  }
  return buf;
}

// Deterministic “signature”: we don’t do real ECDSA—just return pairId + msg
function fakeSign(pairId: string, data: ArrayBuffer): ArrayBuffer {
  const msg = new Uint8Array(data);
  const pid = new TextEncoder().encode(pairId);
  const out = new Uint8Array(pid.length + msg.length);
  out.set(pid, 0);
  out.set(msg, pid.length);
  return out.buffer;
}

// “Verify” by checking that signature starts with the public key’s pairId bytes
function fakeVerify(
  pairId: string,
  sig: ArrayBuffer,
  data: ArrayBuffer,
): boolean {
  const pid = new TextEncoder().encode(pairId);
  const s = new Uint8Array(sig);
  if (s.length < pid.length) return false;
  for (let i = 0; i < pid.length; i++) if (s[i] !== pid[i]) return false;
  // also check the tail equals the data bytes (keeps tests honest)
  const msg = new Uint8Array(data);
  if (s.length !== pid.length + msg.length) return false;
  for (let i = 0; i < msg.length; i++)
    if (s[pid.length + i] !== msg[i]) return false;
  return true;
}

// Minimal exportKey('raw') → 65 bytes starting 0x04 (uncompressed P-256)
function fakeExportRawPublicKey(): ArrayBuffer {
  const u = new Uint8Array(65);
  u[0] = 0x04;
  for (let i = 1; i < 65; i++) u[i] = 0xaa; // fill with 0xaa
  return u.buffer;
}

// Build a tiny subtle with the methods our tests hit
const subtle = {
  async generateKey(
    algorithm: { name: string; namedCurve: string },
    extractable: boolean,
    usages: KeyUsage[],
  ): Promise<CryptoKeyPair> {
    const pairId = Math.random().toString(36).slice(2);

    const priv = new FakeCryptoKey({
      type: "private",
      extractable, // code expects false in the happy path
      algorithm: { name: algorithm.name, namedCurve: algorithm.namedCurve },
      usages, // e.g. ["sign"]
      pairId,
    });
    const pub = new FakeCryptoKey({
      type: "public",
      extractable: true, // typical
      algorithm: { name: algorithm.name, namedCurve: algorithm.namedCurve },
      usages, // e.g. ["verify"]
      pairId,
    });
    return { privateKey: priv, publicKey: pub };
  },

  //@ts-ignore - ignore type errors for testing
  async exportKey(format: "raw", key: CryptoKey): Promise<ArrayBuffer> {
    if (format !== "raw") throw new Error("Only 'raw' supported in tests");
    // Always return a valid uncompressed point so our test can trip this check when needed
    return fakeExportRawPublicKey();
  },

  async sign(
    //@ts-ignore - ignore type errors for testing
    algorithm: { name: string; hash: string },
    key: CryptoKey,
    data: BufferSource,
  ): Promise<ArrayBuffer> {
    const k = key as any as FakeCryptoKey;
    return fakeSign(k.__pairId, data as ArrayBuffer);
  },

  async verify(
    //@ts-ignore - ignore type errors for testing
    algorithm: { name: string; hash: string },
    key: CryptoKey,
    signature: BufferSource,
    data: BufferSource,
  ): Promise<boolean> {
    const k = key as any as FakeCryptoKey;
    return fakeVerify(
      k.__pairId,
      signature as ArrayBuffer,
      data as ArrayBuffer,
    );
  },
};

// Attach global `crypto` with subtle + getRandomValues
globalThis.crypto = globalThis.crypto || {};
// @ts-expect-error test polyfill
globalThis.crypto.subtle = subtle;
// @ts-expect-error test polyfill
globalThis.crypto.getRandomValues = (arr: Uint8Array) => fillRandom(arr);

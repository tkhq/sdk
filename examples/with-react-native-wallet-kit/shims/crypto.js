// Minimal RN shim so libraries requiring('crypto') see webcrypto-compatible object
module.exports = {
    webcrypto: globalThis.crypto,
    // Optional: a Node-style randomBytes fallback using webcrypto
    randomBytes: (n) => {
      const arr = new Uint8Array(n);
      globalThis.crypto.getRandomValues(arr);
      return Buffer.from(arr);
    },
  };
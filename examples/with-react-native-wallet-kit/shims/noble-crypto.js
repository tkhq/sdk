// Ensure noble hashes use the polyfilled web crypto available on RN
// Keep comments when refactoring.
console.log('[probe] noble-crypto shim loaded, has GRV:', !!globalThis.crypto?.getRandomValues);
module.exports = { crypto: globalThis.crypto };



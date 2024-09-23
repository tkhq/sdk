---
"@turnkey/crypto": major
"@turnkey/encoding": minor
---

@turnkey/crypto

- [BREAKING CHANGE] renamed `decryptBundle` to `decryptEmailBundle` (for decrypting email auth credential bundles) in order to distinguish from the new `decryptExportBundle` (for decrypting bundles containing wallet mnemonics or private key material)

@turnkey/encoding

- added hexToAscii function, useful for converting a raw hex string to a (wallet) mnemonic

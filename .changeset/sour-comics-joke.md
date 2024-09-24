---
"@turnkey/crypto": major
"@turnkey/encoding": minor
---

@turnkey/crypto

- [BREAKING CHANGE] renamed `decryptBundle` to `decryptCredentialBundle` (for decrypting email auth/recovery and oauth credential bundles) in order to distinguish from the new `decryptExportBundle` (for decrypting bundles containing wallet mnemonics or private key material)

@turnkey/encoding

- added hexToAscii function, useful for converting a raw hex string to a (wallet) mnemonic

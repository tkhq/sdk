---
"@turnkey/crypto": minor
"@turnkey/sdk-server": minor
"@turnkey/sdk-types": patch
"@turnkey/core": patch
"@turnkey/http": patch
"@turnkey/sdk-browser": patch
---

`importSecret` now uses `TRANSPORT_ENCRYPTION_SUITE_ENCLAVE_ENCRYPT_V2`, which binds the ciphertext to the secret's name and static properties. `encryptSecretToBundle` now requires `name` and `staticProperties`. Adds `importSecretsPurposeBinding` and an optional `purposeBinding` to `hpkeEncrypt` and `hpkeDecrypt`.

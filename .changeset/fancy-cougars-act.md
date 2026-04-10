---
"@turnkey/crypto": minor
---

- Export `PRODUCTION_TLS_FETCHER_SIGN_PUBLIC_KEY` constant
- Add `encryptOtpCodeToBundle()` helper that encrypts an OTP code and client public key to the enclave's target key using HPKE

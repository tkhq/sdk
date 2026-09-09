---
"@turnkey/crypto": minor
---

We removed `hpkeAuthEncrypt` because it was designed to be used with a newly generated, one-time sender key, but its API also allowed callers to provide a long-lived `senderPriv`.

Using the same long-lived sender key for multiple encryptions with the same recipient deterministically reused the AES-GCM key and nonce. Reusing an AES-GCM key and nonce can reveal relationships between plaintexts and compromise message authentication. If you used `hpkeAuthEncrypt` with a long-lived sender key, rotate that key and use `hpkeEncrypt({ plainTextBuf, targetKeyBuf })` instead. It provides the same encryption behavior while generating a fresh ephemeral sender key for each encryption, so callers do not need to generate, manage, or pass `senderPriv` manually.

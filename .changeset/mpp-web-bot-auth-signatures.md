---
"@turnkey/mpp-web-bot-auth": minor
---

Add Web Bot Auth HTTP request signing with dedicated Ed25519 keys. Applications
can inject an authenticated Turnkey client or a byte-signing callback; the package
does not accept API private keys or load credentials. The prover supports explicit
origin scopes, short-lived signatures, and the MPP identity prover interface.

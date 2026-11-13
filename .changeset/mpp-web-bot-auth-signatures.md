---
"@turnkey/mpp-web-bot-auth": minor
---

Add MPP identity request signing for the MPP HTTPS-directory Web Bot Auth
profile (`@authority` and `Signature-Agent` only) with dedicated Ed25519 keys. Applications
can inject an authenticated Turnkey client or a byte-signing callback; the package
does not accept API private keys or load credentials. The prover supports explicit
origin scopes, short-lived signatures, and the MPP identity prover interface.

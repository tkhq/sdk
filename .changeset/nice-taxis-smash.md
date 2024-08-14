---
"@turnkey/api-key-stamper": patch
"@turnkey/encoding": patch
"@turnkey/http": patch
---

Updates to various libraries:

- `@turnkey/api-key-stamper`: resolve a bug where byte arrays might not be sufficiently padded (32 bytes are expected for x, y, and d elements of a JWK)
- `@turnkey/encoding`: include additional utility functions
- `@turnkey/http`: fix a (currently unused) return value

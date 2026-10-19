---
"@turnkey/sdk-server": minor
---

`exportSecret` and `createExportSecretsProposal` now accept a per-secret `requestContext`, which is bound into the signed request for policy and audit. Entries are serialized sorted by key, so the same context always produces the same signed body and fingerprint. Bodies without context are unchanged.

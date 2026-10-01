---
"@turnkey/sdk-server": minor
---

Added `exportSecretsAndDecrypt`, which exports and decrypts any number of secrets and returns the plaintexts in input order. It submits sequential activities of at most 32 secrets, each encrypted to its own in-memory key, and binds an optional per-secret `requestContext` into the signed request. `exportSecret` and `createExportSecretsProposal` now accept per-secret `requestContext`, and `awaitExportedSecrets` now rejects responses whose payload count does not match the request.

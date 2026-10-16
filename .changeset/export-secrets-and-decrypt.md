---
"@turnkey/sdk-server": minor
---

Added `exportSecretsAndDecrypt`, which exports and decrypts 1 to 32 secrets in one activity and returns the plaintexts in input order. It encrypts the export to an in-memory key, binds an optional per-secret `requestContext` into the signed request, and throws `EXPORT_SECRET_ERROR` before sending anything when given more than 32 secrets.

- `exportSecret` and `createExportSecretsProposal` now accept per-secret `requestContext`. Entries are serialized sorted by key, so the same context always produces the same signed body and fingerprint.
- `createExportSecretsProposal` now throws `EXPORT_SECRET_ERROR` before signing when `secrets` is empty, has more than 32 items, has empty or duplicate IDs, or has a `requestContext` that is not an object of string values.
- `exportSecret` now throws `EXPORT_SECRET_ERROR` when `secretId` is empty or `requestContext` is not an object of string values.
- `exportSecret` now throws `EXPORT_SECRET_ERROR` when submission fails without an API error response; the outcome is unknown, so look the activity up by fingerprint before retrying.
- `exportSecret` now throws `EXPORT_SECRET_CONSENSUS_NEEDED` when polling finds that the activity needs consensus, instead of waiting until timeout.
- `exportSecret` and `awaitExportedSecrets` now throw `EXPORT_SECRET_ERROR` when `timeoutMs` or `pollingIntervalMs` is not a positive finite number, when the response has an empty payload or a payload count that does not match the request, and when a payload fails verification or decryption.
- `awaitExportedSecrets` now throws `EXPORT_SECRET_ERROR` when `proposal.body` is not a valid `export_secrets` request.

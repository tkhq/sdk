---
"@turnkey/core": patch
---

Fix activity completion polling for cross-org (sub-organization) activities. `pollForCompletion` now threads the activity's own `organizationId` into `getActivity`, so activities submitted against a sub-org complete even when there is no active session for that sub-org (e.g. lost-passkey SMS recovery). Previously the poll fell back to the parent `config.organizationId` and failed with a 401. Backward compatible — when the activity's org matches the session/config org, behavior is unchanged.

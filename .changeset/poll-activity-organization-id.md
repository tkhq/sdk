---
"@turnkey/core": patch
---

Activity polling now queries the organization the activity belongs to. Previously `get_activity` fell back to the session's organization, or to `config.organizationId` when there was no session, so polling a sub-organization activity before a session existed (for example the re-poll after `onMfaRequired` during an SMS-MFA login) hit the parent organization and failed with `ATTESTED_IDENTITY_NOT_FOUND`. Reported by @elenamik in #1617.

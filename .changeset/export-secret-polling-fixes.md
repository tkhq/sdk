---
"@turnkey/sdk-server": patch
---

`exportSecret` now throws `EXPORT_SECRET_CONSENSUS_NEEDED` as soon as polling finds that the activity needs consensus, instead of waiting until timeout. It also skips polling when the submit response already has a terminal status.

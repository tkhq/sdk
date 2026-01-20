---
"@turnkey/sdk-server": patch
---

Fix polling logic to use the `organizationId` from the activity response instead of the config, which fixes activity polling for auth functions

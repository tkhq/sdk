---
"@turnkey/core": patch
"@turnkey/http": patch
"@turnkey/sdk-browser": patch
"@turnkey/sdk-server": patch
---

Reject redirects for Turnkey API requests. Core clients now fail before sending when the runtime cannot enforce redirect blocking.

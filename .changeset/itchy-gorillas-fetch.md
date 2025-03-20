---
"@turnkey/viem": patch
---

The organizationId parameter is ignored when using a client other than TurnkeyClient (e.g., passkeyClient). Consequently, the SDK calls the client without the specified organizationId, which is unintended. This patch resolves the issue

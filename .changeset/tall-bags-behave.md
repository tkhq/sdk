---
"@turnkey/sdk-server": minor
---

Security fix: remove the API proxy helpers `expressProxyHandler`, `nextProxyHandler` and `apiProxy`, and the `TurnkeyProxyHandlerConfig` type.

If you use these helpers, take the proxy route out. For each action your app needs, add a server endpoint that checks who the caller is, builds the request on the server, and calls `turnkey.apiClient()` directly.

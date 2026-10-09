---
"@turnkey/sdk-server": patch
---

Fix expressProxyHandler and nextProxyHandler so a request missing methodName or params returns 400 and stops, instead of sending again on the same response.

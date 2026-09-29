---
"@turnkey/sdk-server": patch
---

Initialize the server actions client on first use so importing the SDK works in runtimes without `process`, including Cloudflare Workers without Node compatibility.

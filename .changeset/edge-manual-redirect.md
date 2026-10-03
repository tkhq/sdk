---
"@turnkey/http": patch
---

Refuse redirects with `redirect: "manual"` instead of `redirect: "error"`, so `TurnkeyClient` works on Cloudflare Workers and other edge runtimes. A redirect is still refused, and the stamped request body is never sent to the redirect target.

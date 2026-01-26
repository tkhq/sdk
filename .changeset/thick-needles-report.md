---
"@turnkey/core": patch
---

- Fix `loginWithWallet()` returning the wrong address and sporadically failing
- Deprecate `sendSignedRequest()` in favor of `httpClient.sendSignedRequest()`, which includes automatic activity polling and result extraction

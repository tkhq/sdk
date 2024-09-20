---
"@turnkey/viem": minor
---

Add synchronous createAccount variant (thank you @mshrieve)

- Closes https://github.com/tkhq/sdk/issues/349
- Originally attributed to https://github.com/tkhq/sdk/pull/348
- Upshot: no change required if your setup was working. However, if you would like a synchronous option for creating a Viem account, now you may do so with `createAccountWithAddress`

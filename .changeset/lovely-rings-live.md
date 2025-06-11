---
"@turnkey/cosmjs": patch
"@turnkey/eip-1193-provider": patch
"@turnkey/ethers": patch
"@turnkey/http": patch
"@turnkey/solana": patch
"@turnkey/viem": patch
---

Exposed `isHttpClient` function for determining if a passed in client is from turnkey/http

Fix for `no runner registered` error when using mismatched versions of turnkey/http
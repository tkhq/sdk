---
"@turnkey/viem": patch
---

Preserve the EIP-712 domain when signing typed data without an explicit `types.EIP712Domain` definition. Direct account signing now matches Viem's wallet-client signing behavior. Signatures for these inputs change because the supplied domain is now included rather than silently replaced with an empty domain. Explicit domain type definitions remain unchanged.

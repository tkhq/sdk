---
"@turnkey/core": patch
---

Prevented unnecessary permission prompts in non-Ethereum-native wallets (e.g., Cosmos-based wallets like Keplr) by avoiding chainId requests before accounts are connected

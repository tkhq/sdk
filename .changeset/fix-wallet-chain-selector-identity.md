---
"@turnkey/react-wallet-kit": patch
---

Fix chain selector picking wrong wallet when multiple EVM wallets are installed. The provider lookup now matches by wallet identity (rdns preferred, name as fallback) in addition to interface type and chain namespace.

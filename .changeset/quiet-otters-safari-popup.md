---
"@turnkey/react-wallet-kit": patch
---

Fix OAuth popup login (Discord, X, Google, Apple, Facebook) being blocked by Safari's popup blocker. The popup is now opened synchronously, before any async key/nonce generation, preserving the click's user-activation window that Safari requires for `window.open`.

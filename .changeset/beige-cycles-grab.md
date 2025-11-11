---
"@turnkey/react-wallet-kit": patch
---

Added optional `clearClipboardOnPaste` to `handleImportWallet` and `handleImportPrivateKey`. Defaulting to true, this will create the import iframe with `clipboard-write` permissions. Allows clipboard to be cleared after pasting in secrets to import.

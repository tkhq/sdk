---
"@turnkey/react-wallet-kit": minor
---

Add a new `handleSendTransaction` helper to the Wallet Kit (**for embedded wallet use only**).

This handler provides a complete transaction-submission flow, including:

- Construction of the Ethereum transaction intent (sponsored and non-sponsored)
- Submission via `ethSendTransaction` from `@turnkey/core`
- Integrated modal UI for progress + success states
- Polling for transaction confirmation using `pollTransactionStatus`
- Surfacing of the final on-chain `txHash` back to the caller

This addition centralizes all transaction UX and logic into a single, reusable helper and enables consistent send-transaction flows across applications using the Wallet Kit.

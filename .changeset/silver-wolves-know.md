---
"@turnkey/sdk-browser": minor
"@turnkey/sdk-server": minor
"@turnkey/sdk-types": minor
"@turnkey/core": minor
"@turnkey/http": minor
---

Expose `createSwapQuote` (`ACTIVITY_TYPE_CREATE_SWAP_QUOTE`) and `executeSwap` (`ACTIVITY_TYPE_EXECUTE_SWAP_V2`) on the high-level SDK clients. `createSwapQuote` takes `signWith`, CAIP-19 tokens, amount, and optional `slippageBps`, and returns provider quotes. `executeSwap` is quote-bound: pass `quoteId` plus the exact quoted amounts (`quotedOutputAmount`, `minOutputAmount`, `sponsor`); the signer is derived from the quote. Poll with `getSwapStatus` using the returned `swapRequestId`.

Also align transaction-history list responses with standard pagination (`v1Pagination` / `pageInfo`) instead of the previous transaction-history-specific cursor types.

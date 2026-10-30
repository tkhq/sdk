---
"@turnkey/http": minor
"@turnkey/sdk-types": minor
"@turnkey/sdk-browser": minor
"@turnkey/sdk-server": minor
"@turnkey/core": minor
"@turnkey/react-wallet-kit": minor
"@turnkey/react-native-wallet-kit": minor
---

Sync with the latest public API. `executeSwap` now uses `ACTIVITY_TYPE_EXECUTE_SWAP_V4`, which adds market swaps, and `getIndicativeSwapQuote` previews a price without creating an activity. Also adds `mintJwt`, adds swap charges to swap quotes, results and status, and renames velocity controls to usage controls.

**Breaking:** `executeSwap` moves the quote fields into `boundQuote`.

Before:

```ts
await client.executeSwap({
  quoteId,
  quotedOutputAmount,
  minOutputAmount,
  inputToken,
  inputAmount,
  outputToken,
  sponsor,
});
```

After:

```ts
await client.executeSwap({
  boundQuote: { quoteId, quotedOutputAmount, minOutputAmount },
  inputToken,
  inputAmount,
  outputToken,
  sponsor,
});
```

For a market swap, pass `market` instead of `boundQuote`.

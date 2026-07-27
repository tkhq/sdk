---
"@turnkey/core": minor
"@turnkey/react-wallet-kit": minor
"@turnkey/react-native-wallet-kit": minor
---

Add Solana multi-signer transaction support to the core client and wallet kits.

`@turnkey/core` exposes a new `solSendTransactionV2()` HTTP client function that sends `ACTIVITY_TYPE_SOL_SEND_TRANSACTION_V2`. The existing `solSendTransaction()` HTTP client function remains on V1.

The shared `solSendTransaction` helper used by core and the wallet kits now accepts either version of the intent. Passing the legacy `signWith` field continues to use V1. Passing the new ordered `signWiths` array uses V2.

**Before (V1 remains supported):**

```ts
await client.solSendTransaction({
  transaction: {
    unsignedTransaction: unsignedTransactionBase64,
    signWith: signerAddress,
    caip2,
    sponsor,
  },
});
```

**After (V2):**

```ts
await client.solSendTransaction({
  transaction: {
    unsignedTransaction: unsignedTransactionHex,
    signWiths: [signerAddress],
    caip2,
    sponsor,
  },
});
```

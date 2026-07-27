---
"@turnkey/sdk-types": minor
---

Add Solana send-transaction v2 intent and result types. The new intent uses an ordered `signWiths` array and a hex-encoded full unsigned transaction.

**Before:**

```ts
const intent: v1SolSendTransactionIntent = {
  unsignedTransaction: unsignedTransactionBase64,
  signWith: signerAddress,
  caip2,
  sponsor,
};
```

**After:**

```ts
const intent: v1SolSendTransactionIntentV2 = {
  unsignedTransaction: unsignedTransactionHex,
  signWiths: [signerAddress],
  caip2,
  sponsor,
};
```
